
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  try {
    console.log('📥 Fetching employees with mapping from PostgreSQL...');

    const result = await pool.query(`
      SELECT 
        e.employee_id as id,
        e.employee_id as "employeeId",
        e.name,
        e.current_store as "currentStore",
        m.primary_store_id,
        s.name as store_name,
        s.city,
        e.status
      FROM employees e
      LEFT JOIN employee_store_mapping m ON e.employee_id = m.employee_id
      LEFT JOIN stores s ON COALESCE(e.current_store, m.primary_store_id) = s.store_id
      WHERE e.is_active = TRUE
      ORDER BY e.name ASC
    `);

    const employees = result.rows;
    console.log(`✅ Returning ${employees.length} employees with mapping from SQL`);

    return res.status(200).json({
      success: true,
      employees,
      count: employees.length,
    });

  } catch (error: any) {
    console.error('❌ Error fetching employees from SQL:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
}
