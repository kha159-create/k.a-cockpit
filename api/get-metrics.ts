import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConfidentialClientApplication } from '@azure/msal-node';
import * as XLSX from 'xlsx';

// Same D365 authentication as live-sales and sync-d365
async function getAccessToken(): Promise<string> {
  const clientId = process.env.D365_CLIENT_ID;
  const clientSecret = process.env.D365_CLIENT_SECRET;
  const tenantId = process.env.D365_TENANT_ID;
  const authority = `https://login.microsoftonline.com/${tenantId}`;

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error('Missing D365 credentials');
  }

  const msalConfig = {
    auth: {
      clientId,
      clientSecret,
      authority,
    },
  };

  const cca = new ConfidentialClientApplication(msalConfig);
  const clientCredentialRequest = {
    scopes: ['https://orangepax.operations.eu.dynamics.com/.default'],
  };

  const response = await cca.acquireTokenByClientCredential(clientCredentialRequest);
  if (!response || !response.accessToken) {
    throw new Error('Failed to get access token');
  }

  return response.accessToken;
}

interface D365Transaction {
  OperatingUnitNumber: string;
  PaymentAmount: number;
  TransactionDate: string;
  StaffId?: string; // Employee ID (if available in D365)
  StaffName?: string; // Employee Name (if available in D365)
  [key: string]: any; // Allow other fields
}

// Fetch transactions from D365 for a date range (like sync-d365)
async function fetchTransactions(
  token: string,
  startDate: Date,
  endDate: Date
): Promise<D365Transaction[]> {
  const d365Url = process.env.D365_URL || 'https://orangepax.operations.eu.dynamics.com';
  const baseUrl = `${d365Url}/data/RetailTransactions`;

  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  // Try to get StaffId/StaffName if available in D365 (for employee sales)
  // Note: D365 RetailTransactions may not have StaffId, so we try it first
  const selectFields = 'OperatingUnitNumber,PaymentAmount,TransactionDate,StaffId,StaffName';
  const queryUrl = `${baseUrl}?$filter=PaymentAmount ne 0 and TransactionDate ge ${startStr} and TransactionDate lt ${endStr}&$select=${selectFields}&$orderby=TransactionDate`;

  const allTransactions: D365Transaction[] = [];
  let nextLink: string | null = queryUrl;

  while (nextLink) {
    const response = await fetch(nextLink, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        Prefer: 'odata.maxpagesize=5000',
      },
    });

    if (!response.ok) {
      throw new Error(`D365 API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    allTransactions.push(...(data.value || []));
    nextLink = data['@odata.nextLink'] || null;
  }

  return allTransactions;
}

// Load store mapping from orange-dashboard (same as live-sales)
async function loadStoreMapping(): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  
  try {
    console.log('📥 Loading store mapping from orange-dashboard...');
    const response = await fetch('https://raw.githubusercontent.com/ALAAWF2/dailysales/main/backend/mapping.xlsx');
    
    if (!response.ok) {
      console.warn('⚠️ Could not fetch mapping from orange-dashboard');
      return mapping;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as any[];
    
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
    
    console.log(`✅ Loaded ${mapping.size} store mappings`);
  } catch (error: any) {
    console.error('❌ Error loading store mapping:', error.message);
  }

  return mapping;
}

// Load employees_data.json from orange-dashboard (same structure as orange-dashboard)
// Format: { "storeId": [["date", "employeeName", sales, transactions, ...], ...], ... }
async function loadEmployeesData(): Promise<{ [storeId: string]: any[][] }> {
  try {
    console.log('📥 Loading employees_data.json from orange-dashboard...');
    const response = await fetch('https://raw.githubusercontent.com/ALAAWF2/orange-dashboard/main/employees_data.json');
    
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

// Transform employees_data.json to DailyMetric format (same as orange-dashboard structure)
// IMPORTANT: Group by date + store + employee (like orange-dashboard)
// Store totalSales = sum of employee.totalSales (same as old system)
function transformEmployeesDataToMetrics(
  employeesData: { [storeId: string]: any[][] },
  storeMapping: Map<string, string>,
  year: number,
  month: number
): any[] {
  // employees_data.json format: { "storeId": [["date", "employeeName", sales, transactions, ...], ...], ... }
  // Each entry: [date, employeeName, sales, transactions, ...]
  const metricsMap = new Map<string, {
    date: Date;
    store: string;
    totalSales: number;
    transactionCount: number;
    employee?: string;
    employeeId?: string;
  }>();

  Object.entries(employeesData).forEach(([storeId, entries]) => {
    if (!Array.isArray(entries)) return;
    
    const storeName = storeMapping.get(storeId) || storeId;
    
    entries.forEach((entry) => {
      if (!Array.isArray(entry) || entry.length < 3) return;
      
      const dateStr = String(entry[0] || '').trim(); // "2026-01-17"
      const employeeName = String(entry[1] || '').trim(); // "4661-Fatima Albeshi"
      const sales = Number(entry[2]) || 0; // sales amount
      const transactions = Number(entry[3]) || 0; // transaction count
      
      if (!dateStr || !employeeName || sales === 0) return;
      
      // Parse date
      const txDate = new Date(dateStr + 'T00:00:00Z'); // Parse YYYY-MM-DD as UTC
      
      // Only include entries for the requested month/year
      if (txDate.getUTCFullYear() !== year || txDate.getUTCMonth() !== month) {
        return;
      }
      
      const dateKey = dateStr; // YYYY-MM-DD
      const docKey = `${dateKey}_${storeName}_${employeeName}`; // Per employee (like orange-dashboard)
      
      // Extract employeeId from name (e.g., "4661-Fatima Albeshi" -> "4661")
      const employeeIdMatch = employeeName.match(/^(\d+)[-_\s]/);
      const employeeId = employeeIdMatch ? employeeIdMatch[1] : null;

      if (!metricsMap.has(docKey)) {
        metricsMap.set(docKey, {
          date: new Date(Date.UTC(year, month, txDate.getUTCDate())),
          store: storeName,
          totalSales: 0,
          transactionCount: 0,
          employee: employeeName,
          ...(employeeId && { employeeId }),
        });
      }
      const metric = metricsMap.get(docKey)!;
      metric.totalSales += sales;
      metric.transactionCount += transactions; // Use transactions from entry, not count of entries
    });
  });

  // Convert to array and format dates as ISO strings (client will convert to Timestamp)
  // Note: Multiple metrics per store (one per employee) - client will sum them for store totals
  return Array.from(metricsMap.values()).map(metric => ({
    ...metric,
    date: metric.date.toISOString(), // Send as ISO string, client converts to Timestamp
  }));
}

// Fallback: Transform D365 transactions to DailyMetric format (if employees_data.json not available)
function transformToDailyMetrics(
  transactions: D365Transaction[],
  storeMapping: Map<string, string>,
  year: number,
  month: number
): any[] {
  // Group by: date + store + employee (if StaffId/StaffName available)
  // This ensures employee sales are separate, then we sum them for store totals
  const metricsMap = new Map<string, {
    date: Date;
    store: string;
    totalSales: number;
    transactionCount: number;
    employee?: string;
    employeeId?: string;
  }>();

  transactions.forEach((tx) => {
    const storeId = String(tx.OperatingUnitNumber || '').trim();
    const storeName = storeMapping.get(storeId) || storeId;
    const txDate = new Date(tx.TransactionDate);
    
    // Only include transactions for the requested month/year
    if (txDate.getUTCFullYear() !== year || txDate.getUTCMonth() !== month) {
      return;
    }
    
    const dateKey = txDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const employeeName = tx.StaffName || tx.StaffId || null; // Try to get employee name
    const employeeId = tx.StaffId || null;
    
    // If employee data available, create separate metric per employee (like old system)
    // Otherwise, group by store only (fallback)
    const docKey = employeeName 
      ? `${dateKey}_${storeName}_${employeeName}` // Per employee
      : `${dateKey}_${storeName}`; // Per store (fallback)

    const amount = Number(tx.PaymentAmount) || 0;
    if (amount === 0) return;

    if (!metricsMap.has(docKey)) {
      metricsMap.set(docKey, {
        date: new Date(Date.UTC(year, month, txDate.getUTCDate())),
        store: storeName,
        totalSales: 0,
        transactionCount: 0,
        ...(employeeName && { employee: employeeName }),
        ...(employeeId && { employeeId }),
      });
    }
    const metric = metricsMap.get(docKey)!;
    metric.totalSales += amount;
    metric.transactionCount += 1;
  });

  // Convert to array and format dates as ISO strings (client will convert to Timestamp)
  // Note: Multiple metrics per store (one per employee) - client will sum them for store totals
  return Array.from(metricsMap.values()).map(metric => ({
    ...metric,
    date: metric.date.toISOString(), // Send as ISO string, client converts to Timestamp
  }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  const allowedOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth();
    
    // Only return data for 2026 and later (new system)
    if (year < 2026) {
      return res.status(200).json({
        success: true,
        metrics: [],
        message: 'Use Firestore for data before 2026',
      });
    }

    console.log(`📊 Fetching metrics for ${year}-${month + 1}`);

    // Load store mapping
    const storeMapping = await loadStoreMapping();

    // PRIMARY METHOD: Use employees_data.json from orange-dashboard (same structure)
    // This ensures we get employee-level data exactly as orange-dashboard provides it
    const employeesData = await loadEmployeesData();
    let metrics: any[] = [];

    if (Object.keys(employeesData).length > 0) {
      // Use employees_data.json (primary method - same as orange-dashboard)
      metrics = transformEmployeesDataToMetrics(employeesData, storeMapping, year, month);
      console.log(`✅ Transformed ${metrics.length} metrics from employees_data.json`);
    } else {
      // FALLBACK: Use D365 API if employees_data.json not available
      console.log('⚠️ employees_data.json not available, falling back to D365 API...');
      const token = await getAccessToken();
      
      // Calculate date range for the month
      const startDate = new Date(Date.UTC(year, month, 1));
      const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));

      // Fetch transactions
      const transactions = await fetchTransactions(token, startDate, endDate);
      console.log(`✅ Fetched ${transactions.length} transactions from D365`);

      // Transform to DailyMetric format
      metrics = transformToDailyMetrics(transactions, storeMapping, year, month);
      console.log(`✅ Transformed ${metrics.length} metrics from D365 transactions`);
    }

    return res.status(200).json({
      success: true,
      metrics,
      count: metrics.length,
      year,
      month: month + 1,
    });
    
  } catch (error: any) {
    console.error('❌ Error fetching metrics:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
}
