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

// Fetch transactions from D365 with paging support (like orange-dashboard)
async function fetchTransactions(
  token: string,
  startDate: Date,
  endDate: Date,
  storeId?: string,
  employeeId?: string
): Promise<{ transactions: D365Transaction[]; pages: number; totalCount: number }> {
  const d365Url = process.env.D365_URL || 'https://orangepax.operations.eu.dynamics.com';
  const baseUrl = `${d365Url}/data/RetailTransactions`;

  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  // Build filter (same as orange-dashboard)
  let filter = `PaymentAmount ne 0 and TransactionDate ge ${startStr} and TransactionDate lt ${endStr}`;
  
  if (storeId) {
    filter += ` and OperatingUnitNumber eq '${storeId}'`;
  }
  
  // Note: StaffId filtering may not be available in all D365 instances
  if (employeeId) {
    filter += ` and StaffId eq '${employeeId}'`;
  }

  // Select fields
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

  return {
    transactions: allTransactions,
    pages,
    totalCount: allTransactions.length,
  };
}

// Load store mapping (same as orange-dashboard)
async function loadStoreMapping(): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  
  try {
    console.log('📥 Loading store mapping...');
    const response = await fetch('https://raw.githubusercontent.com/ALAAWF2/dailysales/main/backend/mapping.xlsx');
    
    if (!response.ok) {
      console.warn('⚠️ Could not fetch mapping.xlsx');
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

// Aggregate transactions by store and employee (like orange-dashboard)
function aggregateTransactions(
  transactions: D365Transaction[],
  storeMapping: Map<string, string>
): {
  byStore: Map<string, { sales: number; transactions: number }>;
  byEmployee: Map<string, { sales: number; transactions: number; store: string }>;
  byStoreAndEmployee: Map<string, { sales: number; transactions: number; store: string; employee: string }>;
} {
  const byStore = new Map<string, { sales: number; transactions: number }>();
  const byEmployee = new Map<string, { sales: number; transactions: number; store: string }>();
  const byStoreAndEmployee = new Map<string, { sales: number; transactions: number; store: string; employee: string }>();

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

    // Aggregate by store + employee
    const storeEmpKey = `${storeName}_${employeeId}_${employeeName}`;
    if (!byStoreAndEmployee.has(storeEmpKey)) {
      byStoreAndEmployee.set(storeEmpKey, { sales: 0, transactions: 0, store: storeName, employee: employeeName });
    }
    const storeEmpData = byStoreAndEmployee.get(storeEmpKey)!;
    storeEmpData.sales += amount;
    storeEmpData.transactions += 1;
  });

  return { byStore, byEmployee, byStoreAndEmployee };
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
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string); // 0-11, optional
    const day = parseInt(req.query.day as string); // 1-31, optional
    const storeId = req.query.storeId as string | undefined;
    const employeeId = req.query.employeeId as string | undefined;

    // Calculate date range
    const startDate = new Date(Date.UTC(year, month !== undefined ? month : 0, day || 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(
      year,
      month !== undefined ? month + 1 : 12,
      day || (month !== undefined ? new Date(year, month + 1, 0).getDate() : 31),
      23, 59, 59
    ));

    console.log(`📊 Fetching sales from D365: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Get access token
    const token = await getAccessToken();
    console.log('✅ D365 token acquired');

    // Load store mapping
    const storeMapping = await loadStoreMapping();

    // Fetch transactions with paging
    const { transactions, pages, totalCount } = await fetchTransactions(
      token,
      startDate,
      endDate,
      storeId,
      employeeId
    );

    console.log(`✅ Fetched ${totalCount} transactions in ${pages} pages`);

    // Aggregate data (like orange-dashboard)
    const aggregates = aggregateTransactions(transactions, storeMapping);

    const duration = Date.now() - startTime;

    // Return data in format expected by Cockpit
    return res.status(200).json({
      success: true,
      year,
      month: month !== undefined ? month + 1 : undefined,
      day,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      metrics: Array.from(aggregates.byStoreAndEmployee.entries()).map(([key, data]) => ({
        id: key,
        date: startDate.toISOString().split('T')[0],
        store: data.store,
        employee: data.employee,
        totalSales: data.sales,
        transactionCount: data.transactions,
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
      debug: {
        totalTransactions: totalCount,
        pagesFetched: pages,
        durationMs: duration,
        sampleTransactions: transactions.slice(0, 3),
      },
    });
  } catch (error: any) {
    console.error('❌ Error fetching sales:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
}
