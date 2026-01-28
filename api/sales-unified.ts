
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DATABASE || 'showroom_sales',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    port: parseInt(process.env.PG_PORT || '5432'),
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    const allowedOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).end();
    }

    try {
        const year = parseInt(req.query.year as string) || new Date().getFullYear();
        const month = req.query.month ? parseInt(req.query.month as string) : undefined; // 1-12
        const storeId = req.query.storeId as string;
        const city = req.query.city as string;

        console.log(`📊 Unified API: year=${year}, month=${month || 'all'}, store=${storeId || 'all'}, city=${city || 'all'}`);

        const startDate = new Date(Date.UTC(year, month ? month - 1 : 0, 1));
        const endDate = month
            ? new Date(Date.UTC(year, month, 0, 23, 59, 59))
            : new Date(Date.UTC(year, 11, 31, 23, 59, 59));

        let byStore: any[] = [];
        let totals = { salesAmount: 0, invoices: 0, visitors: 0, target: 0, kpis: { atv: 0, conversion: 0, customerValue: 0 } };

        if (year >= 2026) {
            // --- D365 Branch (dynamic_sales_bills) ---
            const salesParams: any[] = [startDate, endDate];
            if (storeId) salesParams.push(storeId);
            if (city && city !== 'All') salesParams.push(city);

            const targetParams: any[] = [year];
            if (month) targetParams.push(month);
            if (city && city !== 'All') targetParams.push(city);

            const cityFilterSales = city && city !== 'All' ? `AND s.city = $${salesParams.length}` : '';
            const cityFilterTargets = city && city !== 'All' ? `AND s.city = $${targetParams.length}` : '';

            const salesQuery = `
                SELECT 
                    s.store_id,
                    s.name as store_name,
                    s.city,
                    COALESCE(SUM(db.payment_amount), 0) as total_sales,
                    COALESCE(COUNT(db.transaction_id), 0) as invoice_count
                FROM stores s
                LEFT JOIN dynamic_sales_bills db ON s.store_id = db.store_number 
                    AND db.bill_date >= $1 AND db.bill_date <= $2
                WHERE 1=1 
                    ${storeId ? 'AND s.store_id = $3' : ''}
                    ${cityFilterSales}
                GROUP BY s.store_id, s.name, s.city
            `;

            const targetsQuery = `
                SELECT t.store_id, SUM(t.target_amount) as total_target
                FROM targets t
                JOIN stores s ON t.store_id = s.store_id
                WHERE t.year = $1 
                    ${month ? 'AND t.month = $2' : ''}
                    ${cityFilterTargets}
                GROUP BY t.store_id
            `;

            // New Daily Breakdown (byDay) for charts
            const dailyQuery = `
                SELECT 
                    db.bill_date as date,
                    s.store_id,
                    s.name as store_name,
                    SUM(db.payment_amount) as sales_amount,
                    COUNT(db.transaction_id) as invoice_count
                FROM dynamic_sales_bills db
                JOIN stores s ON db.store_number = s.store_id
                WHERE db.bill_date >= $1 AND db.bill_date <= $2
                    ${storeId ? 'AND s.store_id = $3' : ''}
                    ${cityFilterSales}
                GROUP BY db.bill_date, s.store_id, s.name
                ORDER BY db.bill_date ASC
            `;

            // New Employee Aggregate (byEmployee)
            // Fix: Use dynamic_sales_items because 'sales_group' (Employee ID) is there, not in bills.
            const employeeQuery = `
                SELECT 
                    COALESCE(e.name, di.sales_group) as employee_name,
                    di.sales_group as employee_id,
                    s.store_id,
                    s.name as store_name,
                    SUM(di.net_amount) as sales_amount,
                    COUNT(DISTINCT di.transaction_id) as invoice_count
                FROM dynamic_sales_items di
                LEFT JOIN employees e ON di.sales_group = CAST(e.employee_id AS TEXT)
                JOIN stores s ON di.store_number = s.store_id
                WHERE di.item_date >= $1 AND di.item_date <= $2
                    ${storeId ? 'AND s.store_id = $3' : ''}
                    ${cityFilterSales}
                GROUP BY di.sales_group, e.name, s.store_id, s.name
                ORDER BY sales_amount DESC
            `;

            const [salesRes, targetsRes, dailyRes, employeeRes] = await Promise.all([
                pool.query(salesQuery, salesParams),
                pool.query(targetsQuery, targetParams),
                pool.query(dailyQuery, salesParams),
                pool.query(employeeQuery, salesParams)
            ]);

            const targetMap = new Map(targetsRes.rows.map(r => [r.store_id, Number(r.total_target)]));

            byStore = salesRes.rows.map(r => {
                const sales = Number(r.total_sales);
                const inv = Number(r.invoice_count);
                const target = targetMap.get(r.store_id) || 0;
                return {
                    storeId: r.store_id,
                    storeName: r.store_name,
                    city: r.city,
                    salesAmount: sales,
                    invoices: inv,
                    target: target,
                    kpis: {
                        atv: inv > 0 ? sales / inv : 0,
                        conversion: 0,
                        customerValue: 0
                    }
                };
            });

            const byDayMap = new Map();
            dailyRes.rows.forEach(r => {
                const date = r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date;
                if (!byDayMap.has(date)) byDayMap.set(date, { date, byStore: [] });
                byDayMap.get(date).byStore.push({
                    storeId: r.store_id,
                    storeName: r.store_name,
                    salesAmount: Number(r.sales_amount),
                    invoices: Number(r.invoice_count),
                    kpis: { atv: Number(r.invoice_count) > 0 ? Number(r.sales_amount) / Number(r.invoice_count) : 0 }
                });
            });

            const byEmployee = employeeRes.rows.map(r => ({
                employeeId: r.employee_id,
                employeeName: r.employee_name,
                storeId: r.store_id,
                storeName: r.store_name,
                salesAmount: Number(r.sales_amount),
                invoices: Number(r.invoice_count),
                kpis: { atv: Number(r.invoice_count) > 0 ? Number(r.sales_amount) / Number(r.invoice_count) : 0 }
            }));

            return res.status(200).json({
                success: true,
                year,
                month: month || 'all',
                range: { from: startDate.toISOString().split('T')[0], to: endDate.toISOString().split('T')[0] },
                totals: {
                    salesAmount: byStore.reduce((s, i) => s + i.salesAmount, 0),
                    invoices: byStore.reduce((s, i) => s + i.invoices, 0),
                    target: Array.from(targetMap.values()).reduce((sum, t) => sum + t, 0),
                    kpis: { atv: byStore.reduce((s, i) => s + i.salesAmount, 0) / (byStore.reduce((s, i) => s + i.invoices, 0) || 1) }
                },
                byStore,
                byDay: Array.from(byDayMap.values()),
                byEmployee,
                debug: { source: 'dynamic' }
            });

        } else {
            // --- Legacy Branch (gofrugal_sales) ---
            // Simplified join for unified output
            const salesParams: any[] = [startDate, endDate];
            if (storeId) salesParams.push(storeId);
            if (city && city !== 'All') salesParams.push(city);

            const targetParams: any[] = [year];
            if (month) targetParams.push(month);
            if (city && city !== 'All') targetParams.push(city);

            const cityFilterSales = city && city !== 'All' ? `AND m.city = $${salesParams.length}` : '';
            const cityFilterTargets = city && city !== 'All' ? `AND m.city = $${targetParams.length}` : '';

            const legacyQuery = `
                SELECT 
                    m.dynamic_number as store_id,
                    m.outlet_name as store_name,
                    m.city,
                    COALESCE(SUM(gs.net_amount), 0) as total_sales,
                    COALESCE(COUNT(gs.bill_no), 0) as invoice_count
                FROM gofrugal_outlets_mapping m
                LEFT JOIN gofrugal_sales gs ON m.outlet_name = gs.outlet_name
                    AND gs.bill_date >= $1 AND gs.bill_date <= $2
                WHERE m.dynamic_number IS NOT NULL 
                    ${storeId ? 'AND m.dynamic_number = $3' : ''}
                    ${cityFilterSales}
                GROUP BY m.dynamic_number, m.outlet_name, m.city
            `;

            const legacyTargetsQuery = `
                SELECT m.dynamic_number as store_id, SUM(gt.target_amount) as total_target
                FROM gofrugal_targets gt
                JOIN gofrugal_outlets_mapping m ON gt.outlet_name = m.outlet_name
                WHERE gt.year = $1 
                    ${month ? 'AND gt.month = $2' : ''}
                    ${cityFilterTargets}
                GROUP BY m.dynamic_number
            `;

            const [salesRes, targetsRes] = await Promise.all([
                pool.query(legacyQuery, salesParams),
                pool.query(legacyTargetsQuery, targetParams)
            ]);

            console.log(`📜 Legacy 2024/25: Sales Rows: ${salesRes.rowCount}, Target Rows: ${targetsRes.rowCount}`);
            if (salesRes.rows.length > 0) {
                console.log('📜 Legacy Sample Row Keys:', Object.keys(salesRes.rows[0]));
                console.log('📜 Legacy Sample Row:', salesRes.rows[0]);
            }

            const targetMap = new Map(targetsRes.rows.map(r => [r.store_id, Number(r.total_target)]));

            byStore = salesRes.rows.map(r => {
                const sales = Number(r.total_sales);
                const inv = Number(r.invoice_count);
                const target = targetMap.get(r.store_id) || 0;
                return {
                    storeId: r.store_id,
                    storeName: r.store_name,
                    city: r.city,
                    salesAmount: sales,
                    invoices: inv,
                    target: target,
                    kpis: {
                        atv: inv > 0 ? sales / inv : 0,
                        conversion: 0,
                        customerValue: 0
                    }
                };
            });
        }

        // Calculate Totals
        totals.salesAmount = byStore.reduce((sum, s) => sum + s.salesAmount, 0);
        totals.invoices = byStore.reduce((sum, s) => sum + s.invoices, 0);
        totals.target = byStore.reduce((sum, s) => sum + s.target, 0);
        totals.kpis.atv = totals.invoices > 0 ? totals.salesAmount / totals.invoices : 0;

        return res.status(200).json({
            success: true,
            year,
            month: month || 'all',
            totals,
            byStore,
            debug: { source: year >= 2026 ? 'dynamic' : 'legacy' }
        });

    } catch (error: any) {
        console.error('❌ Unified API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
