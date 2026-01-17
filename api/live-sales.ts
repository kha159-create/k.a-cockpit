import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConfidentialClientApplication } from '@azure/msal-node';
import admin from 'firebase-admin';
import * as XLSX from 'xlsx';

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      console.error('❌ Missing Firebase credentials. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY');
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log('✅ Firebase Admin initialized successfully');
    }
  } catch (error: any) {
    console.error('❌ Firebase Admin initialization error:', error);
  }
}

let db: admin.firestore.Firestore | null = null;
try {
  db = admin.firestore();
} catch (error: any) {
  console.error('❌ Firestore initialization error:', error);
}

interface D365Transaction {
  OperatingUnitNumber: string;
  PaymentAmount: number;
  TransactionDate: string;
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
async function fetchTransactionsLastTwoDays(token: string): Promise<{
  today: D365Transaction[];
  yesterday: D365Transaction[];
}> {
  const d365Url = process.env.D365_URL || 'https://orangepax.operations.eu.dynamics.com';
  const baseUrl = `${d365Url}/data/RetailTransactions`;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

  const startStr = yesterdayStart.toISOString();
  const endStr = tomorrowStart.toISOString();

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

  // Split into today and yesterday
  const todayTransactions: D365Transaction[] = [];
  const yesterdayTransactions: D365Transaction[] = [];

  allTransactions.forEach((tx) => {
    const txDate = new Date(tx.TransactionDate);
    if (txDate >= todayStart) {
      todayTransactions.push(tx);
    } else if (txDate >= yesterdayStart && txDate < todayStart) {
      yesterdayTransactions.push(tx);
    }
  });

  return { today: todayTransactions, yesterday: yesterdayTransactions };
}

// Load store mapping from orange-dashboard (like dailysales) - LOCAL JSON, no Firestore needed
async function loadStoreMapping(): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  
  try {
    // Fetch mapping.xlsx from orange-dashboard GitHub repository (like dailysales)
    console.log('📥 Loading store mapping from orange-dashboard...');
    const response = await fetch('https://raw.githubusercontent.com/ALAAWF2/dailysales/main/backend/mapping.xlsx');
    
    if (!response.ok) {
      console.warn('⚠️ Could not fetch mapping from orange-dashboard, using empty mapping');
      return mapping;
    }
    
    const arrayBuffer = await response.arrayBuffer();
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
    // Fallback: Try Firestore if orange-dashboard fails (for backward compatibility)
    if (db) {
      try {
        const storesSnapshot = await db.collection('stores').get();
        storesSnapshot.forEach((doc) => {
          const data = doc.data();
          const storeId = String(data?.store_id || data?.id || doc.id).trim();
          const storeName = data?.name || data?.store_name || storeId;
          mapping.set(storeId, storeName);
        });
        console.log(`✅ Fallback: Loaded ${mapping.size} stores from Firestore`);
      } catch (firestoreError) {
        console.error('❌ Firestore fallback also failed:', firestoreError);
      }
    }
  }

  return mapping;
}

// Transform and aggregate transactions
function aggregateSales(transactions: D365Transaction[], storeMapping: Map<string, string>): Array<{ outlet: string; sales: number }> {
  const salesMap = new Map<string, number>();

  transactions.forEach((tx) => {
    // OperatingUnitNumber from D365 is the 4-digit store ID (e.g., 1001, 1101, etc.)
    const storeId = String(tx.OperatingUnitNumber || '').trim();
    // Get store name from mapping, or use store ID if not found
    const storeName = storeMapping.get(storeId) || storeId;
    const amount = Number(tx.PaymentAmount) || 0;
    
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

// Optional: Save to Firestore as backup (for historical reference)
async function saveLiveSalesToFirestore(
  todayData: Array<{ outlet: string; sales: number }>,
  yesterdayData: Array<{ outlet: string; sales: number }>
): Promise<void> {
  if (!db) {
    console.warn('⚠️ Firestore not initialized, skipping Firestore backup');
    return;
  }
  
  try {
    const now = new Date();
    const docRef = db.collection('liveSales').doc('today');
    
    await docRef.set({
      date: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), now.getDate())),
      lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdateTime: now.toTimeString().slice(0, 5), // HH:MM format
      today: todayData,
      yesterday: yesterdayData,
    }, { merge: true });
    console.log('✅ Saved to Firestore (backup)');
  } catch (error: any) {
    console.warn('⚠️ Firestore backup failed:', error.message);
  }
}

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
    // Note: Firebase is optional for Live Sales (we use local JSON like dailysales)
    // Only needed for optional Firestore backup
    if (!db) {
      console.warn('⚠️ Firebase not initialized - Live Sales will work but Firestore backup will be skipped');
    }

    console.log('🚀 Starting live sales sync...');

    // 1. Get access token
    const token = await getAccessToken();
    console.log('✅ Got access token');

    // 2. Fetch today's and yesterday's transactions (like dailysales)
    const { today: todayTransactions, yesterday: yesterdayTransactions } = await fetchTransactionsLastTwoDays(token);
    console.log(`✅ Fetched ${todayTransactions.length} today + ${yesterdayTransactions.length} yesterday transactions`);

    // 3. Load store mapping
    const storeMapping = await loadStoreMapping();
    console.log(`✅ Loaded ${storeMapping.size} store mappings`);

    // 4. Aggregate sales for both days
    const todaySales = aggregateSales(todayTransactions, storeMapping);
    const yesterdaySales = aggregateSales(yesterdayTransactions, storeMapping);
    console.log(`✅ Aggregated ${todaySales.length} stores today, ${yesterdaySales.length} stores yesterday`);

    // 5. Prepare JSON data (like dailysales) - for local storage
    const jsonData = prepareLiveSalesJSON(todaySales, yesterdaySales);
    console.log('✅ Prepared JSON data');
    
    // 5b. Optional: Save to Firestore as backup (for historical reference)
    await saveLiveSalesToFirestore(todaySales, yesterdaySales);

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
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Sync failed',
    });
  }
}
