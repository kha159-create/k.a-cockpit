/**
 * PostgreSQL Sales API - Optimized for Fast Performance
 * Reads from gofrugal_sales and gofrugal_item_sales tables
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'showroom_sales',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  port: parseInt(process.env.PG_PORT || '5432'),
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10, // Maximum pool connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  const allowedOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();

  try {
    // Parse query parameters
    const year = parseInt(req.query.year as string);
    const month = req.query.month !== undefined ? parseInt(req.query.month as string) : undefined;
    const day = req.query.day !== undefined ? parseInt(req.query.day as string) : undefined;
    const storeId = req.query.storeId as string | undefined;

    if (!year || isNaN(year)) {
      return res.status(400).json({ error: 'year parameter is required (YYYY format)' });
    }

    console.log(`📊 PostgreSQL Sales API: year=${year}, month=${month === undefined ? 'all' : month}, day=${day === undefined ? 'all' : day}, storeId=${storeId || 'all'}`);

    // Calculate date range
    let startDate: Date;
    let endDate: Date;

    if (day !== undefined && month !== undefined) {
      // Specific day
      startDate = new Date(year, month, day, 0, 0, 0);
      endDate = new Date(year, month, day, 23, 59, 59);
    } else if (month !== undefined) {
      // Specific month
      startDate = new Date(year, month, 1, 0, 0, 0);
      endDate = new Date(year, month + 1, 0, 23, 59, 59);
    } else {
      // Entire year
      startDate = new Date(year, 0, 1, 0, 0, 0);
      endDate = new Date(year, 11, 31, 23, 59, 59);
    }

    console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // --- PARALLEL QUERIES FOR SPEED ---
    const queries = [];

    // 1. Store mapping query
    queries.push(
      pool.query(`
        SELECT outlet_name, dynamic_number, area_manager, city
        FROM gofrugal_outlets_mapping
        WHERE dynamic_number IS NOT NULL
      `)
    );

    // 2. Store-level aggregation
    let storeQuery = `
      SELECT 
        outlet_name, 
        SUM(net_amount) as total_sales, 
        COUNT(*) as invoice_count 
      FROM gofrugal_sales 
      WHERE bill_date >= $1 AND bill_date <= $2
    `;
    const storeParams: any[] = [startDate, endDate];
    
    if (storeId) {
      storeQuery += ` AND (outlet_name = $3 OR EXISTS (
        SELECT 1 FROM gofrugal_outlets_mapping 
        WHERE gofrugal_outlets_mapping.outlet_name = gofrugal_sales.outlet_name 
        AND gofrugal_outlets_mapping.dynamic_number = $3
      ))`;
      storeParams.push(storeId);
    }
    storeQuery += ` GROUP BY outlet_name`;
    queries.push(pool.query(storeQuery, storeParams));

    // 3. Daily aggregation (if not requesting a single day)
    let dailyQuery = '';
    let dailyParams: any[] = [];
    if (day === undefined) {
      dailyQuery = `
        SELECT 
          DATE(bill_date) as date_str, 
          outlet_name, 
          SUM(net_amount) as total_sales, 
          COUNT(*) as invoice_count 
        FROM gofrugal_sales 
        WHERE bill_date >= $1 AND bill_date <= $2
      `;
      dailyParams = [startDate, endDate];
      
      if (storeId) {
        dailyQuery += ` AND (outlet_name = $3 OR EXISTS (
          SELECT 1 FROM gofrugal_outlets_mapping 
          WHERE gofrugal_outlets_mapping.outlet_name = gofrugal_sales.outlet_name 
          AND gofrugal_outlets_mapping.dynamic_number = $3
        ))`;
        dailyParams.push(storeId);
      }
      dailyQuery += ` GROUP BY DATE(bill_date), outlet_name ORDER BY date_str`;
      queries.push(pool.query(dailyQuery, dailyParams));
    } else {
      queries.push(Promise.resolve({ rows: [] })); // Empty for single day
    }

    // 4. Employee aggregation
    let empQuery = `
      SELECT 
        salesman,
        outlet_name,
        SUM(net_amount) as total_sales, 
        COUNT(*) as invoice_count 
      FROM gofrugal_sales 
      WHERE bill_date >= $1 AND bill_date <= $2 
        AND salesman IS NOT NULL AND salesman != ''
    `;
    const empParams: any[] = [startDate, endDate];
    
    if (storeId) {
      empQuery += ` AND (outlet_name = $3 OR EXISTS (
        SELECT 1 FROM gofrugal_outlets_mapping 
        WHERE gofrugal_outlets_mapping.outlet_name = gofrugal_sales.outlet_name 
        AND gofrugal_outlets_mapping.dynamic_number = $3
      ))`;
      empParams.push(storeId);
    }
    empQuery += ` GROUP BY salesman, outlet_name`;
    queries.push(pool.query(empQuery, empParams));

    // 5. Targets query
    const targetsQuery = `
      SELECT outlet_name, target_amount, year, month
      FROM gofrugal_targets
      WHERE year = $1 AND (month = $2 OR $2 IS NULL)
    `;
    queries.push(pool.query(targetsQuery, [year, month !== undefined ? month + 1 : null]));

    // 6. Visitors query
    const visitorsQuery = `
      SELECT outlet_name, visit_date, visitor_count
      FROM gofrugal_visitors
      WHERE visit_date >= $1 AND visit_date <= $2
    `;
    queries.push(pool.query(visitorsQuery, [startDate, endDate]));

    // Execute all queries in parallel
    console.log(`🔍 Executing ${queries.length} queries in parallel...`);
    const [storeMappingResult, storeRes, dailyRes, empRes, targetsResult, visitorsResult] = await Promise.all(queries);

    const queryTime = Date.now() - startTime;
    console.log(`✅ Queries completed in ${queryTime}ms`);

    // --- PROCESS RESULTS ---

    // Store mapping
    const storeMapping = new Map<string, { name: string; number: string | null; areaManager: string | null; city: string | null }>();
    const outletNameToStoreId = new Map<string, string>();
    storeMappingResult.rows.forEach(row => {
      const outletName = row.outlet_name;
      const storeId = row.dynamic_number;
      storeMapping.set(outletName, {
        name: outletName,
        number: storeId,
        areaManager: row.area_manager,
        city: row.city,
      });
      outletNameToStoreId.set(outletName, storeId);
    });

    // Targets
    const targetsMap = new Map<string, Map<number, number>>();
    targetsResult.rows.forEach(row => {
      const outletName = row.outlet_name;
      const targetMonth = row.month || 0;
      const targetAmount = Number(row.target_amount) || 0;
      
      if (!targetsMap.has(outletName)) {
        targetsMap.set(outletName, new Map());
      }
      targetsMap.get(outletName)!.set(targetMonth, targetAmount);
    });

    // Visitors
    const monthlyVisitorsMap = new Map<string, number>();
    const dailyVisitorsMap = new Map<string, number>();
    visitorsResult.rows.forEach(row => {
      const outletName = row.outlet_name;
      const dateStr = row.visit_date.toISOString().split('T')[0];
      
      const currentMonthlyCount = monthlyVisitorsMap.get(outletName) || 0;
      monthlyVisitorsMap.set(outletName, currentMonthlyCount + (Number(row.visitor_count) || 0));

      const dailyKey = `${dateStr}_${outletName}`;
      const currentDailyCount = dailyVisitorsMap.get(dailyKey) || 0;
      dailyVisitorsMap.set(dailyKey, currentDailyCount + (Number(row.visitor_count) || 0));
    });

    // --- BUILD RESPONSE ---

    // Process stores
    const byStore: any[] = [];
    storeRes.rows.forEach(row => {
      const outletName = row.outlet_name;
      const storeInfo = storeMapping.get(outletName);
      const salesAmount = Number(row.total_sales) || 0;
      const invoices = Number(row.invoice_count) || 0;
      const visitors = monthlyVisitorsMap.get(outletName) || 0;
      const atv = invoices > 0 ? salesAmount / invoices : 0;
      const conversion = visitors > 0 ? (invoices / visitors) * 100 : 0;

      const storeTargets = targetsMap.get(outletName);
      let target = 0;
      if (storeTargets) {
        if (month !== undefined) {
          target = storeTargets.get(month + 1) || 0;
        } else {
          // Yearly target (sum all months or use month 0)
          target = storeTargets.get(0) || Array.from(storeTargets.values()).reduce((sum, t) => sum + t, 0);
        }
      }

      byStore.push({
        storeId: storeInfo?.number || outletName,
        storeName: outletName,
        salesAmount,
        invoices,
        visitors,
        atv,
        conversion,
        target,
        city: storeInfo?.city || null,
        areaManager: storeInfo?.areaManager || null,
      });
    });

    // Process daily (if applicable)
    const byDayMap = new Map<string, any[]>();
    if (dailyRes.rows.length > 0) {
      dailyRes.rows.forEach(row => {
        const dateStr = row.date_str.toISOString().split('T')[0];
        const outletName = row.outlet_name;
        const storeInfo = storeMapping.get(outletName);
        const salesAmount = Number(row.total_sales) || 0;
        const invoices = Number(row.invoice_count) || 0;
        const dailyKey = `${dateStr}_${outletName}`;
        const visitors = dailyVisitorsMap.get(dailyKey) || 0;
        const atv = invoices > 0 ? salesAmount / invoices : 0;
        const conversion = visitors > 0 ? (invoices / visitors) * 100 : 0;

        if (!byDayMap.has(dateStr)) {
          byDayMap.set(dateStr, []);
        }

        byDayMap.get(dateStr)!.push({
          storeId: storeInfo?.number || outletName,
          storeName: outletName,
          salesAmount,
          invoices,
          visitors,
          atv,
          conversion,
        });
      });
    }

    const byDay = Array.from(byDayMap.entries()).map(([date, stores]) => ({
      date,
      byStore: stores,
    }));

    // Process employees
    const byEmployee: any[] = [];
    empRes.rows.forEach(row => {
      const salesman = row.salesman;
      const outletName = row.outlet_name;
      const storeInfo = storeMapping.get(outletName);
      const salesAmount = Number(row.total_sales) || 0;
      const invoices = Number(row.invoice_count) || 0;
      const atv = invoices > 0 ? salesAmount / invoices : 0;

      // Extract employee ID from salesman name (format: "Name (ID)")
      let employeeId = '';
      let employeeName = salesman;
      const idMatch = salesman.match(/\((\d+)\)/);
      if (idMatch) {
        employeeId = idMatch[1];
        employeeName = salesman.replace(/\s*\(\d+\)\s*/, '').trim();
      }

      byEmployee.push({
        employeeId: employeeId || salesman,
        employeeName: employeeName,
        storeId: storeInfo?.number || outletName,
        storeName: outletName,
        salesAmount,
        invoices,
        atv,
        customerValue: atv, // Alias
      });
    });

    // Calculate totals
    const totals = {
      salesAmount: byStore.reduce((sum, s) => sum + s.salesAmount, 0),
      visitors: byStore.reduce((sum, s) => sum + s.visitors, 0),
      invoices: byStore.reduce((sum, s) => sum + s.invoices, 0),
      atv: 0,
      conversion: 0,
    };
    totals.atv = totals.invoices > 0 ? totals.salesAmount / totals.invoices : 0;
    totals.conversion = totals.visitors > 0 ? (totals.invoices / totals.visitors) * 100 : 0;

    const totalTime = Date.now() - startTime;
    console.log(`✅ Response built in ${totalTime}ms total`);

    return res.status(200).json({
      success: true,
      totals,
      byStore,
      byDay: byDay.length > 0 ? byDay : undefined,
      byEmployee,
      debug: {
        source: 'postgresql',
        range: {
          from: startDate.toISOString(),
          to: endDate.toISOString(),
          year,
          month,
          day,
        },
        counts: {
          stores: byStore.length,
          days: byDay.length,
          employees: byEmployee.length,
        },
        performance: {
          queryTime: `${queryTime}ms`,
          totalTime: `${totalTime}ms`,
        },
      },
    });

  } catch (error: any) {
    console.error('❌ PostgreSQL Sales API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}
