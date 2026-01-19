import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConfidentialClientApplication } from '@azure/msal-node';
import * as XLSX from 'xlsx';

// NO Firestore - Pure D365 API like orange-dashboard

interface D365Transaction {
  OperatingUnitNumber: string;
  TransactionDate: string;
  [key: string]: any;
}

// Get access token from Microsoft Dynamics 365
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

// Fetch today's and yesterday's transactions from D365 (like dailysales)
async function fetchTransactionsLastTwoDays(
  token: string,
  entity: string,
  amountField: string
): Promise<{
  today: D365Transaction[];
  yesterday: D365Transaction[];
}> {
  const d365Url = process.env.D365_URL || 'https://orangepax.operations.eu.dynamics.com';
  const baseUrl = `${d365Url}/data/${entity}`;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

  const startStr = yesterdayStart.toISOString();
  const endStr = tomorrowStart.toISOString();

  const queryUrl = `${baseUrl}?$filter=${amountField} ne 0 and TransactionDate ge ${startStr} and TransactionDate lt ${endStr}&$select=OperatingUnitNumber,${amountField},TransactionDate&$orderby=TransactionDate`;

  const allTransactions: D365Transaction[] = [];
  let nextLink: string | null = queryUrl;

  while (nextLink) {
    const response: Response = await fetch(nextLink, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        Prefer: 'odata.maxpagesize=5000',
      },
    });

    if (!response.ok) {
      throw new Error(`D365 API error: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();
    allTransactions.push(...(data.value || []));
    nextLink = data['@odata.nextLink'] || null;
  }

  // Split into today and yesterday based on Saudi Arabia time (UTC+3)
  // After 12 AM SAST (midnight Saudi time), sales belong to "today"
  // Before 12 AM SAST, sales belong to "yesterday"
  
  // Get current Saudi time (UTC+3)
  const nowSaudi = new Date(now.getTime() + (3 * 60 * 60 * 1000)); // UTC+3
  const saudiYear = nowSaudi.getUTCFullYear();
  const saudiMonth = nowSaudi.getUTCMonth();
  const saudiDate = nowSaudi.getUTCDate();
  const saudiHour = nowSaudi.getUTCHours();
  
  // Today starts at 00:00 SAST (which is 21:00 UTC of previous day)
  // Yesterday starts at 00:00 SAST of previous day (which is 21:00 UTC two days ago)
  
  // Calculate today's start in Saudi time (00:00 SAST = 21:00 UTC previous day)
  const saudiTodayStart = new Date(Date.UTC(saudiYear, saudiMonth, saudiDate, 0, 0, 0));
  const saudiTodayStartUTC = new Date(saudiTodayStart.getTime() - (3 * 60 * 60 * 1000)); // Convert SAST to UTC
  
  // Calculate yesterday's start in Saudi time
  const saudiYesterdayStart = new Date(Date.UTC(saudiYear, saudiMonth, saudiDate - 1, 0, 0, 0));
  const saudiYesterdayStartUTC = new Date(saudiYesterdayStart.getTime() - (3 * 60 * 60 * 1000)); // Convert SAST to UTC

  const todayTransactions: D365Transaction[] = [];
  const yesterdayTransactions: D365Transaction[] = [];

  allTransactions.forEach((tx) => {
    const txDate = new Date(tx.TransactionDate);
    // Compare based on Saudi time boundaries (00:00 SAST = 21:00 UTC previous day)
    // All transactions >= today 00:00 SAST belong to today
    if (txDate >= saudiTodayStartUTC) {
      todayTransactions.push(tx);
    } 
    // All transactions >= yesterday 00:00 SAST and < today 00:00 SAST belong to yesterday
    else if (txDate >= saudiYesterdayStartUTC && txDate < saudiTodayStartUTC) {
      yesterdayTransactions.push(tx);
    }
  });
  
  console.log(`📅 Saudi time: ${nowSaudi.toISOString()} (${saudiHour}:00 SAST), Today UTC boundary: ${saudiTodayStartUTC.toISOString()}, Yesterday UTC boundary: ${saudiYesterdayStartUTC.toISOString()}`);
  console.log(`📊 Split: ${todayTransactions.length} today (after 12 AM SAST), ${yesterdayTransactions.length} yesterday (before 12 AM SAST)`);

  return { today: todayTransactions, yesterday: yesterdayTransactions };
}

// Load store mapping from orange-dashboard (like dailysales) - LOCAL JSON, no Firestore needed
async function loadStoreMapping(): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  
  try {
    // Fetch mapping.xlsx from orange-dashboard GitHub repository (like dailysales)
    console.log('📥 Loading store mapping from orange-dashboard...');
    const response: Response = await fetch('https://raw.githubusercontent.com/ALAAWF2/dailysales/main/backend/mapping.xlsx');
    
    if (!response.ok) {
      console.warn('⚠️ Could not fetch mapping from orange-dashboard, using empty mapping');
      return mapping;
    }
    
    const arrayBuffer: ArrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Parse Excel using XLSX (same as dailysales)
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as any[];
    
    // Find columns (flexible matching like dailysales fetch_sales.py)
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
    
    console.log(`📊 Excel columns: ${storeIdCol} -> ${storeNameCol}`);
    
    // Build mapping
    data.forEach((row: any) => {
      const storeId = String(row[storeIdCol] || '').trim();
      const storeName = String(row[storeNameCol] || '').trim();
      if (storeId && storeName && storeId !== 'NaN' && storeName !== 'NaN') {
        mapping.set(storeId, storeName);
      }
    });
    
    console.log(`✅ Loaded ${mapping.size} store mappings from orange-dashboard`);
  } catch (error: any) {
    console.error('❌ Error loading store mapping from orange-dashboard:', error.message);
    // NO Firestore fallback - pure orange-dashboard approach
  }

  return mapping;
}

// Transform and aggregate transactions
function aggregateSales(
  transactions: D365Transaction[],
  storeMapping: Map<string, string>,
  amountField: string
): Array<{ outlet: string; sales: number }> {
  const salesMap = new Map<string, number>();

  transactions.forEach((tx) => {
    // OperatingUnitNumber from D365 is the 4-digit store ID (e.g., 1001, 1101, etc.)
    const storeId = String(tx.OperatingUnitNumber || '').trim();
    // Get store name from mapping, or use store ID if not found
    const storeName = storeMapping.get(storeId) || storeId;
    const amount = Number((tx as any)[amountField]) || 0;
    
    if (amount === 0) return;

    const current = salesMap.get(storeName) || 0;
    salesMap.set(storeName, current + amount);
  });

  return Array.from(salesMap.entries())
    .map(([outlet, sales]) => ({ outlet, sales: Math.round(sales) }))
    .sort((a, b) => b.sales - a.sales);
}

// Save to JSON response (like dailysales) - for local storage
// Note: Vercel functions can't write files, so we return JSON for client-side storage
function prepareLiveSalesJSON(
  todayData: Array<{ outlet: string; sales: number }>,
  yesterdayData: Array<{ outlet: string; sales: number }>
): any {
  // Convert to Saudi Arabia time (UTC+3)
  const now = new Date();
  const saudiTime = new Date(now.getTime() + (3 * 60 * 60 * 1000)); // UTC+3
  
  // Format date in Saudi time
  const saudiDateStr = saudiTime.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Format time in Saudi time (HH:MM)
  const hours = String(saudiTime.getUTCHours()).padStart(2, '0');
  const minutes = String(saudiTime.getUTCMinutes()).padStart(2, '0');
  const saudiTimeStr = `${hours}:${minutes}`;
  
  return {
    date: saudiDateStr, // YYYY-MM-DD (Saudi time)
    lastUpdate: saudiTimeStr, // HH:MM format (Saudi time)
    today: todayData,
    yesterday: yesterdayData,
  };
}

// NO Firestore - Pure JSON response like orange-dashboard

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS for cross-origin requests (GitHub Pages to Vercel API)
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://kha159-create.github.io',
    'https://k-a-cockpit.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Allow requests without origin (same-origin)
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret, x-vercel-cron');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Vercel Cron Jobs send a special header
  const isCronRequest = req.headers['x-vercel-cron'] === '1';
  
  // Allow GET requests from client-side (for live page polling)
  // Allow Vercel Cron requests automatically
  // Only protect POST requests with secret
  if (req.method === 'POST' && !isCronRequest) {
    const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
    const authHeader = req.headers.authorization;
    const expectedSecret = process.env.CRON_SECRET;
    
    if (authHeader !== `Bearer ${expectedSecret}` && cronSecret !== expectedSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  
  // GET requests are allowed without authentication (for client-side polling)

  try {
    // NO Firestore - Pure D365 API like orange-dashboard
    console.log('🚀 Starting live sales sync (orange-dashboard style, NO Firestore)...');

    // 1. Get access token
    const token = await getAccessToken();
    console.log('✅ Got access token');

    // 2. Fetch today's and yesterday's transactions (like dailysales)
    const entityFromEnv = process.env.D365_SALES_ENTITY || 'SalesTransactionBIEntity';
    const amountFieldFromEnv = process.env.D365_SALES_AMOUNT_FIELD || 'NetAmount';
    const { today: todayTransactions, yesterday: yesterdayTransactions } = await fetchTransactionsLastTwoDays(
      token,
      entityFromEnv,
      amountFieldFromEnv
    );
    console.log(`✅ Fetched ${todayTransactions.length} today + ${yesterdayTransactions.length} yesterday transactions (${entityFromEnv}/${amountFieldFromEnv})`);

    // 3. Load store mapping
    const storeMapping = await loadStoreMapping();
    console.log(`✅ Loaded ${storeMapping.size} store mappings`);

    // 4. Aggregate sales for both days
    const todaySales = aggregateSales(todayTransactions, storeMapping, amountFieldFromEnv);
    const yesterdaySales = aggregateSales(yesterdayTransactions, storeMapping, amountFieldFromEnv);
    console.log(`✅ Aggregated ${todaySales.length} stores today, ${yesterdaySales.length} stores yesterday`);

    // 5. Prepare JSON data (like dailysales) - for local storage
    // NO Firestore - Pure JSON response like orange-dashboard
    const jsonData = prepareLiveSalesJSON(todaySales, yesterdaySales);
    console.log('✅ Prepared JSON data (NO Firestore)');

    return res.status(200).json({
      success: true,
      message: 'Live sales updated',
      date: jsonData.date,
      lastUpdate: jsonData.lastUpdate,
      today: jsonData.today,
      yesterday: jsonData.yesterday,
      // Metadata for debugging
      todayStoresCount: todaySales.length,
      yesterdayStoresCount: yesterdaySales.length,
      todayTransactionsCount: todayTransactions.length,
      yesterdayTransactionsCount: yesterdayTransactions.length,
    });
  } catch (error: any) {
    console.error('❌ Live sales sync error:', error);
    
    // Never crash - return empty data with consistent schema
    const now = new Date();
    const saudiTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    const saudiDateStr = saudiTime.toISOString().split('T')[0];
    const hours = String(saudiTime.getUTCHours()).padStart(2, '0');
    const minutes = String(saudiTime.getUTCMinutes()).padStart(2, '0');
    
    return res.status(200).json({
      success: true,
      message: 'Live sales (empty - error occurred)',
      date: saudiDateStr,
      lastUpdate: `${hours}:${minutes}`,
      today: [],
      yesterday: [],
      todayStoresCount: 0,
      yesterdayStoresCount: 0,
      todayTransactionsCount: 0,
      yesterdayTransactionsCount: 0,
      error: error.message || 'Sync failed',
    });
  }
}
