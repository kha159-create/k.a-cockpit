import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConfidentialClientApplication } from '@azure/msal-node';
import * as XLSX from 'xlsx';

// D365 Authentication (same as orange-dashboard)
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
    auth: {
      clientId,
      clientSecret,
      authority,
    },
  });

  const result = await app.acquireTokenByClientCredential({
    scopes: [scope],
  });

  if (!result?.accessToken) {
    throw new Error(`Auth failed: ${JSON.stringify(result)}`);
  }

  return result.accessToken;
}

interface D365Transaction {
  OperatingUnitNumber: string;
  PaymentAmount: number;
  TransactionDate: string;
  StaffId?: string;
  StaffName?: string;
  [key: string]: any;
}

// Fetch transactions with paging (like orange-dashboard)
async function fetchTransactions(
  token: string,
  startDate: Date,
  endDate: Date
): Promise<{ transactions: D365Transaction[]; pages: number }> {
  const d365Url = process.env.D365_URL || 'https://orangepax.operations.eu.dynamics.com';
  const baseUrl = `${d365Url}/data/RetailTransactions`;

  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  const filter = `PaymentAmount ne 0 and TransactionDate ge ${startStr} and TransactionDate lt ${endStr}`;
  const selectFields = 'OperatingUnitNumber,PaymentAmount,TransactionDate,StaffId,StaffName';
  const queryUrl = `${baseUrl}?$filter=${encodeURIComponent(filter)}&$select=${selectFields}&$orderby=TransactionDate`;

  const allTransactions: D365Transaction[] = [];
  let nextLink: string | null = queryUrl;
  let pages = 0;

  while (nextLink) {
    pages++;
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

  return { transactions: allTransactions, pages };
}

// Load store mapping
async function loadStoreMapping(): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  
  try {
    const response = await fetch('https://raw.githubusercontent.com/ALAAWF2/dailysales/main/backend/mapping.xlsx');
    
    if (!response.ok) {
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
  } catch (error: any) {
    console.error('❌ Error loading store mapping:', error.message);
  }

  return mapping;
}

// Aggregate transactions
function aggregateTransactions(
  transactions: D365Transaction[],
  storeMapping: Map<string, string>
): {
  byStore: Map<string, { sales: number; transactions: number }>;
  byEmployee: Map<string, { sales: number; transactions: number; store: string }>;
} {
  const byStore = new Map<string, { sales: number; transactions: number }>();
  const byEmployee = new Map<string, { sales: number; transactions: number; store: string }>();

  transactions.forEach((tx) => {
    const storeId = tx.OperatingUnitNumber;
    const storeName = storeMapping.get(storeId) || storeId;
    const amount = tx.PaymentAmount || 0;
    const employeeId = tx.StaffId || 'unknown';
    const employeeName = tx.StaffName || 'Unknown';

    // Aggregate by store
    if (!byStore.has(storeName)) {
      byStore.set(storeName, { sales: 0, transactions: 0 });
    }
    const storeData = byStore.get(storeName)!;
    storeData.sales += amount;
    storeData.transactions += 1;

    // Aggregate by employee
    if (employeeId !== 'unknown') {
      const empKey = `${employeeId}_${employeeName}`;
      if (!byEmployee.has(empKey)) {
        byEmployee.set(empKey, { sales: 0, transactions: 0, store: storeName });
      }
      const empData = byEmployee.get(empKey)!;
      empData.sales += amount;
      empData.transactions += 1;
    }
  });

  return { byStore, byEmployee };
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
    const startTime = Date.now();
    
    // Parse query parameters
    const fromStr = req.query.from as string; // YYYY-MM-DD
    const toStr = req.query.to as string; // YYYY-MM-DD

    if (!fromStr || !toStr) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: from (YYYY-MM-DD) and to (YYYY-MM-DD)',
      });
    }

    const startDate = new Date(fromStr + 'T00:00:00Z');
    const endDate = new Date(toStr + 'T23:59:59Z');

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    console.log(`🔍 Debug sales: ${fromStr} to ${toStr}`);

    // Get access token
    const token = await getAccessToken();

    // Load store mapping
    const storeMapping = await loadStoreMapping();

    // Fetch transactions with paging
    const { transactions, pages } = await fetchTransactions(token, startDate, endDate);

    // Aggregate data
    const aggregates = aggregateTransactions(transactions, storeMapping);

    const duration = Date.now() - startTime;

    // Return debug info
    return res.status(200).json({
      success: true,
      dateRange: {
        from: fromStr,
        to: toStr,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      totalTransactions: transactions.length,
      pagesFetched: pages,
      durationMs: duration,
      sampleTransactions: transactions.slice(0, 3).map(tx => ({
        OperatingUnitNumber: tx.OperatingUnitNumber,
        PaymentAmount: tx.PaymentAmount,
        TransactionDate: tx.TransactionDate,
        StaffId: tx.StaffId,
        StaffName: tx.StaffName,
      })),
      aggregates: {
        byStore: Array.from(aggregates.byStore.entries()).map(([store, data]) => ({
          store,
          totalSales: data.sales,
          transactionCount: data.transactions,
        })),
        byEmployee: Array.from(aggregates.byEmployee.entries()).map(([emp, data]) => ({
          employee: emp,
          store: data.store,
          totalSales: data.sales,
          transactionCount: data.transactions,
        })),
      },
      storeMappingSize: storeMapping.size,
    });
  } catch (error: any) {
    console.error('❌ Error in debug-sales:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
}
