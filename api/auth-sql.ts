import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authSqlHandler } from './_lib/apiHandler';

// Dedicated entry for /api/auth-sql using shared handler logic.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return authSqlHandler(req, res);
}

