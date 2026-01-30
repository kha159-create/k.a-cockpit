
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
      console.log('✅ Remote DB pool created for live-sales on Vercel');
    } catch (error) {
      console.warn('⚠️ Could not create remote DB pool:', error);
      pool = null;
    }
  } else {
    console.log('🌐 Running on Vercel - live-sales will return empty data (no remote DB configured)');
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
    console.log('✅ Local DB pool created for live-sales');
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

  // On Vercel: return empty data (live sales require DB connection)
  if (isVercel || !pool) {
    console.log('⚠️ live-sales: No DB connection, returning empty data');
    const now = new Date();
    const saudiNow = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    const todayDate = saudiNow.toISOString().split('T')[0];
    
    return res.status(200).json({
      success: true,
      date: todayDate,
      lastUpdate: 'N/A',
      today: [],
      yesterday: [],
      todayStoresCount: 0,
      yesterdayStoresCount: 0,
      debug: { source: 'vercel-empty', note: 'Live sales require local database connection' },
    });
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
