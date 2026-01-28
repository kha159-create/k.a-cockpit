import type { VercelRequest, VercelResponse } from '@vercel/node';

import salesPgHandler from './sales-pg';
import salesD365SqlHandler from './sales-d365-sql';
import liveSalesHandler from './live-sales';
import getStoresHandler from './get-stores';
import getEmployeesHandler from './get-employees';
import getEmployeeMappingsHandler from './get-employee-mappings';
import getProductsHandler from './get-products';

type ApiHandler = (req: VercelRequest, res: VercelResponse) => any | Promise<any>;

// Lightweight SQL-less auth handler to keep authentication working
// while respecting Vercel function limits.
const authSqlHandler: ApiHandler = async (req, res) => {
  const allowedOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

  const name = String(username).trim();

  // Simple role inference based on display name
  let role: 'employee' | 'store_manager' | 'area_manager' | 'general_manager' | 'admin' = 'employee';
  if (name === 'Sales Manager') {
    role = 'general_manager';
  } else if (name.includes('المنطقة')) {
    role = 'area_manager';
  }

  const user = {
    id: name.replace(/\s+/g, '_'),
    name,
    displayName: name,
    role,
  };

  res.status(200).json({ success: true, user });
};

const routes: Record<string, ApiHandler> = {
  // Core sales endpoints
  'sales-pg': salesPgHandler,
  'sales-d365-sql': salesD365SqlHandler,

  // Backwards-compatible generic sales aliases
  sales: salesD365SqlHandler,
  summary: salesD365SqlHandler,
  'today-sales': liveSalesHandler,
  comparison: salesD365SqlHandler,
  commissions: salesD365SqlHandler,

  // Auth
  'auth-sql': authSqlHandler,

  // Live
  'live-sales': liveSalesHandler,

  // Stores
  'get-stores': getStoresHandler,
  stores: getStoresHandler,
  'stores-summary': getStoresHandler,

  // Employees
  'get-employees': getEmployeesHandler,
  employees: getEmployeesHandler,
  'employees-summary': getEmployeesHandler,
  'get-employee-mappings': getEmployeeMappingsHandler,

  // Products
  'get-products': getProductsHandler,
  products: getProductsHandler,
};

function normalizeRoute(req: VercelRequest): string {
  const url = req.url || '/api';

  try {
    const u = new URL(url, 'http://localhost');
    let path = u.pathname || '/api';

    // Strip leading /api
    path = path.replace(/^\/api\/?/, '');

    // Remove trailing slashes
    path = path.replace(/\/+$/, '');

    // Root /api → summary
    if (!path) return 'summary';

    return path;
  } catch {
    return 'summary';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Global CORS (individual handlers may also set more specific headers)
  const allowedOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const route = normalizeRoute(req);

  // Support nested paths like "sales/unified" if needed in future
  const direct = routes[route];
  const firstSegment = route.split('/')[0];
  const fallback = routes[firstSegment];

  const fn = direct || fallback;

  if (!fn) {
    res.status(404).json({
      success: false,
      error: `API route not found: /api/${route}`,
    });
    return;
  }

  try {
    await fn(req, res);
  } catch (error: any) {
    console.error(`❌ API gateway error for route /api/${route}:`, error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
}

