// scripts/test-db-connection.js
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DATABASE || 'showroom_sales',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'KhaKha11@',
    port: parseInt(process.env.PG_PORT || '5432'),
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
});

async function testConnection() {
    console.log('🔌 Testing PostgreSQL Connection...');
    console.log(`Config: Host=${process.env.PG_HOST}, DB=${process.env.PG_DATABASE}, User=${process.env.PG_USER}`);

    try {
        const client = await pool.connect();
        console.log('✅ Connection Successful!');

        // Test Queries
        const salesCount = await client.query('SELECT COUNT(*) FROM gofrugal_sales');
        console.log(`📊 Sales Rows: ${salesCount.rows[0].count}`);

        const dateRange = await client.query('SELECT MIN(bill_date) as start_date, MAX(bill_date) as end_date FROM gofrugal_sales');
        console.log(`📅 Sales Range: ${dateRange.rows[0].start_date} to ${dateRange.rows[0].end_date}`);

        const salesmanCount = await client.query('SELECT COUNT(*) FROM gofrugal_sales WHERE salesman IS NOT NULL AND salesman != \'\'');
        console.log(`🧑‍💼 Rows with Salesman: ${salesmanCount.rows[0].count}`);

        const targetsCount = await client.query('SELECT COUNT(*) FROM gofrugal_targets');
        console.log(`🎯 Targets Rows: ${targetsCount.rows[0].count}`);

        const visitorsCount = await client.query('SELECT COUNT(*) FROM gofrugal_visitors');
        console.log(`busts Visitors Rows: ${visitorsCount.rows[0].count}`);

        client.release();
    } catch (err) {
        console.error('❌ Connection Failed:', err.message);
        if (err.message.includes('password')) console.error('💡 Check your PG_PASSWORD in .env');
        if (err.message.includes('database')) console.error('💡 Check your PG_DATABASE name');
        if (err.code === 'ECONNREFUSED') console.error('💡 Check if PostgreSQL service is running and Port 5432 is open');
    } finally {
        await pool.end();
    }
}

testConnection();
