import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

// NOTE:
// -------
// This file is intentionally SELF-CONTAINED and does NOT import from ./_lib/apiHandler.
// Vercel was failing with ERR_MODULE_NOT_FOUND when api/auth-sql.ts tried to import
// a shared handler module. To make this endpoint 100% reliable on Vercel, we duplicate
// the auth logic here instead of importing it.
//
// The logic below mirrors the authSqlHandler from api/_lib/apiHandler.ts:
// - Uses PG_* env vars for connection (same as other APIs)
// - Reads from public.users table
// - Falls back to the hardcoded pins from the reference users.js file

// Validate required environment variables (fail fast in production)
const requiredEnvVars = {
  PG_HOST: process.env.PG_HOST,
  PG_DATABASE: process.env.PG_DATABASE,
  PG_USER: process.env.PG_USER,
  PG_PASSWORD: process.env.PG_PASSWORD,
  PG_PORT: process.env.PG_PORT,
};

// Debug logging (safe - does not expose passwords)
console.log('🔍 DB Config Check:', {
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

const authPool = new Pool({
  host: requiredEnvVars.PG_HOST,
  database: requiredEnvVars.PG_DATABASE,
  user: requiredEnvVars.PG_USER,
  password: requiredEnvVars.PG_PASSWORD,
  port: parseInt(requiredEnvVars.PG_PORT || '5432'),
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

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

  try {
    const client = await authPool.connect();
    try {
      const result = await client.query(
        'SELECT id, username, password, role, display_name FROM public.users WHERE username = $1 LIMIT 1',
        [username]
      );

      // Fallback to hardcoded users (reference project users.js) if not found in DB
      if (result.rowCount === 0) {
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
        return;
      }

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

      res.status(200).json({ success: true, user });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('❌ auth-sql error (standalone handler):', error);
    res.status(500).json({ error: error?.message || 'Auth failed' });
  }
}

