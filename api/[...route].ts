import type { VercelRequest, VercelResponse } from '@vercel/node';

import salesPgHandler from './sales-pg';
import salesD365SqlHandler from './sales-d365-sql';
import liveSalesHandler from './live-sales';
import getStoresHandler from './get-stores';
import getEmployeesHandler from './get-employees';
import getEmployeeMappingsHandler from './get-employee-mappings';
import getProductsHandler from './get-products';

type ApiHandler = (req: VercelRequest, res: VercelResponse) => any | Promise<any>;

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

