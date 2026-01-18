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

async function fetchD365Transactions(
  token: string,
  startDate: Date,
  endDate: Date,
  storeId?: string
  // Note: employeeId removed - StaffId is not available in RetailTransactions entity
): Promise<{ transactions: D365Transaction[]; pages: number }> {
  const d365Url = process.env.D365_URL || 'https://orangepax.operations.eu.dynamics.com';
  const baseUrl = `${d365Url}/data/RetailTransactions`;

  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  // Build filter - matching exact format from working api/live-sales.ts
  let filter = `PaymentAmount ne 0 and TransactionDate ge ${startStr} and TransactionDate lt ${endStr}`;
  if (storeId) {
    filter += ` and OperatingUnitNumber eq '${storeId}'`;
  }
  // Note: employeeId filter removed - StaffId is not available in RetailTransactions entity
  
  // $select fields - EXACT match to working api/live-sales.ts (NO StaffId/StaffName)
  const selectFields = 'OperatingUnitNumber,PaymentAmount,TransactionDate';
  const queryUrl = `${baseUrl}?$filter=${encodeURIComponent(filter)}&$select=${selectFields}&$orderby=TransactionDate`;
  
  console.log(`🔍 D365 query URL: ${queryUrl.substring(0, 200)}...`);

  const allTransactions: D365Transaction[] = [];
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
    
    allTransactions.push(...(data.value || []));
    nextLink = data['@odata.nextLink'] || null;
  }

  return { transactions: allTransactions, pages };
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

    // Step 2: Load store mapping (non-critical, can proceed if fails)
    let storeMapping: Map<string, string>;
    try {
      console.log('🗺️ Loading store mapping...');
      storeMapping = await loadStoreMapping();
      console.log(`✅ Loaded ${storeMapping.size} store mappings`);
    } catch (error: any) {
      console.warn('⚠️ Failed to load store mapping, using empty mapping:', error.message);
      storeMapping = new Map();
    }

    // Step 3: Fetch D365 transactions (with error isolation)
    let transactions: D365Transaction[];
    let pages: number;
    try {
      console.log('📦 Fetching D365 transactions...');
      const result = await fetchD365Transactions(token, startDate, endDate, storeId);
      transactions = result.transactions;
      pages = result.pages;
      console.log(`✅ Fetched ${transactions.length} transactions in ${pages} pages`);
    } catch (error: any) {
      console.error('❌ Failed to fetch D365 transactions:', error.message);
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

    // Aggregate by store (matching api/live-sales.ts pattern with optional chaining)
    const storeMap = new Map<string, { salesAmount: number; invoices: number }>();
    transactions.forEach((tx) => {
      // Use optional chaining to prevent crashes if fields are missing
      const id = tx?.OperatingUnitNumber?.toString()?.trim();
      const amount = Number(tx?.PaymentAmount) || 0;
      
      if (!id) {
        console.warn('⚠️ Transaction missing OperatingUnitNumber:', tx);
        return; // Skip transactions without store ID
      }
      
      if (!storeMap.has(id)) {
        storeMap.set(id, { salesAmount: 0, invoices: 0 });
      }
      const data = storeMap.get(id)!;
      data.salesAmount += amount;
      data.invoices += 1;
    });

    // Build store response with optional chaining and safe defaults
    const byStore = Array.from(storeMap.entries()).map(([storeId, data]) => {
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

    // Employee aggregation removed - StaffId/StaffName are NOT available in RetailTransactions entity
    // Employee data must come from a different D365 endpoint or source
    const byEmployee: Array<{
      employeeId: string;
      employeeName?: string;
      storeId?: string;
      storeName?: string;
      salesAmount: number;
      invoices: number;
      kpis: { atv: number };
    }> = [];

    // Calculate totals with safe defaults (optional chaining)
    const totalSales = byStore.reduce((sum, s) => sum + (Number(s?.salesAmount) || 0), 0);
    const totalInvoices = byStore.reduce((sum, s) => sum + (Number(s?.invoices) || 0), 0);
    const totalAtv = totalInvoices > 0 && totalInvoices !== 0 ? totalSales / totalInvoices : 0;

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
      byEmployee,
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
        fetched: transactions.length,
        notes: [`Fetched from D365 RetailTransactions API`],
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
