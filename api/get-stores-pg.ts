/**
 * PostgreSQL Stores API - Returns stores from gofrugal_outlets_mapping for 2024-2025
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'showroom_sales',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'KhaKha11@',
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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📥 Fetching stores from PostgreSQL...');

    const result = await pool.query(`
      SELECT 
        outlet_name as name,
        dynamic_number as id,
        area_manager as areaManager,
        city
      FROM gofrugal_outlets_mapping
      WHERE dynamic_number IS NOT NULL
      ORDER BY outlet_name
    `);

    const stores = result.rows.map(row => ({
      id: row.id || row.name, // Use dynamic_number as id, fallback to outlet_name
      store_id: row.id, // Also include as store_id for compatibility
      name: row.name,
      areaManager: row.areamanager || '',
      ...(row.city && { city: row.city }),
    })).filter(store => store.areaManager); // Only stores with area managers

    console.log(`✅ Loaded ${stores.length} stores from PostgreSQL`);

    return res.status(200).json({
      success: true,
      stores,
      count: stores.length,
    });
  } catch (error: any) {
    console.error('❌ Error fetching stores from PostgreSQL:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stores: [],
      count: 0,
    });
  }
}
