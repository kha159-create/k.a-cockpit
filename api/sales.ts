import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConfidentialClientApplication } from '@azure/msal-node';
import * as XLSX from 'xlsx';

interface D365Transaction {
  OperatingUnitNumber: string;
  PaymentAmount: number;
  TransactionDate: string;
  StaffId?: string;
  StaffName?: string;
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
  storeId?: string,
  employeeId?: string
): Promise<{ transactions: D365Transaction[]; pages: number }> {
  const d365Url = process.env.D365_URL || 'https://orangepax.operations.eu.dynamics.com';
  const baseUrl = `${d365Url}/data/RetailTransactions`;

  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  let filter = `PaymentAmount ne 0 and TransactionDate ge ${startStr} and TransactionDate lt ${endStr}`;
  if (storeId) filter += ` and OperatingUnitNumber eq '${storeId}'`;
  if (employeeId) filter += ` and StaffId eq '${employeeId}'`;

  const selectFields = 'OperatingUnitNumber,PaymentAmount,TransactionDate,StaffId,StaffName';
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
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const monthParam = req.query.month as string | undefined;
    const month = monthParam !== undefined ? parseInt(monthParam) : undefined;
    const dayParam = req.query.day as string | undefined;
    const day = dayParam !== undefined ? parseInt(dayParam) : undefined;
    const storeId = req.query.storeId as string | undefined;
    const employeeId = req.query.employeeId as string | undefined;

    console.log(`📊 /api/sales request: year=${year}, month=${month}, day=${day}, storeId=${storeId}, employeeId=${employeeId}`);

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
    const endDate = new Date(Date.UTC(
      year,
      month !== undefined ? month + 1 : 12,
      day || (month !== undefined ? new Date(year, month + 1, 0).getDate() : 31),
      23, 59, 59
    ));

    console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    console.log('🔐 Getting access token...');
    const token = await getAccessToken();
    console.log('✅ Access token obtained');

    console.log('🗺️ Loading store mapping...');
    const storeMapping = await loadStoreMapping();
    console.log(`✅ Loaded ${storeMapping.size} store mappings`);

    console.log('📦 Fetching D365 transactions...');
    const { transactions, pages } = await fetchD365Transactions(token, startDate, endDate, storeId, employeeId);
    console.log(`✅ Fetched ${transactions.length} transactions in ${pages} pages`);

    // Aggregate by store
    const storeMap = new Map<string, { salesAmount: number; invoices: number }>();
    transactions.forEach((tx) => {
      const id = tx.OperatingUnitNumber;
      const amount = tx.PaymentAmount || 0;
      if (!storeMap.has(id)) storeMap.set(id, { salesAmount: 0, invoices: 0 });
      const data = storeMap.get(id)!;
      data.salesAmount += amount;
      data.invoices += 1;
    });

    // Aggregate by employee
    const employeeMap = new Map<string, { salesAmount: number; invoices: number; storeId: string }>();
    transactions.forEach((tx) => {
      if (!tx.StaffId) return;
      const key = `${tx.StaffId}_${tx.StaffName || 'Unknown'}`;
      const amount = tx.PaymentAmount || 0;
      const txStoreId = tx.OperatingUnitNumber;
      if (!employeeMap.has(key)) {
        employeeMap.set(key, { salesAmount: 0, invoices: 0, storeId: txStoreId });
      }
      const data = employeeMap.get(key)!;
      data.salesAmount += amount;
      data.invoices += 1;
    });

    // Build response
    const byStore = Array.from(storeMap.entries()).map(([storeId, data]) => {
      const storeName = storeMapping.get(storeId) || storeId;
      const atv = data.invoices > 0 ? data.salesAmount / data.invoices : 0;
      return {
        storeId,
        storeName,
        salesAmount: data.salesAmount,
        invoices: data.invoices,
        kpis: {
          atv: Number.isFinite(atv) ? atv : 0,
          customerValue: Number.isFinite(atv) ? atv : 0,
        },
      };
    });

    const byEmployee = Array.from(employeeMap.entries()).map(([key, data]) => {
      const [employeeId, employeeName] = key.split('_');
      const storeName = storeMapping.get(data.storeId) || data.storeId;
      const atv = data.invoices > 0 ? data.salesAmount / data.invoices : 0;
      return {
        employeeId,
        employeeName,
        storeId: data.storeId,
        storeName,
        salesAmount: data.salesAmount,
        invoices: data.invoices,
        kpis: { atv: Number.isFinite(atv) ? atv : 0 },
      };
    });

    const totalSales = byStore.reduce((sum, s) => sum + s.salesAmount, 0);
    const totalInvoices = byStore.reduce((sum, s) => sum + s.invoices, 0);
    const totalAtv = totalInvoices > 0 ? totalSales / totalInvoices : 0;

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
    console.error('❌ Error in /api/sales:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const errorMessage = error.message || String(error);
    const errorStack = error.stack || '';
    return res.status(500).json({
      success: false,
      range: {
        from: new Date(year, 0, 1).toISOString().split('T')[0],
        to: new Date(year, 11, 31).toISOString().split('T')[0],
        year,
      },
      byStore: [],
      byEmployee: [],
      totals: { salesAmount: 0, invoices: 0, kpis: { atv: 0, customerValue: 0 } },
      debug: { 
        source: 'd365', 
        notes: [
          `Error: ${errorMessage}`,
          ...(errorStack ? [`Stack: ${errorStack.split('\n').slice(0, 3).join(' ')}`] : [])
        ] 
      },
    });
  }
}
