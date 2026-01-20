/**
 * PostgreSQL Sales API - Replaces legacy file-based data for 2024-2025
 * Reads from gofrugal_sales and gofrugal_item_sales tables
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'showroom_sales',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'KhaKha11@',
  port: parseInt(process.env.PG_PORT || '5432'),
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
    const month = req.query.month ? parseInt(req.query.month as string) - 1 : undefined; // Convert 1-12 to 0-11
    const day = req.query.day ? parseInt(req.query.day as string) : undefined;
    const storeId = req.query.storeId as string | undefined;

    if (!year || year < 2024 || year > 2025) {
      return res.status(400).json({
        success: false,
        error: 'Year must be between 2024 and 2025 for PostgreSQL data',
        range: { from: '', to: '', year },
        byStore: [],
        byEmployee: [],
        totals: { salesAmount: 0, invoices: 0, visitors: 0, target: 0, kpis: { atv: 0, customerValue: 0, conversion: 0 } },
        debug: { source: 'postgresql', notes: ['Invalid year'] },
      });
    }

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

    // Load employee-store mapping (for employee data)
    const employeeStoreMappingResult = await pool.query(`
      SELECT DISTINCT
        COALESCE(item_sales.salesman_name, sales.salesman) as employee_name,
        COALESCE(item_sales.outlet_name, sales.outlet_name) as outlet_name
      FROM gofrugal_item_sales item_sales
      FULL OUTER JOIN gofrugal_sales sales 
        ON item_sales.outlet_name = sales.outlet_name
      WHERE (
        (item_sales.salesman_name IS NOT NULL AND item_sales.salesman_name != '')
        OR (sales.salesman IS NOT NULL AND sales.salesman != '')
      )
      AND (
        (item_sales.outlet_name IS NOT NULL AND item_sales.outlet_name != '')
        OR (sales.outlet_name IS NOT NULL AND sales.outlet_name != '')
      )
    `);
    const employeeStoreMapping = new Map<string, Set<string>>(); // employee_name -> Set<outlet_name>
    employeeStoreMappingResult.rows.forEach(row => {
      const empName = row.employee_name;
      const outletName = row.outlet_name;
      if (empName && outletName) {
        if (!employeeStoreMapping.has(empName)) {
          employeeStoreMapping.set(empName, new Set());
        }
        employeeStoreMapping.get(empName)!.add(outletName);
      }
    });
    console.log(`✅ Loaded ${employeeStoreMapping.size} employee-store mappings`);

    // Build SQL query for gofrugal_sales
    let salesQuery = `
      SELECT 
        outlet_name,
        bill_no,
        bill_date,
        net_amount,
        transaction_type,
        salesman
      FROM gofrugal_sales
      WHERE bill_date >= $1 AND bill_date <= $2
    `;
    const queryParams: any[] = [startDate, endDate];
    let paramIndex = 3;

    // Handle storeId filter - convert dynamic_number to outlet_name if needed
    if (storeId) {
      // Find outlet_name by dynamic_number or direct match
      let targetOutletName = storeId;
      for (const [outletName, dynamicNum] of outletNameToStoreId.entries()) {
        if (dynamicNum === storeId || outletName === storeId) {
          targetOutletName = outletName;
          break;
        }
      }
      
      salesQuery += ` AND outlet_name = $${paramIndex}`;
      queryParams.push(targetOutletName);
      paramIndex++;
    }

    salesQuery += ` ORDER BY bill_date, outlet_name, bill_no`;

    console.log(`🔍 Executing sales query...`);
    const salesResult = await pool.query<SalesRow>(salesQuery, queryParams);
    const salesRows = salesResult.rows;
    console.log(`✅ Found ${salesRows.length} sales records`);

    // Aggregate by store
    const storeMap = new Map<string, {
      storeId: string;
      storeName: string;
      salesAmount: number;
      invoices: number;
    }>();

    // Aggregate by day and store
    const dayStoreMap = new Map<string, Map<string, {
      salesAmount: number;
      invoices: number;
    }>>();

    // Aggregate by employee and store
    const employeeMap = new Map<string, {
      employeeId: string;
      employeeName: string;
      storeId: string;
      storeName: string;
      salesAmount: number;
      invoices: number;
    }>();

    salesRows.forEach(row => {
      const outletName = row.outlet_name;
      // Use dynamic_number as storeId (matches OperatingUnitNumber from D365)
      const storeId = outletNameToStoreId.get(outletName) || outletName;
      const storeInfo = storeMapping.get(outletName);
      const storeName = storeInfo?.name || outletName;
      const dateStr = row.bill_date.toISOString().split('T')[0];
      const salesman = row.salesman || null;

      // Store-level aggregation
      if (!storeMap.has(storeId)) {
        storeMap.set(storeId, {
          storeId,
          storeName,
          salesAmount: 0,
          invoices: 0,
        });
      }
      const storeData = storeMap.get(storeId)!;
      storeData.salesAmount += row.net_amount || 0;
      storeData.invoices += 1;

      // Day-store aggregation
      if (!dayStoreMap.has(dateStr)) {
        dayStoreMap.set(dateStr, new Map());
      }
      const dayStores = dayStoreMap.get(dateStr)!;
      if (!dayStores.has(storeId)) {
        dayStores.set(storeId, {
          salesAmount: 0,
          invoices: 0,
        });
      }
      const dayStoreData = dayStores.get(storeId)!;
      dayStoreData.salesAmount += row.net_amount || 0;
      dayStoreData.invoices += 1;

      // Employee-level aggregation (if salesman exists)
      if (salesman && salesman.trim() !== '') {
        const employeeKey = `${salesman}_${storeId}`;
        if (!employeeMap.has(employeeKey)) {
          employeeMap.set(employeeKey, {
            employeeId: salesman.split(/[-_]/)[0] || salesman, // Extract ID if present
            employeeName: salesman,
            storeId,
            storeName,
            salesAmount: 0,
            invoices: 0,
          });
        }
        const employeeData = employeeMap.get(employeeKey)!;
        employeeData.salesAmount += row.net_amount || 0;
        employeeData.invoices += 1;
      }
    });

    // Convert to response format with targets and visitors
    const byStore = Array.from(storeMap.values()).map(store => {
      // Find outlet_name by storeId (dynamic_number)
      let outletName = '';
      for (const [outlet, dynamicNum] of outletNameToStoreId.entries()) {
        if (dynamicNum === store.storeId) {
          outletName = outlet;
          break;
        }
      }
      if (!outletName) {
        outletName = store.storeName;
      }
      
      // Get target for this outlet
      const outletTargets = targetsMap.get(outletName);
      const targetMonth = month !== undefined ? month + 1 : null;
      const target = outletTargets?.get(targetMonth || 0) || outletTargets?.get(0) || 0;
      
      // Get visitors for this outlet
      const visitors = monthlyVisitorsMap.get(outletName) || 0;
      const conversion = visitors > 0 ? (store.invoices / visitors) * 100 : 0;
      
      return {
        storeId: store.storeId,
        storeName: store.storeName,
        salesAmount: store.salesAmount,
        invoices: store.invoices,
        visitors,
        target: Number(target) || 0,
        kpis: {
          atv: store.invoices > 0 ? store.salesAmount / store.invoices : 0,
          customerValue: store.invoices > 0 ? store.salesAmount / store.invoices : 0,
          conversion,
        },
      };
    });

    const byDay = Array.from(dayStoreMap.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, stores]) => ({
        date,
        byStore: Array.from(stores.entries()).map(([storeId, data]) => {
          // Find outlet_name by storeId (dynamic_number)
          let outletName = '';
          for (const [outlet, dynamicNum] of outletNameToStoreId.entries()) {
            if (dynamicNum === storeId) {
              outletName = outlet;
              break;
            }
          }
          if (!outletName) {
            outletName = storeId;
          }
          const storeInfo = storeMapping.get(outletName);
          
          // Get visitors for this outlet on this day
          const dateKey = `${date}_${outletName}`;
          const visitors = dailyVisitorsMap.get(dateKey) || 0;
          const conversion = visitors > 0 ? (data.invoices / visitors) * 100 : 0;
          
          return {
            storeId,
            storeName: storeInfo?.name || outletName || storeId,
            salesAmount: data.salesAmount,
            invoices: data.invoices,
            visitors,
            kpis: {
              atv: data.invoices > 0 ? data.salesAmount / data.invoices : 0,
              customerValue: data.invoices > 0 ? data.salesAmount / data.invoices : 0,
              conversion,
            },
          };
        }),
      }));

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
      byEmployee: Array.from(employeeMap.values()).map(emp => ({
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        storeId: emp.storeId,
        storeName: emp.storeName,
        salesAmount: emp.salesAmount,
        invoices: emp.invoices,
        kpis: {
          atv: emp.invoices > 0 ? emp.salesAmount / emp.invoices : 0,
          customerValue: emp.invoices > 0 ? emp.salesAmount / emp.invoices : 0,
        },
      })),
      totals,
      debug: {
        source: 'postgresql',
        notes: [
          `PostgreSQL: ${salesRows.length} sales records`,
          `Stores: ${byStore.length}`,
          `Employees: ${employeeMap.size}`,
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
