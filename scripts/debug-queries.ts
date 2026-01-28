
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DATABASE || 'showroom_sales',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    port: parseInt(process.env.PG_PORT || '5432'),
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function run() {
    try {
        console.log('🧪 Testing Queries...');

        // 1. Test Products Query
        console.log('\n📦 Testing get-products query...');
        try {
            const res = await pool.query('SELECT * FROM all_products ORDER BY item_id ASC LIMIT 1');
            console.log('✅ Products Query Success. Sample:', res.rows[0].item_name);
        } catch (e: any) {
            console.error('❌ Products Query Failed:', e.message);
        }

        // 2. Test Sales Unified Query (D365 Branch)
        console.log('\n📊 Testing sales-unified (D365) query...');
        try {
            // Params simulation for 2026
            const startDate = new Date('2026-01-01T00:00:00.000Z');
            const endDate = new Date('2026-12-31T23:59:59.000Z');
            const params = [startDate, endDate];

            // Simple Sales Query
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
                GROUP BY s.store_id, s.name, s.city
                LIMIT 5
            `;
            await pool.query(salesQuery, params);
            console.log('✅ Sales Main Query Success');

            // Employee Query (Suspect)
            console.log('Testing Employee Query...');
            const employeeQuery = `
                SELECT 
                    COALESCE(e.name, di.sales_group) as employee_name,
                    di.sales_group as employee_id,
                    s.store_id,
                    s.name as store_name,
                    SUM(di.net_amount) as sales_amount,
                    COUNT(DISTINCT di.transaction_id) as invoice_count
                FROM dynamic_sales_items di
                LEFT JOIN employees e ON di.sales_group = CAST(e.employee_id AS TEXT) OR di.sales_group = e.sales_group
                JOIN stores s ON di.store_number = s.store_id
                WHERE di.item_date >= $1 AND di.item_date <= $2
                GROUP BY di.sales_group, e.name, s.store_id, s.name
                LIMIT 5
            `;
            await pool.query(employeeQuery, params);
            console.log('✅ Employee Query Success');

        } catch (e: any) {
            console.error('❌ Sales Query Failed:', e.message);
            console.error('Details:', e);
        }

        // 3. Test Live Sales
        console.log('\n⚡ Testing Live Sales Query...');
        try {
            // Assuming live-sales uses dynamic_sales_bills for today?
            // Or does it use an external API?
            // api/live-sales.ts calls fetch... let's check parsing if we were to use SQL.
            const today = new Date().toISOString().split('T')[0];
            const liveQuery = `
                SELECT count(*) as count FROM dynamic_sales_bills WHERE bill_date = $1
             `;
            await pool.query(liveQuery, [today]);
            console.log('✅ Live Sales Table Check Success');
        } catch (e: any) {
            console.error('❌ Live Sales Check Failed:', e.message);
        }

    } catch (e: any) {
        console.error('🔥 Fatal Testing Error:', e);
    } finally {
        await pool.end();
    }
}

run();
