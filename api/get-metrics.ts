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

  const queryUrl = `${baseUrl}?$filter=PaymentAmount ne 0 and TransactionDate ge ${startStr} and TransactionDate lt ${endStr}&$select=OperatingUnitNumber,PaymentAmount,TransactionDate&$orderby=TransactionDate`;

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

// Transform D365 transactions to DailyMetric format (compatible with Firestore structure)
function transformToDailyMetrics(
  transactions: D365Transaction[],
  storeMapping: Map<string, string>,
  year: number,
  month: number
): any[] {
  // Group by date and store
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
    const docKey = `${dateKey}_${storeName}`;

    const amount = Number(tx.PaymentAmount) || 0;
    if (amount === 0) return;

    if (!metricsMap.has(docKey)) {
      metricsMap.set(docKey, {
        date: new Date(Date.UTC(year, month, txDate.getUTCDate())),
        store: storeName,
        totalSales: 0,
        transactionCount: 0,
      });
    }
    const metric = metricsMap.get(docKey)!;
    metric.totalSales += amount;
    metric.transactionCount += 1;
  });

  // Convert to array and format dates as ISO strings (client will convert to Timestamp)
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

    // Get access token
    const token = await getAccessToken();

    // Load store mapping
    const storeMapping = await loadStoreMapping();

    // Calculate date range for the month
    const startDate = new Date(Date.UTC(year, month, 1));
    const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));

    // Fetch transactions
    const transactions = await fetchTransactions(token, startDate, endDate);
    console.log(`✅ Fetched ${transactions.length} transactions`);

    // Transform to DailyMetric format
    const metrics = transformToDailyMetrics(transactions, storeMapping, year, month);

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
