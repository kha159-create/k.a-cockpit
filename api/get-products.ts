
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
    const allowedOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).end();
    }

    try {
        console.log('📦 Unified API: Fetching Products from SQL...');

        // Fetch valid products from all_products
        // Just SELECT * for now, frontend will handle display
        const query = `
            SELECT 
                product_number as item_id, 
                product_name as item_name 
            FROM all_products 
            ORDER BY product_number ASC
            LIMIT 5000
        `;

        const result = await pool.query(query);

        return res.status(200).json({
            success: true,
            count: result.rowCount,
            products: result.rows
        });

    } catch (error: any) {
        console.error('❌ Error fetching products:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
