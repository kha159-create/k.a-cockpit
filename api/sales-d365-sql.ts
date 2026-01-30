/**
 * D365 Sales API - Reads from PostgreSQL (dynamic_sales_bills and dynamic_sales_items)
 * This is the unified SQL source for all sales data (2024-2025 from gofrugal, 2026+ from dynamic)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';

// Check if running on Vercel
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

// Only create DB pool if NOT on Vercel (local development)
// On Vercel, this API should only work if there's a remote database
let pool: Pool | null = null;

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
    pool = new Pool({
      host: requiredEnvVars.PG_HOST,
      database: requiredEnvVars.PG_DATABASE,
      user: requiredEnvVars.PG_USER,
      password: requiredEnvVars.PG_PASSWORD,
      port: parseInt(requiredEnvVars.PG_PORT),
      ssl: false, // Local DB
    });
    console.log('✅ Local DB pool created for sales-d365-sql');
  } catch (error) {
    console.warn('⚠️ Could not create DB pool:', error);
    pool = null;
  }
} else {
  // On Vercel: only create pool if remote DB credentials are provided
  const requiredEnvVars = {
    PG_HOST: process.env.PG_HOST,
    PG_DATABASE: process.env.PG_DATABASE,
    PG_USER: process.env.PG_USER,
    PG_PASSWORD: process.env.PG_PASSWORD,
    PG_PORT: process.env.PG_PORT,
  };

  // Only create pool if all vars are set (remote DB)
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
      console.log('✅ Remote DB pool created for sales-d365-sql on Vercel');
    } catch (error) {
      console.warn('⚠️ Could not create remote DB pool:', error);
      pool = null;
    }
  } else {
    console.log('🌐 Running on Vercel - sales-d365-sql will return empty data (no remote DB configured)');
  }
}

const LOCAL_DATA_DIRS = [
  path.join(process.cwd(), 'public', 'data'),
  path.join(process.cwd(), 'data'),
  path.join(process.cwd(), 'k.a-cockpit', 'data'),
  process.cwd(),
];

async function readLocalJson(fileName: string): Promise<any | null> {
  const candidatePaths = LOCAL_DATA_DIRS.map(dir => path.join(dir, fileName));

  for (const filePath of candidatePaths) {
    try {
      const contents = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(contents);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        console.warn(`⚠️ Failed reading ${filePath}:`, error?.message || error);
      }
    }
  }

  return null;
}

// Load store mapping from SQL (no external hosts)
async function loadStoreMapping(): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  
  try {
    if (!pool) {
      console.warn('⚠️ No DB pool available for store mapping');
      return mapping;
    }

    console.log('📥 Loading store mapping from PostgreSQL...');
    const result = await pool.query(`
      SELECT store_id, name
      FROM stores
      WHERE is_active = TRUE
    `);

    result.rows.forEach((row: any) => {
      const storeId = String(row.store_id || '').trim();
      const storeName = String(row.name || '').trim();
      if (storeId && storeName) {
        mapping.set(storeId, storeName);
      }
    });

    console.log(`✅ Loaded ${mapping.size} store mappings from SQL`);
  } catch (error: any) {
    console.error('❌ Error loading store mapping:', error.message);
  }

  return mapping;
}

// Load employees_data.json from local JSON (no external hosts)
async function loadEmployeesData(): Promise<{ [storeId: string]: any[][] }> {
  try {
    console.log('📥 Loading employees_data.json from local disk...');
    const data = await readLocalJson('employees_data.json');
    if (!data) {
      console.warn('⚠️ employees_data.json not found locally');
      return {};
    }
    console.log(`✅ Loaded employees data for ${Object.keys(data).length} stores`);
    return data as { [storeId: string]: any[][] };
  } catch (error: any) {
    console.error('❌ Error loading employees_data.json:', error.message);
    return {};
  }
}

// Load targets and visitors from local JSON (no external hosts)
interface ManagementData {
  targets?: {
    [year: string]: {
      [storeId: string]: {
        [month: string]: number;
      };
    };
  };
  visitors?: Array<[string, string, number]>;
}

let cachedManagementData: ManagementData | null = null;

async function loadTargetsAndVisitors(): Promise<{ targets: ManagementData['targets']; visitors: ManagementData['visitors'] }> {
  if (cachedManagementData) {
    return {
      targets: cachedManagementData.targets || {},
      visitors: cachedManagementData.visitors || [],
    };
  }

  try {
    console.log('📥 Loading targets and visitors from local management_data.json...');
    const data = await readLocalJson('management_data.json');
    if (!data) {
      console.warn('⚠️ management_data.json not found locally');
      return { targets: {}, visitors: [] };
    }

    cachedManagementData = data as ManagementData;
    return {
      targets: cachedManagementData.targets || {},
      visitors: cachedManagementData.visitors || [],
    };
  } catch (error: any) {
    console.error('❌ Error loading management_data.json:', error.message);
    return { targets: {}, visitors: [] };
  }
}

function getQueryParam(req: VercelRequest, key: string): string | undefined {
  try {
    const url = new URL(req.url || '', 'http://localhost');
    const value = url.searchParams.get(key);
    if (value !== null) return value;
  } catch {
    // Ignore URL parse errors
  }
  const raw = req.query?.[key];
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === 'string' ? raw : undefined;
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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // On Vercel without DB: return empty data
  if (!pool) {
    const year = parseInt(getQueryParam(req, 'year') || '') || new Date().getFullYear();
    console.log('⚠️ sales-d365-sql: No DB connection, returning empty data');
    
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    
    return res.status(200).json({
      success: true,
      range: {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0],
        year,
      },
      byStore: [],
      byDay: [],
      byEmployee: [],
      totals: { salesAmount: 0, invoices: 0, kpis: { atv: 0, customerValue: 0 } },
      debug: {
        source: 'vercel-empty',
        notes: ['D365 SQL API requires database connection. Data for 2024-2025 available via /api/read-json-data'],
      },
    });
  }

  try {
    const year = parseInt(getQueryParam(req, 'year') || '') || new Date().getFullYear();
    const monthParam = getQueryParam(req, 'month');
    let month: number | undefined;
    if (monthParam !== undefined) {
      month = parseInt(monthParam);
      if (isNaN(month) || month < 0 || month > 11) {
        return res.status(400).json({
          success: false,
          error: `Invalid month parameter: ${monthParam}. Expected 0-11`,
        });
      }
    }
    
    const dayParam = getQueryParam(req, 'day');
    let day: number | undefined;
    if (dayParam !== undefined) {
      day = parseInt(dayParam);
      if (isNaN(day) || day < 1 || day > 31) {
        return res.status(400).json({
          success: false,
          error: `Invalid day parameter: ${dayParam}. Expected 1-31`,
        });
      }
    }
    
    const storeId = getQueryParam(req, 'storeId');

    console.log(`📊 D365 SQL Sales API: year=${year}, month=${month !== undefined ? month + 1 : 'all'}, day=${day || 'all'}, storeId=${storeId || 'all'}`);

    // Only support 2026+ (2024-2025 handled by sales-pg.ts / read-json-data)
    if (year < 2026) {
      return res.status(200).json({
        success: true,
        range: {
          from: new Date(year, 0, 1).toISOString().split('T')[0],
          to: new Date(year, 11, 31).toISOString().split('T')[0],
          year,
        },
        byStore: [],
        byDay: [],
        byEmployee: [],
        totals: { salesAmount: 0, invoices: 0, kpis: { atv: 0, customerValue: 0 } },
        debug: { source: 'sql-d365', notes: ['Year < 2026: use sales-pg.ts'] },
      });
    }

    // Calculate date range
    const startDate = new Date(Date.UTC(year, month || 0, day || 1, 0, 0, 0));
    let endDate: Date;
    if (month !== undefined) {
      if (day !== undefined) {
        endDate = new Date(Date.UTC(year, month, day, 23, 59, 59));
      } else {
        const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
        endDate = new Date(Date.UTC(
          lastDayOfMonth.getUTCFullYear(),
          lastDayOfMonth.getUTCMonth(),
          lastDayOfMonth.getUTCDate(),
          23, 59, 59
        ));
      }
    } else {
      endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    }

    console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Load store mapping and employees data in parallel
    const [storeMapping, employeesData, targetsAndVisitors] = await Promise.all([
      loadStoreMapping(),
      loadEmployeesData(),
      loadTargetsAndVisitors(),
    ]);

    // Query dynamic_sales_bills from SQL
    let billsQuery = `
      SELECT 
        store_number,
        bill_date,
        SUM(payment_amount) as total_sales,
        COUNT(*) as invoice_count
      FROM dynamic_sales_bills
      WHERE bill_date >= $1 AND bill_date <= $2
    `;
    const queryParams: any[] = [startDate, endDate];
    let paramIndex = 3;

    if (storeId) {
      billsQuery += ` AND store_number = $${paramIndex}`;
      queryParams.push(storeId);
      paramIndex++;
    }

    billsQuery += ` GROUP BY store_number, bill_date ORDER BY bill_date, store_number`;

    console.log(`🔍 Querying dynamic_sales_bills from SQL...`);
    const billsResult = await pool.query(billsQuery, queryParams);
    console.log(`✅ Found ${billsResult.rows.length} bill records in SQL`);

    // Aggregate by store and by day
    const dailyStoreMap = new Map<string, { salesAmount: number; invoices: number }>();
    const monthlyStoreMap = new Map<string, { salesAmount: number; invoices: number }>();

    billsResult.rows.forEach((row) => {
      const storeId = row.store_number;
      const dateStr = row.bill_date.toISOString().split('T')[0];
      const salesAmount = Number(row.total_sales) || 0;
      const invoices = Number(row.invoice_count) || 0;

      // Daily aggregation
      const dailyKey = `${dateStr}_${storeId}`;
      if (!dailyStoreMap.has(dailyKey)) {
        dailyStoreMap.set(dailyKey, { salesAmount: 0, invoices: 0 });
      }
      const dailyData = dailyStoreMap.get(dailyKey)!;
      dailyData.salesAmount += salesAmount;
      dailyData.invoices += invoices;

      // Monthly aggregation
      if (!monthlyStoreMap.has(storeId)) {
        monthlyStoreMap.set(storeId, { salesAmount: 0, invoices: 0 });
      }
      const monthlyData = monthlyStoreMap.get(storeId)!;
      monthlyData.salesAmount += salesAmount;
      monthlyData.invoices += invoices;
    });

    // Build byStore array
    const byStore = Array.from(monthlyStoreMap.entries()).map(([storeId, data]) => {
      const storeName = storeMapping.get(storeId) || storeId;
      const yearKey = String(year);
      const monthKey = month !== undefined ? String(month + 1) : 'all';
      const target = targetsAndVisitors.targets?.[yearKey]?.[storeId]?.[monthKey] || 0;
      const monthlyVisitors = (targetsAndVisitors.visitors || []).reduce((sum, [date, sid, count]) => {
        if (sid === storeId && date >= startDate.toISOString().split('T')[0] && date <= endDate.toISOString().split('T')[0]) {
          return sum + (Number(count) || 0);
        }
        return sum;
      }, 0);
      const conversion = monthlyVisitors > 0 ? (data.invoices / monthlyVisitors) * 100 : 0;

      return {
        storeId,
        storeName,
        salesAmount: data.salesAmount,
        invoices: data.invoices,
        visitors: monthlyVisitors,
        target: Number(target) || 0,
        kpis: {
          atv: data.invoices > 0 ? data.salesAmount / data.invoices : 0,
          customerValue: data.invoices > 0 ? data.salesAmount / data.invoices : 0,
          conversion,
        },
      };
    });

    // Build byDay array
    const dateMap = new Map<string, any[]>();
    dailyStoreMap.forEach((data, key) => {
      const [dateStr, storeId] = key.split('_');
      const storeName = storeMapping.get(storeId) || storeId;
      const dailyVisitors = (targetsAndVisitors.visitors || []).reduce((sum, [date, sid, count]) => {
        if (sid === storeId && date === dateStr) {
          return sum + (Number(count) || 0);
        }
        return sum;
      }, 0);
      const conversion = dailyVisitors > 0 ? (data.invoices / dailyVisitors) * 100 : 0;

      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, []);
      }
      dateMap.get(dateStr)!.push({
        storeId,
        storeName,
        salesAmount: data.salesAmount,
        invoices: data.invoices,
        visitors: dailyVisitors,
        kpis: {
          atv: data.invoices > 0 ? data.salesAmount / data.invoices : 0,
          customerValue: data.invoices > 0 ? data.salesAmount / data.invoices : 0,
          conversion,
        },
      });
    });

    const byDay = Array.from(dateMap.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, stores]) => ({ date, byStore: stores }));

    // Build byEmployee from employees_data.json
    const byEmployee: any[] = [];
    if (employeesData && Object.keys(employeesData).length > 0) {
      const employeeMap = new Map<string, {
        employeeId: string;
        employeeName: string;
        storeId: string;
        storeName: string;
        salesAmount: number;
        invoices: number;
      }>();

      Object.entries(employeesData).forEach(([storeId, entries]) => {
        if (!Array.isArray(entries)) return;
        const storeName = storeMapping.get(storeId) || storeId;

        entries.forEach((entry) => {
          if (!Array.isArray(entry) || entry.length < 2) return;
          const dateStr = String(entry[0] || '').trim();
          const employeeName = String(entry[1] || '').trim();
          
          if (!employeeName) return;

          // Check if date is in range
          try {
            const entryDate = new Date(dateStr + 'T00:00:00Z');
            if (entryDate < startDate || entryDate > endDate) return;
          } catch {
            return;
          }

          const employeeIdMatch = employeeName.match(/^(\d+)[-_\s]/);
          const employeeId = employeeIdMatch ? employeeIdMatch[1] : employeeName;
          const key = `${storeId}_${employeeId}`;

          if (!employeeMap.has(key)) {
            employeeMap.set(key, {
              employeeId,
              employeeName,
              storeId,
              storeName,
              salesAmount: 0,
              invoices: 0,
            });
          }

          const emp = employeeMap.get(key)!;
          emp.salesAmount += Number(entry[2] || 0);
          emp.invoices += Number(entry[3] || 0);
        });
      });

      byEmployee.push(...Array.from(employeeMap.values()).map(emp => ({
        ...emp,
        kpis: {
          atv: emp.invoices > 0 ? emp.salesAmount / emp.invoices : 0,
          customerValue: emp.invoices > 0 ? emp.salesAmount / emp.invoices : 0,
        },
      })));
    }

    // Calculate totals
    const totalSales = byStore.reduce((sum, s) => sum + s.salesAmount, 0);
    const totalInvoices = byStore.reduce((sum, s) => sum + s.invoices, 0);
    const totalVisitors = byStore.reduce((sum, s) => sum + (s.visitors || 0), 0);
    const totalTarget = byStore.reduce((sum, s) => sum + (s.target || 0), 0);

    const totals = {
      salesAmount: totalSales,
      invoices: totalInvoices,
      visitors: totalVisitors,
      target: totalTarget,
      kpis: {
        atv: totalInvoices > 0 ? totalSales / totalInvoices : 0,
        customerValue: totalInvoices > 0 ? totalSales / totalInvoices : 0,
        conversion: totalVisitors > 0 ? (totalInvoices / totalVisitors) * 100 : 0,
      },
    };

    console.log(`✅ Aggregated: ${byStore.length} stores, ${byDay.length} days, ${byEmployee.length} employees`);

    return res.status(200).json({
      success: true,
      range: {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0],
        year,
        ...(month !== undefined && { month: month + 1 }),
        ...(day !== undefined && { day }),
      },
      byStore,
      byDay,
      byEmployee,
      totals,
      debug: {
        source: 'sql-d365',
        notes: [
          `SQL: ${billsResult.rows.length} bill records`,
          `Stores: ${byStore.length}`,
          `Daily breakdown: ${byDay.length} days`,
          `Employees: ${byEmployee.length}`,
        ],
      },
    });

  } catch (error: any) {
    console.error('❌ D365 SQL Sales API error:', error);
    const year = parseInt(getQueryParam(req, 'year') || '') || new Date().getFullYear();
    const monthParam = getQueryParam(req, 'month');
    const month = monthParam !== undefined ? parseInt(monthParam) : undefined;
    const dayParam = getQueryParam(req, 'day');
    const day = dayParam !== undefined ? parseInt(dayParam) : undefined;

    const startDate = new Date(Date.UTC(year, month || 0, day || 1, 0, 0, 0));
    let endDate: Date;
    if (month !== undefined) {
      if (day !== undefined) {
        endDate = new Date(Date.UTC(year, month, day, 23, 59, 59));
      } else {
        const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
        endDate = new Date(Date.UTC(
          lastDayOfMonth.getUTCFullYear(),
          lastDayOfMonth.getUTCMonth(),
          lastDayOfMonth.getUTCDate(),
          23, 59, 59
        ));
      }
    } else {
      endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    }

    return res.status(200).json({
      success: false,
      range: {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0],
        year,
        ...(month !== undefined && { month: month + 1 }),
        ...(day !== undefined && { day }),
      },
      byStore: [],
      byDay: [],
      byEmployee: [],
      totals: { salesAmount: 0, invoices: 0, visitors: 0, target: 0, kpis: { atv: 0, customerValue: 0, conversion: 0 } },
      debug: {
        source: 'sql-d365',
        notes: [`SQL connection failed: ${error.message}`],
      },
    });
  }
}
