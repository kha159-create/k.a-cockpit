
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
console.log('🔍 DB Config Check (live-sales):', {
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
    console.log('🚀 Fetching live sales from PostgreSQL...');

    // Get Saudi Arabia time boundaries (UTC+3)
    const now = new Date();
    const saudiNow = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    const todayDate = saudiNow.toISOString().split('T')[0];

    const yesterday = new Date(saudiNow);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split('T')[0];

    // Ranges in UTC (approximate boundaries)
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);

    // Fetch aggregated sales for today and yesterday from PostgreSQL
    // Assuming dynamic_sales_bills (D365) and gofrugal_sales (Legacy)

    const qToday = `
            SELECT 
                db.store_number as store_id,
                db.store_number as store_number,
                COALESCE(s.name, db.store_number::text) as outlet, 
                SUM(db.payment_amount) as sales
            FROM dynamic_sales_bills db
            LEFT JOIN stores s ON db.store_number::text = s.store_id::text
            WHERE db.bill_date >= $1
            GROUP BY db.store_number, COALESCE(s.name, db.store_number::text)
            ORDER BY sales DESC
        `;

    const qYesterday = `
            SELECT 
                db.store_number as store_id,
                db.store_number as store_number,
                COALESCE(s.name, db.store_number::text) as outlet, 
                SUM(db.payment_amount) as sales
            FROM dynamic_sales_bills db
            LEFT JOIN stores s ON db.store_number::text = s.store_id::text
            WHERE db.bill_date >= $1 AND db.bill_date < $2
            GROUP BY db.store_number, COALESCE(s.name, db.store_number::text)
            ORDER BY sales DESC
        `;

    // Use explicit date strings (YYYY-MM-DD) for D365 queries to match 'bill_date' column exactly
    // This avoids timezone confusion between Server UTC and Saudi Store Time
    const [resToday, resYesterday] = await Promise.all([
      pool.query(qToday, [todayDate]),
      pool.query(qYesterday, [yesterdayDate, todayDate])
    ]);

    console.log(`⚡ Live Sales: Today Rows: ${resToday.rowCount}, Yesterday Rows: ${resYesterday.rowCount}`);
    if (resToday.rows.length > 0) {
      console.log('⚡ Live Sample Row Keys:', Object.keys(resToday.rows[0]));
      console.log('⚡ Live Sample Row:', resToday.rows[0]);
    }

    const formatData = (rows: any[]) => rows.map(r => ({
      storeId: String(r.store_id || r.store_number || ''), // Ensure string for matching
      outlet: r.outlet || r.store_id || r.store_number,
      sales: Math.round(Number(r.sales || 0))
    }));

    const result = {
      success: true,
      date: todayDate,
      lastUpdate: saudiNow.getUTCHours().toString().padStart(2, '0') + ':' + saudiNow.getUTCMinutes().toString().padStart(2, '0'),
      today: formatData(resToday.rows),
      yesterday: formatData(resYesterday.rows),
      todayStoresCount: resToday.rows.length,
      yesterdayStoresCount: resYesterday.rows.length,
      debug: { source: 'unified-sql-live' }
    };

    return res.status(200).json(result);

  } catch (error: any) {
    console.error('❌ SQL Live Sales Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}
