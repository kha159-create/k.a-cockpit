import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getHybridSalesData } from './data-providers';

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
    // Parse query parameters
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const monthParam = req.query.month as string | undefined;
    const month = monthParam !== undefined ? parseInt(monthParam) : undefined; // 0-11, optional
    const dayParam = req.query.day as string | undefined;
    const day = dayParam !== undefined ? parseInt(dayParam) : undefined; // 1-31, optional
    const storeId = req.query.storeId as string | undefined;
    const employeeId = req.query.employeeId as string | undefined;

    // Use hybrid resolver (automatically selects Legacy for 2024/2025, D365 for 2026+)
    const result = await getHybridSalesData(year, month, day, storeId, employeeId);

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('❌ Error in /api/sales:', error);
    // Never crash - return consistent error response
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    return res.status(500).json({
      success: false,
      range: {
        from: new Date(year, 0, 1).toISOString().split('T')[0],
        to: new Date(year, 11, 31).toISOString().split('T')[0],
        year,
      },
      byStore: [],
      byEmployee: [],
      totals: {
        salesAmount: 0,
        invoices: 0,
        kpis: { atv: 0, customerValue: 0 },
      },
      debug: {
        source: year <= 2025 ? 'legacy' : 'd365',
        notes: [`Error: ${error.message}`, `Stack: ${error.stack?.substring(0, 200)}`],
      },
    });
  }
}
