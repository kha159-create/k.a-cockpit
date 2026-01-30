
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

// Check if running on Vercel
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

let pool: Pool | null = null;

if (isVercel) {
  const requiredEnvVars = {
    PG_HOST: process.env.PG_HOST,
    PG_DATABASE: process.env.PG_DATABASE,
    PG_USER: process.env.PG_USER,
    PG_PASSWORD: process.env.PG_PASSWORD,
    PG_PORT: process.env.PG_PORT,
  };

  if (requiredEnvVars.PG_HOST &&
      requiredEnvVars.PG_DATABASE &&
      requiredEnvVars.PG_USER &&
      requiredEnvVars.PG_PASSWORD &&
      requiredEnvVars.PG_HOST !== 'localhost') {
    try {
      pool = new Pool({
        host: requiredEnvVars.PG_HOST,
        database: requiredEnvVars.PG_DATABASE,
        user: requiredEnvVars.PG_USER,
        password: requiredEnvVars.PG_PASSWORD,
        port: parseInt(requiredEnvVars.PG_PORT || '5432'),
        ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
      });
      console.log('✅ Remote DB pool created for get-employee-mappings on Vercel');
    } catch (error) {
      console.warn('⚠️ Could not create remote DB pool:', error);
      pool = null;
    }
  } else {
    console.log('🌐 Running on Vercel - get-employee-mappings will return empty data (no remote DB configured)');
  }
} else {
  const requiredEnvVars = {
    PG_HOST: process.env.PG_HOST || 'localhost',
    PG_DATABASE: process.env.PG_DATABASE || 'showroom_sales',
    PG_USER: process.env.PG_USER || 'postgres',
    PG_PASSWORD: process.env.PG_PASSWORD || 'KhaKha11@',
    PG_PORT: process.env.PG_PORT || '5432',
  };

  try {
    pool = new Pool({
      host: requiredEnvVars.PG_HOST,
      database: requiredEnvVars.PG_DATABASE,
      user: requiredEnvVars.PG_USER,
      password: requiredEnvVars.PG_PASSWORD,
      port: parseInt(requiredEnvVars.PG_PORT),
      ssl: false, // Local DB
    });
    console.log('✅ Local DB pool created for get-employee-mappings');
  } catch (error) {
    console.warn('⚠️ Could not create DB pool, will return empty data:', error);
    pool = null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    // On Vercel: return empty data (mappings come from management_data.json via read-json-data)
    if (isVercel || !pool) {
        console.log('⚠️ get-employee-mappings: No DB connection, returning empty array (mappings should come from JSON)');
        return res.status(200).json({
            success: true,
            mappings: [],
            count: 0,
            note: 'Employee mappings are loaded from management_data.json via /api/read-json-data',
        });
    }

    try {
        console.log('📥 Fetching GoFrugal employee mappings from PostgreSQL...');

        const result = await pool.query(`
      SELECT 
        sales_group,
        arabic_name,
        employee_id
      FROM gofrugal_employee_mapping
    `);

        const mappings = result.rows;
        console.log(`✅ Returning ${mappings.length} mappings from SQL`);

        return res.status(200).json({
            success: true,
            mappings,
            count: mappings.length,
        });

    } catch (error: any) {
        console.error('❌ Error fetching mappings from SQL:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Unknown error',
        });
    }
}
