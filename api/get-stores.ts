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
  // Handle CORS
  const allowedOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  try {
    console.log('📥 Fetching stores from PostgreSQL (Unified)...');

    const result = await pool.query(`
      SELECT 
        store_id,
        name,
        city,
        area_manager as "areaManager",
        type,
        is_active
      FROM stores
      WHERE is_active = TRUE
      ORDER BY name ASC
    `);

    const stores = result.rows.map(row => ({
      id: row.store_id,
      store_id: row.store_id,
      name: row.name,
      areaManager: row.areaManager || 'Showroom',
      city: row.city,
      store_type: row.type,
      is_online: row.type === 'Online' || row.type === 'E-Commerce'
    }));

    console.log(`✅ Returning ${stores.length} stores from SQL`);

    return res.status(200).json({
      success: true,
      stores,
      count: stores.length,
    });

  } catch (error: any) {
    console.error('❌ Error fetching stores from SQL:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
}
