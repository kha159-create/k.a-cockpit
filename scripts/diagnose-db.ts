
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
        console.log('🔌 Connecting to DB...');
        const client = await pool.connect();
        console.log('✅ Connected!');
        client.release();

        console.log('🔍 Checking stores...');
        const stores = await pool.query('SELECT count(*) FROM stores');
        console.log('✅ Stores count:', stores.rows[0].count);

        console.log('🔍 Checking all_products...');
        try {
            const prods = await pool.query('SELECT count(*) FROM all_products');
            console.log('✅ all_products count:', prods.rows[0].count);
        } catch (e: any) {
            console.error('❌ all_products error:', e.message);
        }

        console.log('🔍 Checking dynamic_sales_bills...');
        try {
            const bills = await pool.query('SELECT count(*) FROM dynamic_sales_bills');
            console.log('✅ dynamic_sales_bills count:', bills.rows[0].count);
        } catch (e: any) {
            console.error('❌ dynamic_sales_bills error:', e.message);
        }

        console.log('🔍 Checking dynamic_sales_items...');
        try {
            const items = await pool.query('SELECT count(*) FROM dynamic_sales_items');
            console.log('✅ dynamic_sales_items count:', items.rows[0].count);
        } catch (e: any) {
            console.error('❌ dynamic_sales_items error:', e.message);
        }

    } catch (e: any) {
        console.error('🔥 Fatal DB Error:', e);
    } finally {
        await pool.end();
    }
}

run();
