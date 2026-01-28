import type { VercelRequest, VercelResponse } from '@vercel/node';
import { apiGatewayHandler } from './_lib/apiHandler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return apiGatewayHandler(req, res);
}

