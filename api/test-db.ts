import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DATABASE || 'showroom_sales',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'KhaKha11@',
    port: parseInt(process.env.PG_PORT || '5432'),
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT COUNT(*) as count FROM gofrugal_sales');
        const salesman = await client.query('SELECT COUNT(*) as count FROM gofrugal_sales WHERE salesman IS NOT NULL');
        const dbName = await client.query('SELECT current_database()');

        client.release();

        res.status(200).json({
            success: true,
            message: 'Connection Successful via API!',
            database: dbName.rows[0].current_database,
            sales_count: result.rows[0].count,
            salesman_count: salesman.rows[0].count,
            env: {
                PG_HOST: process.env.PG_HOST,
                PG_DATABASE: process.env.PG_DATABASE,
                PG_USER: process.env.PG_USER
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack,
            env_check: {
                PG_HOST: process.env.PG_HOST,
                PG_USER: process.env.PG_USER
            }
        });
    }
}
