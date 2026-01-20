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

interface CategoryRule {
  prefix_pattern: string;
  category_name: string;
}

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
    console.log('📥 Fetching category rules from PostgreSQL...');

    const result = await pool.query<CategoryRule>(
      `SELECT prefix_pattern, category_name 
       FROM product_category_rules 
       ORDER BY LENGTH(prefix_pattern) DESC, prefix_pattern ASC`
    );

    const rules = result.rows;

    console.log(`✅ Loaded ${rules.length} category rules from PostgreSQL`);

    return res.status(200).json({
      success: true,
      rules,
      count: rules.length,
    });
  } catch (error: any) {
    console.error('❌ Error fetching category rules:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      rules: [],
      count: 0,
    });
  }
}
