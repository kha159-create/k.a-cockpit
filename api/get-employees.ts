
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

// Validate required environment variables (fail fast in production)
const requiredEnvVars = {
  PG_HOST: process.env.PG_HOST,
  PG_DATABASE: process.env.PG_DATABASE,
  PG_USER: process.env.PG_USER,
  PG_PASSWORD: process.env.PG_PASSWORD,
  PG_PORT: process.env.PG_PORT,
};

// Debug logging (safe - does not expose passwords)
console.log('🔍 DB Config Check (get-employees):', {
  host: requiredEnvVars.PG_HOST ? 'Defined' : '❌ MISSING',
  database: requiredEnvVars.PG_DATABASE ? 'Defined' : '❌ MISSING',
  user: requiredEnvVars.PG_USER ? 'Defined' : '❌ MISSING',
  password: requiredEnvVars.PG_PASSWORD ? 'Defined' : '❌ MISSING',
  port: requiredEnvVars.PG_PORT ? 'Defined' : '❌ MISSING',
  ssl: process.env.PG_SSL === 'true' ? 'Enabled' : 'Disabled',
});

// Fail fast if critical env vars are missing (no weak fallbacks)
if (!requiredEnvVars.PG_HOST) {
  throw new Error('❌ PG_HOST environment variable is required but not set');
}
if (!requiredEnvVars.PG_DATABASE) {
  throw new Error('❌ PG_DATABASE environment variable is required but not set');
}
if (!requiredEnvVars.PG_USER) {
  throw new Error('❌ PG_USER environment variable is required but not set');
}
if (!requiredEnvVars.PG_PASSWORD) {
  throw new Error('❌ PG_PASSWORD environment variable is required but not set');
}

const pool = new Pool({
  host: requiredEnvVars.PG_HOST,
  database: requiredEnvVars.PG_DATABASE,
  user: requiredEnvVars.PG_USER,
  password: requiredEnvVars.PG_PASSWORD,
  port: parseInt(requiredEnvVars.PG_PORT || '5432'),
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
