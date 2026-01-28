import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

// NOTE:
// -------
// This file is intentionally SELF-CONTAINED and does NOT import from ./_lib/apiHandler.
// Vercel was failing with ERR_MODULE_NOT_FOUND when api/auth-sql.ts tried to import
// a shared handler module. To make this endpoint 100% reliable on Vercel, we duplicate
// the auth logic here instead of importing it.
//
// IMPORTANT: On Vercel, we use fallback pins ONLY (no DB connection).
// On local development, we try DB first, then fallback to pins.

// Check if running on Vercel
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

// Hardcoded users from reference project (users.js)
// This is the ONLY auth method on Vercel (no DB connection)
const fallbackPins: Record<string, { pin: string; role: string }> = {
  'Sales Manager': { pin: '6587', role: 'admin' },
  'المنطقة الغربية': { pin: '1478', role: 'general_manager' },
  'اماني عسيري': { pin: '3698', role: 'area_manager' },
  'جهاد ايوبي': { pin: '2587', role: 'area_manager' },
  'خليل الصانع': { pin: '2131', role: 'area_manager' },
  'رضوان عطيوي': { pin: '7643', role: 'area_manager' },
  'شريفة العمري': { pin: '8491', role: 'area_manager' },
  'عبد الجليل الحبال': { pin: '1637', role: 'area_manager' },
  'عبدالله السرداح': { pin: '4618', role: 'area_manager' },
  'عبيدة السباعي': { pin: '1647', role: 'area_manager' },
  'محمدكلو': { pin: '4891', role: 'area_manager' },
  'منطقة الطائف': { pin: '6342', role: 'general_manager' },
};

// Only create DB pool if NOT on Vercel (local development)
let authPool: Pool | null = null;

if (!isVercel) {
  // Local development: try to connect to DB
  const requiredEnvVars = {
    PG_HOST: process.env.PG_HOST || 'localhost',
    PG_DATABASE: process.env.PG_DATABASE || 'showroom_sales',
    PG_USER: process.env.PG_USER || 'postgres',
    PG_PASSWORD: process.env.PG_PASSWORD || 'KhaKha11@',
    PG_PORT: process.env.PG_PORT || '5432',
  };

  try {
    authPool = new Pool({
      host: requiredEnvVars.PG_HOST,
      database: requiredEnvVars.PG_DATABASE,
      user: requiredEnvVars.PG_USER,
      password: requiredEnvVars.PG_PASSWORD,
      port: parseInt(requiredEnvVars.PG_PORT),
      ssl: false, // Local DB
    });
    console.log('✅ Local DB pool created (will try DB first, then fallback)');
  } catch (error) {
    console.warn('⚠️ Could not create DB pool, will use fallback pins only:', error);
    authPool = null;
  }
} else {
  console.log('🌐 Running on Vercel - using fallback pins only (no DB connection)');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS (kept minimal here – full CORS is also handled at the gateway / vercel.json level)
  const allowedOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { username, pin } = (req.body || {}) as { username?: string; pin?: string };
  if (!username || !pin) {
    res.status(400).json({ error: 'Missing credentials' });
    return;
  }

  // On Vercel: use fallback pins only (no DB connection)
  if (isVercel) {
    const fb = fallbackPins[username];
    if (!fb || fb.pin !== String(pin)) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const normalizedRole =
      fb.role.toLowerCase() as 'employee' | 'store_manager' | 'area_manager' | 'general_manager' | 'admin';

    const user = {
      id: username.replace(/\s+/g, '_'),
      name: username,
      displayName: username,
      role: normalizedRole,
    };

    return res.status(200).json({ success: true, user });
  }

  // Local development: try DB first, then fallback
  if (authPool) {
    try {
      const client = await authPool.connect();
      try {
        const result = await client.query(
          'SELECT id, username, password, role, display_name FROM public.users WHERE username = $1 LIMIT 1',
          [username]
        );

        // If found in DB, use it
        if (result.rowCount > 0) {
          const row = result.rows[0];
          const storedPassword = String(row.password || '');

          if (storedPassword !== String(pin)) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
          }

          const name = row.display_name || row.username;
          const rawRole = (row.role || 'employee') as string;
          const normalizedRole =
            rawRole.toLowerCase() as 'employee' | 'store_manager' | 'area_manager' | 'general_manager' | 'admin';

          const user = {
            id: String(row.id),
            name,
            displayName: name,
            role: normalizedRole,
          };

          return res.status(200).json({ success: true, user });
        }
      } finally {
        client.release();
      }
    } catch (dbError: any) {
      console.warn('⚠️ DB connection failed, using fallback pins:', dbError.message);
      // Fall through to fallback pins
    }
  }

  // Fallback to hardcoded pins (if DB not available or user not found)
  const fb = fallbackPins[username];
  if (!fb || fb.pin !== String(pin)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const normalizedRole =
    fb.role.toLowerCase() as 'employee' | 'store_manager' | 'area_manager' | 'general_manager' | 'admin';

  const user = {
    id: username.replace(/\s+/g, '_'),
    name: username,
    displayName: username,
    role: normalizedRole,
  };

  res.status(200).json({ success: true, user });
}

