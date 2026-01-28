/**
 * PostgreSQL Sales API - Replaces legacy file-based data for 2024-2025
 * Reads from gofrugal_sales and gofrugal_item_sales tables
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

// PostgreSQL connection pool
// Validate required environment variables (fail fast in production)
const requiredEnvVars = {
  PG_HOST: process.env.PG_HOST,
  PG_DATABASE: process.env.PG_DATABASE,
  PG_USER: process.env.PG_USER,
  PG_PASSWORD: process.env.PG_PASSWORD,
  PG_PORT: process.env.PG_PORT,
};

// Debug logging (safe - does not expose passwords)
console.log('🔍 DB Config Check (sales-pg):', {
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

const pool = new Pool({
  host: requiredEnvVars.PG_HOST,
  database: requiredEnvVars.PG_DATABASE,
  user: requiredEnvVars.PG_USER,
  password: requiredEnvVars.PG_PASSWORD,
  port: parseInt(requiredEnvVars.PG_PORT || '5432'),
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

interface SalesRow {
  outlet_name: string;
  bill_no: string;
  bill_date: Date;
  net_amount: number;
  transaction_type: string | null;
  salesman: string | null;
}

interface EmployeeStoreMapping {
  employee_name: string;
  outlet_name: string;
}

interface ItemSalesRow {
  outlet_name: string;
  bill_no: string;
  bill_date: Date;
  item_code: string;
  item_name: string;
  quantity: number;
  net_amount: number;
  salesman_name: string | null;
}

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
    const year = parseInt(req.query.year as string);
    const month = req.query.month !== undefined ? parseInt(req.query.month as string) : undefined; // API expects 0-11
    const day = req.query.day ? parseInt(req.query.day as string) : undefined;
    const storeId = req.query.storeId as string | undefined;

    if (!year || isNaN(year)) {
      return res.status(400).json({ error: 'year parameter is required (YYYY format)' });
    }

    // Allow any year (2024-2025 from gofrugal_sales, 2026+ can use this too if data exists)
    // Remove year restriction to allow flexibility

    console.log(`📊 PostgreSQL Sales API: year=${year}, month=${month !== undefined ? month + 1 : 'all'}, day=${day || 'all'}, storeId=${storeId || 'all'}`);

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

    // Load store mapping FIRST (needed for storeId filtering)
    const storeMappingResult = await pool.query(`
      SELECT outlet_name, dynamic_number, area_manager, city
      FROM gofrugal_outlets_mapping
      WHERE dynamic_number IS NOT NULL
    `);
    const storeMapping = new Map<string, { name: string; number: string | null; areaManager: string | null; city: string | null }>();
    const outletNameToStoreId = new Map<string, string>(); // outlet_name -> dynamic_number (storeId)

    storeMappingResult.rows.forEach(row => {
      const outletName = row.outlet_name;
      const storeId = row.dynamic_number; // dynamic_number is the Store Number (OperatingUnitNumber)

      storeMapping.set(outletName, {
        name: outletName,
        number: storeId,
        areaManager: row.area_manager,
        city: row.city,
      });

      // Map outlet_name to storeId (dynamic_number) for matching
      outletNameToStoreId.set(outletName, storeId);
    });
    console.log(`✅ Loaded ${storeMapping.size} store mappings (using dynamic_number as storeId)`);

    // NOTE: Employee-store mapping removed - not needed for response, employee data comes from aggregation query

    // Load targets and visitors
    const targetsQuery = `
      SELECT outlet_name, target_amount, year, month
      FROM gofrugal_targets
      WHERE year = $1 AND (month = $2 OR $2 IS NULL)
    `;
    const targetsParams = [year, month !== undefined ? month + 1 : null]; // month is 0-11 from API, DB expects 1-12
    const targetsResult = await pool.query(targetsQuery, targetsParams);
    const targetsMap = new Map<string, Map<number, number>>(); // Key: outlet_name, Value: Map<month, target_amount>
    targetsResult.rows.forEach(row => {
      const outletName = row.outlet_name;
      const targetMonth = row.month || 0; // 0 = yearly target
      const targetAmount = Number(row.target_amount) || 0;
      
      if (!targetsMap.has(outletName)) {
        targetsMap.set(outletName, new Map());
      }
      targetsMap.get(outletName)!.set(targetMonth, targetAmount);
    });
    console.log(`✅ Loaded ${targetsMap.size} outlet targets`);

    const visitorsQuery = `
      SELECT outlet_name, visit_date, visitor_count
      FROM gofrugal_visitors
      WHERE visit_date >= $1 AND visit_date <= $2
    `;
    const visitorsParams = [startDate, endDate];
    const visitorsResult = await pool.query(visitorsQuery, visitorsParams);
    const monthlyVisitorsMap = new Map<string, number>(); // Key: outlet_name
    const dailyVisitorsMap = new Map<string, number>(); // Key: "YYYY-MM-DD_OUTLET_NAME"
    visitorsResult.rows.forEach(row => {
      const outletName = row.outlet_name;
      const dateStr = row.visit_date.toISOString().split('T')[0];
      
      // Monthly
      const currentMonthlyCount = monthlyVisitorsMap.get(outletName) || 0;
      monthlyVisitorsMap.set(outletName, currentMonthlyCount + (Number(row.visitor_count) || 0));

      // Daily
      const dailyKey = `${dateStr}_${outletName}`;
      const currentDailyCount = dailyVisitorsMap.get(dailyKey) || 0;
      dailyVisitorsMap.set(dailyKey, currentDailyCount + (Number(row.visitor_count) || 0));
    });
    console.log(`✅ Loaded ${visitorsResult.rows.length} visitor entries`);

    // --- OPTIMIZED QUERY: Aggregation at DB Level ---

    // 1. Store Aggregation
    let storeQuery = `
      SELECT 
        outlet_name, 
        SUM(net_amount) as total_sales, 
        COUNT(*) as invoice_count 
      FROM gofrugal_sales 
      WHERE bill_date >= $1 AND bill_date <= $2
    `;
    const queryParams: any[] = [startDate, endDate];
    let paramIndex = 3;

    if (storeId) {
      // Resolve storeId to outlet_name
      let targetOutletName = storeId;
      for (const [outletName, dynamicNum] of outletNameToStoreId.entries()) {
        if (dynamicNum === storeId || outletName === storeId) {
          targetOutletName = outletName;
          break;
        }
      }
      storeQuery += ` AND outlet_name = $${paramIndex}`;
      queryParams.push(targetOutletName);
      paramIndex++;
    }

    storeQuery += ` GROUP BY outlet_name`;

    // 2. Daily Aggregation
    // To minimize payload, we only group by date and outlet
    let dailyQuery = `
      SELECT 
        DATE(bill_date) as date_str, 
        outlet_name, 
        SUM(net_amount) as total_sales, 
        COUNT(*) as invoice_count 
      FROM gofrugal_sales 
      WHERE bill_date >= $1 AND bill_date <= $2
    `;
    // Reuse params 1 & 2 (startDate, endDate)
    const dailyParams: any[] = [startDate, endDate];
    let dailyParamIndex = 3;
    if (storeId && queryParams.length > 2) { // Logic to match storeId filter if active
      dailyQuery += ` AND outlet_name = $${dailyParamIndex}`;
      dailyParams.push(queryParams[2]); // The targetOutletName
    }
    dailyQuery += ` GROUP BY DATE(bill_date), outlet_name ORDER BY date_str`;

    // 3. Employee Aggregation
    let empQuery = `
      SELECT 
        salesman,
        outlet_name,
        SUM(net_amount) as total_sales, 
        COUNT(*) as invoice_count 
      FROM gofrugal_sales 
      WHERE bill_date >= $1 AND bill_date <= $2 
        AND salesman IS NOT NULL AND salesman != ''
    `;
    const empParams: any[] = [startDate, endDate];
    if (storeId && queryParams.length > 2) {
      empQuery += ` AND outlet_name = $3`;
      empParams.push(queryParams[2]);
    }
    empQuery += ` GROUP BY salesman, outlet_name`;


    console.log(`🔍 Executing Optimized SQL Queries...`);
    const [storeRes, dailyRes, empRes] = await Promise.all([
      pool.query(storeQuery, queryParams),
      pool.query(dailyQuery, dailyParams),
      pool.query(empQuery, empParams)
    ]);

    console.log(`✅ Fetched: ${storeRes.rowCount} store stats, ${dailyRes.rowCount} daily stats, ${empRes.rowCount} emp stats`);


    // --- Post-Processing (Lightweight Map Operations) ---

    // Process Store Data
    const byStore = storeRes.rows.map(row => {
      const outletName = row.outlet_name;
      const storeId = outletNameToStoreId.get(outletName) || outletName;
      const storeInfo = storeMapping.get(outletName);

      const salesAmount = Number(row.total_sales);
      const invoices = Number(row.invoice_count);

      // Get target
      const outletTargets = targetsMap.get(outletName);
      const targetMonth = month !== undefined ? month + 1 : null;
      const target = outletTargets?.get(targetMonth || 0) || outletTargets?.get(0) || 0;

      // Get visitors
      const visitors = monthlyVisitorsMap.get(outletName) || 0;
      const conversion = visitors > 0 ? (invoices / visitors) * 100 : 0;

      return {
        storeId,
        storeName: storeInfo?.name || outletName,
        salesAmount,
        invoices,
        visitors,
        target: Number(target) || 0,
        kpis: {
          atv: invoices > 0 ? salesAmount / invoices : 0,
          customerValue: invoices > 0 ? salesAmount / invoices : 0,
          conversion,
        },
      };
    });

    // Process Daily Data (Reconstruct logical structure)
    // Map: Date -> Store[]
    const dateMap = new Map<string, any[]>();

    dailyRes.rows.forEach(row => {
      // Fix timezone offset for DATE() string if needed, generally pg returns YYYY-MM-DD
      const dateStr = new Date(row.date_str).toISOString().split('T')[0];
      const outletName = row.outlet_name;
      const storeId = outletNameToStoreId.get(outletName) || outletName;
      const storeInfo = storeMapping.get(outletName);

      const salesAmount = Number(row.total_sales);
      const invoices = Number(row.invoice_count);

      // Daily visitors
      const dateKey = `${dateStr}_${outletName}`;
      const visitors = dailyVisitorsMap.get(dateKey) || 0;
      const conversion = visitors > 0 ? (invoices / visitors) * 100 : 0;

      const entry = {
        storeId,
        storeName: storeInfo?.name || outletName || storeId,
        salesAmount,
        invoices,
        visitors,
        kpis: {
          atv: invoices > 0 ? salesAmount / invoices : 0,
          customerValue: invoices > 0 ? salesAmount / invoices : 0,
          conversion,
        },
      };

      if (!dateMap.has(dateStr)) dateMap.set(dateStr, []);
      dateMap.get(dateStr)!.push(entry);
    });

    const byDay = Array.from(dateMap.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, stores]) => ({
        date,
        byStore: stores
      }));

    // Process Employee Data
    const byEmployee = empRes.rows.map(row => {
      const salesman = row.salesman;
      const outletName = row.outlet_name;
      const storeId = outletNameToStoreId.get(outletName) || outletName;
      const storeInfo = storeMapping.get(outletName);

      const salesAmount = Number(row.total_sales);
      const invoices = Number(row.invoice_count);

      return {
        employeeId: salesman.split(/[-_]/)[0] || salesman,
        employeeName: salesman,
        storeId,
        storeName: storeInfo?.name || outletName,
        salesAmount,
        invoices,
        kpis: {
          atv: invoices > 0 ? salesAmount / invoices : 0,
          customerValue: invoices > 0 ? salesAmount / invoices : 0,
        },
      };
    });


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

    console.log(`✅ Aggregated: ${byStore.length} stores, ${byDay.length} days, ${totals.invoices} invoices, ${totals.salesAmount.toFixed(2)} total sales`);

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
        source: 'postgresql',
        notes: [
          `PostgreSQL: ${storeRes.rowCount} store aggregations, ${dailyRes.rowCount} daily aggregations, ${empRes.rowCount} employee aggregations`,
          `Stores: ${byStore.length}`,
          `Employees: ${byEmployee.length}`,
          `Targets: ${targetsResult.rows.length} records`,
          `Visitors: ${visitorsResult.rows.length} records`,
          `Daily breakdown: ${byDay.length} days`,
        ],
      },
    });

  } catch (error: any) {
    console.error('❌ PostgreSQL Sales API error:', error);

    // Return 200 with error flag (not 500) so frontend can handle fallback gracefully
    // Frontend will automatically fallback to legacy provider
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month as string) - 1 : undefined;
    const day = req.query.day ? parseInt(req.query.day as string) : undefined;

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
      totals: { salesAmount: 0, invoices: 0, kpis: { atv: 0, customerValue: 0 } },
      debug: {
        source: 'postgresql',
        notes: [`PostgreSQL connection failed: ${error.message}`, `Frontend will use legacy fallback`],
      },
    });
  }
}
