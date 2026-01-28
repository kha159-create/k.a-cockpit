import type { VercelRequest, VercelResponse } from '@vercel/node';
import gatewayHandler from './[...route]';

// Thin wrapper so Vercel exposes /api/auth-sql
// while all logic (CORS + DB + fallback pins) lives in the gateway.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return gatewayHandler(req, res);
}

