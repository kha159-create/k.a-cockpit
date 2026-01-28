
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
        console.log('🕰️ Debugging Legacy Data (2024-2025)...');

        // 1. Check raw sample from gofrugal_sales
        console.log('\n📜 Sample Row from gofrugal_sales:');
        const sampleRes = await pool.query('SELECT * FROM gofrugal_sales LIMIT 1');
        if (sampleRes.rows.length > 0) {
            console.log(sampleRes.rows[0]);
            console.log('Type of bill_date:', typeof sampleRes.rows[0].bill_date);
        } else {
            console.log('⚠️ gofrugal_sales table is EMPTY!');
        }

        // 2. Check raw sample from mapping
        console.log('\n🗺️ Sample Row from gofrugal_outlets_mapping:');
        const mapRes = await pool.query('SELECT * FROM gofrugal_outlets_mapping LIMIT 1');
        if (mapRes.rows.length > 0) {
            console.log(mapRes.rows[0]);
        } else {
            console.log('⚠️ gofrugal_outlets_mapping table is EMPTY!');
        }

        // 3. Test the Join Query (2024)
        console.log('\n🔄 Testing Join Query for 2024...');
        const query = `
            SELECT 
                m.dynamic_number as store_id,
                m.outlet_name as store_name,
                COUNT(gs.bill_no) as count,
                SUM(gs.net_amount) as total
            FROM gofrugal_outlets_mapping m
            LEFT JOIN gofrugal_sales gs ON m.outlet_name = gs.outlet_name
            WHERE gs.bill_date >= '2024-01-01' AND gs.bill_date <= '2024-12-31'
            GROUP BY m.dynamic_number, m.outlet_name
            LIMIT 5
        `;
        const joinRes = await pool.query(query);
        console.log(`✅ Query returned ${joinRes.rowCount} rows.`);
        console.log(joinRes.rows);

    } catch (e: any) {
        console.error('🔥 Legacy Debug Error:', e);
    } finally {
        await pool.end();
    }
}

run();
