import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConfidentialClientApplication } from '@azure/msal-node';
import * as XLSX from 'xlsx';

interface D365Transaction {
  OperatingUnitNumber: string;
  PaymentAmount: number;
  TransactionDate: string;
  // Note: StaffId and StaffName are NOT available in RetailTransactions entity
  // Employee data must come from a different source/endpoint if needed
  [key: string]: any;
}

interface D365AggregatedGroup {
  OperatingUnitNumber: string;
  TransactionDate: string;
  TotalAmount: number; // Sum of PaymentAmount (server-side aggregated)
  InvoiceCount: number; // Count of transactions (server-side counted)
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.D365_CLIENT_ID;
  const clientSecret = process.env.D365_CLIENT_SECRET;
  const tenantId = process.env.D365_TENANT_ID;
  const d365Url = process.env.D365_URL || 'https://orangepax.operations.eu.dynamics.com';

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error('Missing D365 credentials');
  }

  const authority = `https://login.microsoftonline.com/${tenantId}`;
  const scope = `${d365Url}/.default`;

  const app = new ConfidentialClientApplication({
    auth: { clientId, clientSecret, authority },
  });

  const result = await app.acquireTokenByClientCredential({ scopes: [scope] });

  if (!result?.accessToken) {
    throw new Error(`Auth failed: ${JSON.stringify(result)}`);
  }

  return result.accessToken;
}

// Load employees_data.json from orange-dashboard (same as api/get-employees.ts)
async function loadEmployeesData(): Promise<{ [storeId: string]: any[][] }> {
  try {
    console.log('📥 Loading employees_data.json from orange-dashboard...');
    const response: Response = await fetch('https://raw.githubusercontent.com/ALAAWF2/orange-dashboard/main/employees_data.json');
    
    if (!response.ok) {
      console.warn('⚠️ Could not fetch employees_data.json from orange-dashboard');
      return {};
    }
    
    const data = await response.json();
    console.log(`✅ Loaded employees data for ${Object.keys(data).length} stores`);
    return data;
  } catch (error: any) {
    console.error('❌ Error loading employees_data.json:', error.message);
    return {};
  }
}

async function loadStoreMapping(): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  
  try {
    const response: Response = await fetch('https://raw.githubusercontent.com/ALAAWF2/dailysales/main/backend/mapping.xlsx');
    
    if (!response.ok) {
      return mapping;
    }
    
    const arrayBuffer: ArrayBuffer = await response.arrayBuffer();
    const buffer: Buffer = Buffer.from(arrayBuffer);
    
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);
    
    const firstRow = data[0] || {};
    const keys = Object.keys(firstRow);
    
    const storeIdCol = keys.find(k => {
      const kLower = k.toLowerCase();
      return kLower.includes('store') && (kLower.includes('number') || kLower.includes('id'));
    }) || keys[0];
    
    const storeNameCol = keys.find(k => {
      const kLower = k.toLowerCase();
      return kLower.includes('outlet') || (kLower.includes('name') && !kLower.includes('store'));
    }) || keys[1];
    
    data.forEach((row: any) => {
      const storeId = String(row[storeIdCol] || '').trim();
      const storeName = String(row[storeNameCol] || '').trim();
      if (storeId && storeName && storeId !== 'NaN' && storeName !== 'NaN') {
        mapping.set(storeId, storeName);
      }
    });
  } catch (error: any) {
    console.error('❌ Error loading store mapping:', error.message);
  }

  return mapping;
}

/**
 * Fetch aggregated transactions from D365 using server-side aggregation ($apply=groupby)
 * This dramatically reduces payload size (from 57k+ records to ~100-500 aggregated groups)
 */
async function fetchD365Aggregated(
  token: string,
  startDate: Date,
  endDate: Date,
  storeId?: string
): Promise<{ groups: D365AggregatedGroup[]; pages: number }> {
  const d365Url = process.env.D365_URL || 'https://orangepax.operations.eu.dynamics.com';
  const baseUrl = `${d365Url}/data/RetailTransactions`;

  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  // Build filter - only non-zero payments in date range
  let filter = `PaymentAmount ne 0 and TransactionDate ge ${startStr} and TransactionDate lt ${endStr}`;
  if (storeId) {
    filter += ` and OperatingUnitNumber eq '${storeId}'`;
  }

  // OData $apply=groupby with aggregation: Group by (OperatingUnitNumber, TransactionDate)
  // Aggregate: sum(PaymentAmount) as TotalAmount, count() as InvoiceCount
  // This reduces 57k+ records to ~100-500 aggregated rows (one per store per day)
  const applyClause = `groupby((OperatingUnitNumber,TransactionDate),aggregate(PaymentAmount with sum as TotalAmount,$count as InvoiceCount))`;
  const queryUrl = `${baseUrl}?$filter=${encodeURIComponent(filter)}&$apply=${encodeURIComponent(applyClause)}&$orderby=TransactionDate,OperatingUnitNumber`;
  
  console.log(`🔍 D365 aggregated query URL: ${queryUrl.substring(0, 250)}...`);

  const allGroups: D365AggregatedGroup[] = [];
  let nextLink: string | null = queryUrl;
  let pages = 0;

  while (nextLink) {
    pages++;
    const response: Response = await fetch(nextLink, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        Prefer: 'odata.maxpagesize=5000',
      },
    });

    if (!response.ok) {
      const errorText: string = await response.text();
      // If $apply is not supported, fall back to old method (commented for now)
      throw new Error(`D365 API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data: any = await response.json();
    
    if (!data) {
      throw new Error('D365 API returned empty response');
    }
    
    if (!Array.isArray(data.value)) {
      console.error('❌ D365 response format error:', { hasValue: 'value' in data, dataKeys: Object.keys(data) });
      throw new Error(`D365 API returned invalid response format. Expected 'value' array, got: ${JSON.stringify(Object.keys(data))}`);
    }
    
    // Map aggregated response to D365AggregatedGroup
    const groups: D365AggregatedGroup[] = (data.value || []).map((item: any) => ({
      OperatingUnitNumber: String(item.OperatingUnitNumber || '').trim(),
      TransactionDate: item.TransactionDate || '',
      TotalAmount: Number(item.TotalAmount || 0),
      InvoiceCount: Number(item.InvoiceCount || 0),
    }));
    
    allGroups.push(...groups);
    nextLink = data['@odata.nextLink'] || null;
  }

  console.log(`✅ Fetched ${allGroups.length} aggregated groups (reduced from ~${allGroups.reduce((sum, g) => sum + g.InvoiceCount, 0)} transactions)`);

  return { groups: allGroups, pages };
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

  try {
    // Parse and validate input parameters
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const monthParam = req.query.month as string | undefined;
    let month: number | undefined;
    if (monthParam !== undefined) {
      month = parseInt(monthParam);
      if (isNaN(month) || month < 0 || month > 11) {
        console.warn(`⚠️ Invalid month parameter: ${monthParam}, expected 0-11`);
        return res.status(400).json({
          success: false,
          error: `Invalid month parameter: ${monthParam}. Expected 0-11 (0=January, 11=December)`,
          range: { from: '', to: '', year },
          byStore: [],
          byEmployee: [],
          totals: { salesAmount: 0, invoices: 0, kpis: { atv: 0, customerValue: 0 } },
          debug: { source: 'd365', notes: [`Invalid month: ${monthParam}`] },
        });
      }
    }
    
    const dayParam = req.query.day as string | undefined;
    let day: number | undefined;
    if (dayParam !== undefined) {
      day = parseInt(dayParam);
      if (isNaN(day) || day < 1 || day > 31) {
        console.warn(`⚠️ Invalid day parameter: ${dayParam}, expected 1-31`);
        return res.status(400).json({
          success: false,
          error: `Invalid day parameter: ${dayParam}. Expected 1-31`,
          range: { from: '', to: '', year },
          byStore: [],
          byEmployee: [],
          totals: { salesAmount: 0, invoices: 0, kpis: { atv: 0, customerValue: 0 } },
          debug: { source: 'd365', notes: [`Invalid day: ${dayParam}`] },
        });
      }
    }
    
    const storeId = req.query.storeId as string | undefined;
    // Note: employeeId parameter removed - employee filtering not supported (StaffId not in RetailTransactions entity)
    
    console.log(`📊 /api/sales request: year=${year}, month=${month !== undefined ? month + 1 : 'all'}, day=${day}, storeId=${storeId}`);

    // Only support 2026+ (legacy handled in frontend)
    if (year < 2026) {
      console.log(`✅ Year ${year} < 2026, returning empty response (legacy handled in frontend)`);
      return res.status(200).json({
        success: true,
        range: {
          from: new Date(year, 0, 1).toISOString().split('T')[0],
          to: new Date(year, 11, 31).toISOString().split('T')[0],
          year,
        },
        byStore: [],
        byEmployee: [],
        totals: { salesAmount: 0, invoices: 0, kpis: { atv: 0, customerValue: 0 } },
        debug: { source: 'd365', notes: ['Year < 2026: use legacy provider in frontend'] },
      });
    }

    const startDate = new Date(Date.UTC(year, month || 0, day || 1, 0, 0, 0));
    
    // Calculate end date correctly: use last day of the month if day is not specified
    let endDate: Date;
    if (month !== undefined) {
      if (day !== undefined) {
        // Specific day: end of that specific day
        endDate = new Date(Date.UTC(year, month, day, 23, 59, 59));
      } else {
        // Last day of month: calculate last day of the month properly
        // new Date(year, month + 1, 0) gives us the last day of the current month
        const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
        endDate = new Date(Date.UTC(
          lastDayOfMonth.getUTCFullYear(),
          lastDayOfMonth.getUTCMonth(),
          lastDayOfMonth.getUTCDate(),
          23, 59, 59
        ));
      }
    } else {
      // Full year: use December 31
      endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    }

    console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Step 1: Get access token (with error isolation)
    let token: string;
    try {
      console.log('🔐 Getting access token...');
      token = await getAccessToken();
      console.log('✅ Access token obtained');
    } catch (error: any) {
      console.error('❌ Failed to get access token:', error.message);
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
        byEmployee: [],
        totals: { salesAmount: 0, invoices: 0, kpis: { atv: 0, customerValue: 0 } },
        debug: { source: 'd365', notes: [`Access token error: ${error.message}`] },
      });
    }

    // Step 2: Load store mapping and employees data in parallel (optimize loading time)
    console.log('🔄 Loading store mapping and employees data in parallel...');
    const [storeMappingResult, employeesDataResult] = await Promise.allSettled([
      loadStoreMapping(),
      loadEmployeesData(),
    ]);
    
    // Extract store mapping (non-critical)
    let storeMapping: Map<string, string>;
    if (storeMappingResult.status === 'fulfilled') {
      storeMapping = storeMappingResult.value;
      console.log(`✅ Loaded ${storeMapping.size} store mappings`);
    } else {
      console.warn('⚠️ Failed to load store mapping, using empty mapping:', storeMappingResult.reason?.message);
      storeMapping = new Map();
    }
    
    // Extract employees data (non-critical)
    let employeesData: { [storeId: string]: any[][] } = {};
    if (employeesDataResult.status === 'fulfilled') {
      employeesData = employeesDataResult.value;
      console.log(`✅ Loaded employees data for ${Object.keys(employeesData).length} stores`);
    } else {
      console.warn('⚠️ Failed to load employees data, employee aggregation will be empty:', employeesDataResult.reason?.message);
      employeesData = {};
    }

    // Step 3: Fetch D365 aggregated groups (server-side aggregation - MUCH faster)
    // Uses $apply=groupby to aggregate on D365 server (reduces 57k+ records to ~100-500 rows)
    let aggregatedGroups: D365AggregatedGroup[];
    let pages: number;
    try {
      console.log('📦 Fetching D365 aggregated data (server-side groupby)...');
      const result = await fetchD365Aggregated(token, startDate, endDate, storeId);
      aggregatedGroups = result.groups;
      pages = result.pages;
      console.log(`✅ Fetched ${aggregatedGroups.length} aggregated groups in ${pages} pages (already summed on server)`);
    } catch (error: any) {
      console.error('❌ Failed to fetch D365 aggregated data:', error.message);
      // Return 200 with empty data instead of 500 - no data is not an error
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
        byEmployee: [],
        totals: { salesAmount: 0, invoices: 0, kpis: { atv: 0, customerValue: 0 } },
        debug: { source: 'd365', notes: [`D365 fetch error: ${error.message}`] },
      });
    }

    // Aggregate by store AND by date (for daily breakdown) - matching legacyProvider pattern
    // Key: "YYYY-MM-DD_STORE_ID" for daily aggregation
    const dailyStoreMap = new Map<string, { salesAmount: number; invoices: number }>();
    // Also aggregate monthly total (for backward compatibility)
    const monthlyStoreMap = new Map<string, { salesAmount: number; invoices: number }>();
    
    transactions.forEach((tx) => {
      // Use optional chaining to prevent crashes if fields are missing
      const id = tx?.OperatingUnitNumber?.toString()?.trim();
      const amount = Number(tx?.PaymentAmount) || 0;
      const txDate = tx?.TransactionDate;
      
      if (!id) {
        console.warn('⚠️ Transaction missing OperatingUnitNumber:', tx);
        return; // Skip transactions without store ID
      }
      
      // Extract date from TransactionDate (format: ISO string)
      let dateStr = '';
      if (txDate) {
        try {
          const dateObj = new Date(txDate);
          if (!isNaN(dateObj.getTime())) {
            dateStr = dateObj.toISOString().split('T')[0]; // "2026-01-17"
          }
        } catch (e) {
          console.warn('⚠️ Invalid TransactionDate:', txDate);
        }
      }
      
      // Monthly aggregation (for totals)
      if (!monthlyStoreMap.has(id)) {
        monthlyStoreMap.set(id, { salesAmount: 0, invoices: 0 });
      }
      const monthlyData = monthlyStoreMap.get(id)!;
      monthlyData.salesAmount += amount;
      monthlyData.invoices += 1;
      
      // Daily aggregation (for daily breakdown)
      if (dateStr) {
        const dailyKey = `${dateStr}_${id}`;
        if (!dailyStoreMap.has(dailyKey)) {
          dailyStoreMap.set(dailyKey, { salesAmount: 0, invoices: 0 });
        }
        const dailyData = dailyStoreMap.get(dailyKey)!;
        dailyData.salesAmount += amount;
        dailyData.invoices += 1;
      }
    });

    // Build monthly store response (for backward compatibility and totals)
    const byStore = Array.from(monthlyStoreMap.entries()).map(([storeId, data]) => {
      const storeName = storeMapping?.get(storeId) || storeId;
      const atv = data.invoices > 0 ? data.salesAmount / data.invoices : 0;
      return {
        storeId: storeId || 'Unknown',
        storeName: storeName || storeId || 'Unknown',
        salesAmount: Number(data.salesAmount) || 0,
        invoices: Number(data.invoices) || 0,
        kpis: {
          atv: Number.isFinite(atv) ? atv : 0,
          customerValue: Number.isFinite(atv) ? atv : 0,
        },
      };
    });
    
    // Build daily store data (for daily breakdown in MainLayout)
    // Group by date first, then by store
    const dailyByDate = new Map<string, Array<{ storeId: string; storeName: string; salesAmount: number; invoices: number }>>();
    dailyStoreMap.forEach((data, key) => {
      const [dateStr, storeId] = key.split('_');
      const storeName = storeMapping?.get(storeId) || storeId;
      
      if (!dailyByDate.has(dateStr)) {
        dailyByDate.set(dateStr, []);
      }
      dailyByDate.get(dateStr)!.push({
        storeId,
        storeName,
        salesAmount: Number(data.salesAmount) || 0,
        invoices: Number(data.invoices) || 0,
      });
    });

    // Step 4: Aggregate by employee from employees_data.json (matching orange-dashboard pattern)
    // Wrap in try-catch to ensure byStore data is still returned if employee aggregation fails
    let byEmployee: Array<{
      employeeId: string;
      employeeName?: string;
      storeId?: string;
      storeName?: string;
      salesAmount: number;
      invoices: number;
      kpis: { atv: number };
    }> = [];
    
    try {
      // employees_data.json format: { "storeId": [["date", "employeeName", sales, transactions, ...], ...], ... }
      const employeeMap = new Map<string, {
        employeeId: string;
        employeeName: string;
        storeId: string;
        salesAmount: number;
        invoices: number;
      }>();
      
      // Date range strings for filtering (YYYY-MM-DD format)
      const startDateStr = startDate.toISOString().split('T')[0]; // "2026-01-01"
      const endDateStr = endDate.toISOString().split('T')[0]; // "2026-01-31"
      
      // Process employees_data.json entries that match the date range
      Object.entries(employeesData).forEach(([dataStoreId, entries]) => {
        if (!Array.isArray(entries)) return;
        
        // Filter by storeId if specified (from request parameter)
        if (storeId && dataStoreId !== storeId) return;
        
        entries.forEach((entry) => {
          if (!Array.isArray(entry) || entry.length < 4) return;
          
          const entryDateStr = String(entry[0] || '').trim(); // "2026-01-17"
          const employeeName = String(entry[1] || '').trim(); // "4661-Fatima Albeshi"
          const sales = Number(entry[2]) || 0; // sales amount
          const transactions = Number(entry[3]) || 0; // transaction count
          
          if (!employeeName || !entryDateStr) return;
          
          // Check if date is within range
          if (entryDateStr < startDateStr || entryDateStr > endDateStr) return;
          
          // Extract employeeId from name (e.g., "4661-Fatima Albeshi" -> "4661")
          const employeeIdMatch = employeeName.match(/^(\d+)[-_\s]/);
          const employeeId = employeeIdMatch ? employeeIdMatch[1] : employeeName.replace(/\s+/g, '_');
          
          // Key: employeeId + storeId (same employee can work at multiple stores)
          const key = `${employeeId}_${dataStoreId}`;
          
          if (!employeeMap.has(key)) {
            employeeMap.set(key, {
              employeeId,
              employeeName,
              storeId: dataStoreId,
              salesAmount: 0,
              invoices: 0,
            });
          }
          
          const data = employeeMap.get(key)!;
          data.salesAmount += sales;
          data.invoices += transactions;
        });
      });
      
      // Build employee response with optional chaining
      byEmployee = Array.from(employeeMap.values()).map((emp) => {
        const storeName = storeMapping?.get(emp.storeId) || emp.storeId;
        const atv = emp.invoices > 0 ? emp.salesAmount / emp.invoices : 0;
        return {
          employeeId: emp.employeeId || 'Unknown',
          employeeName: emp.employeeName || 'Unknown',
          storeId: emp.storeId || 'Unknown',
          storeName: storeName || emp.storeId || 'Unknown',
          salesAmount: Number(emp.salesAmount) || 0,
          invoices: Number(emp.invoices) || 0,
          kpis: {
            atv: Number.isFinite(atv) ? atv : 0,
          },
        };
      });
      
      console.log(`✅ Aggregated ${byEmployee.length} employees from employees_data.json`);
    } catch (error: any) {
      console.warn('⚠️ Error aggregating employee data, continuing with empty byEmployee array:', error.message);
      byEmployee = []; // Default to empty array if aggregation fails
    }

    // Calculate totals with safe defaults (optional chaining)
    const totalSales = byStore.reduce((sum, s) => sum + (Number(s?.salesAmount) || 0), 0);
    const totalInvoices = byStore.reduce((sum, s) => sum + (Number(s?.invoices) || 0), 0);
    const totalAtv = totalInvoices > 0 && totalInvoices !== 0 ? totalSales / totalInvoices : 0;

    // Build byDay array (for daily breakdown in MainLayout)
    // Format: [{ date: "YYYY-MM-DD", byStore: [...], byEmployee: [...] }, ...]
    const byDay = Array.from(dailyByDate.entries()).map(([dateStr, stores]) => {
      const dayStoreName = storeMapping || new Map();
      return {
        date: dateStr,
        byStore: stores.map(store => {
          const storeName = dayStoreName.get(store.storeId) || store.storeName;
          const atv = store.invoices > 0 ? store.salesAmount / store.invoices : 0;
          return {
            storeId: store.storeId,
            storeName: storeName || store.storeId,
            salesAmount: store.salesAmount,
            invoices: store.invoices,
            kpis: {
              atv: Number.isFinite(atv) ? atv : 0,
              customerValue: Number.isFinite(atv) ? atv : 0,
            },
          };
        }),
        byEmployee: [], // Employee data is monthly from employees_data.json, not daily
      };
    }).sort((a, b) => a.date.localeCompare(b.date)); // Sort by date

    const totalTransactionsCount = aggregatedGroups.reduce((sum, g) => sum + g.InvoiceCount, 0);
    console.log(`📅 Built ${byDay.length} days of data from ${aggregatedGroups.length} aggregated groups (~${totalTransactionsCount} transactions)`);

    return res.status(200).json({
      success: true,
      range: {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0],
        year,
        ...(month !== undefined && { month: month + 1 }),
        ...(day !== undefined && { day }),
      },
      byStore, // Monthly totals (for backward compatibility)
      byEmployee, // Monthly totals (from employees_data.json)
      byDay, // Daily breakdown (NEW - for daily metrics in MainLayout)
      totals: {
        salesAmount: totalSales,
        invoices: totalInvoices,
        kpis: {
          atv: Number.isFinite(totalAtv) ? totalAtv : 0,
          customerValue: Number.isFinite(totalAtv) ? totalAtv : 0,
        },
      },
      debug: {
        source: 'd365',
        pages,
        fetched: aggregatedGroups.length, // Number of aggregated groups (not individual transactions)
        dailyDays: byDay.length,
        notes: [
          `Fetched from D365 RetailTransactions API (server-side aggregated)`,
          `Daily breakdown: ${byDay.length} days`,
          `Performance: ${aggregatedGroups.length} groups vs ~${aggregatedGroups.reduce((sum, g) => sum + g.InvoiceCount, 0)} transactions (reduced by ~${Math.round(100 * (1 - aggregatedGroups.length / Math.max(1, aggregatedGroups.reduce((sum, g) => sum + g.InvoiceCount, 0))))}%)`
        ],
      },
    });
  } catch (error: any) {
    // Catch-all error handler - should never reach here with proper error handling above
    console.error('❌ Unexpected error in /api/sales:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      name: error.name,
    });
    
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const monthParam = req.query.month as string | undefined;
    const month = monthParam !== undefined ? parseInt(monthParam) : undefined;
    const dayParam = req.query.day as string | undefined;
    const day = dayParam !== undefined ? parseInt(dayParam) : undefined;
    
    const errorMessage = error.message || String(error);
    const errorStack = error.stack?.split('\n').slice(0, 3).join(' ') || '';
    
    // Return 200 with error info instead of 500 - graceful degradation
    return res.status(200).json({
      success: false,
      range: {
        from: new Date(year, month || 0, day || 1).toISOString().split('T')[0],
        to: new Date(year, month !== undefined ? month : 11, day || 31).toISOString().split('T')[0],
        year,
        ...(month !== undefined && { month: month + 1 }),
        ...(day !== undefined && { day }),
      },
      byStore: [],
      byEmployee: [],
      totals: { salesAmount: 0, invoices: 0, kpis: { atv: 0, customerValue: 0 } },
      debug: { 
        source: 'd365', 
        notes: [
          `Unexpected error: ${errorMessage}`,
          ...(errorStack ? [`Stack: ${errorStack}`] : [])
        ] 
      },
    });
  }
}
