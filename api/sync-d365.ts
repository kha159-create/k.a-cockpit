import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConfidentialClientApplication } from '@azure/msal-node';
import admin from 'firebase-admin';

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

const db = admin.firestore();

interface D365Transaction {
  OperatingUnitNumber: string;
  PaymentAmount: number;
  TransactionDate: string;
}

interface StoreMapping {
  store_id: string;
  store_name: string;
}

// Get access token from Microsoft Dynamics 365
async function getAccessToken(): Promise<string> {
  const clientId = process.env.D365_CLIENT_ID;
  const clientSecret = process.env.D365_CLIENT_SECRET;
  const tenantId = process.env.D365_TENANT_ID;
  const d365Url = process.env.D365_URL || 'https://orangepax.operations.eu.dynamics.com';

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error('Missing D365 credentials. Please set D365_CLIENT_ID, D365_CLIENT_SECRET, and D365_TENANT_ID');
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

// Fetch transactions from D365 for a specific date range
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

// Load store mapping from Firestore
async function loadStoreMapping(): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  
  try {
    const storesSnapshot = await db.collection('stores').get();
    storesSnapshot.forEach((doc) => {
      const data = doc.data();
      const storeId = String(data?.store_id || data?.id || doc.id).trim();
      const storeName = data?.name || data?.store_name || storeId;
      mapping.set(storeId, storeName);
    });
  } catch (error) {
    console.error('Error loading store mapping:', error);
  }

  return mapping;
}

// Transform D365 transactions to Firestore format
function transformToFirestoreFormat(
  transactions: D365Transaction[],
  storeMapping: Map<string, string>
): {
  dailyMetrics: Map<string, { date: Date; store: string; totalSales: number; transactions: number; visitors?: number }>;
  salesTransactions: Map<string, { date: Date; store: string; totalSales: number; transactionCount: number }>;
} {
  const dailyMetrics = new Map<string, any>();
  const salesTransactions = new Map<string, any>();

  transactions.forEach((tx) => {
    const storeId = String(tx.OperatingUnitNumber || '').trim();
    const storeName = storeMapping.get(storeId) || storeId;
    const txDate = new Date(tx.TransactionDate);
    const dateKey = txDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const docKey = `${dateKey}_${storeId}`;

    const amount = Number(tx.PaymentAmount) || 0;
    if (amount === 0) return;

    // Aggregate daily metrics
    if (!dailyMetrics.has(docKey)) {
      dailyMetrics.set(docKey, {
        date: txDate,
        store: storeName,
        totalSales: 0,
        transactions: 0,
      });
    }
    const daily = dailyMetrics.get(docKey)!;
    daily.totalSales += amount;
    daily.transactions += 1;

    // Aggregate sales transactions (same structure, but we'll use it for different collection)
    if (!salesTransactions.has(docKey)) {
      salesTransactions.set(docKey, {
        date: txDate,
        store: storeName,
        totalSales: 0,
        transactionCount: 0,
      });
    }
    const sales = salesTransactions.get(docKey)!;
    sales.totalSales += amount;
    sales.transactionCount += 1;
  });

  return { dailyMetrics, salesTransactions };
}

// Write data to Firestore
async function writeToFirestore(
  dailyMetrics: Map<string, any>,
  salesTransactions: Map<string, any>
): Promise<{ success: number; errors: number }> {
  let successCount = 0;
  let errorCount = 0;

  const batch = db.batch();
  let batchCount = 0;
  const MAX_BATCH_SIZE = 500;

  // Write dailyMetrics
  for (const [docKey, data] of dailyMetrics.entries()) {
    const docRef = db.collection('dailyMetrics').doc(docKey);
    batch.set(
      docRef,
      {
        date: admin.firestore.Timestamp.fromDate(data.date),
        store: data.store,
        totalSales: data.totalSales,
        transactions: data.transactions,
        lastSynced: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    batchCount++;

    if (batchCount >= MAX_BATCH_SIZE) {
      try {
        await batch.commit();
        successCount += batchCount;
        batchCount = 0;
      } catch (error) {
        console.error('Batch commit error:', error);
        errorCount += batchCount;
        batchCount = 0;
      }
    }
  }

  // Write salesTransactions
  for (const [docKey, data] of salesTransactions.entries()) {
    const docRef = db.collection('salesTransactions').doc(docKey);
    batch.set(
      docRef,
      {
        date: admin.firestore.Timestamp.fromDate(data.date),
        store: data.store,
        totalSales: data.totalSales,
        transactionCount: data.transactionCount,
        lastSynced: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    batchCount++;

    if (batchCount >= MAX_BATCH_SIZE) {
      try {
        await batch.commit();
        successCount += batchCount;
        batchCount = 0;
      } catch (error) {
        console.error('Batch commit error:', error);
        errorCount += batchCount;
        batchCount = 0;
      }
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    try {
      await batch.commit();
      successCount += batchCount;
    } catch (error) {
      console.error('Final batch commit error:', error);
      errorCount += batchCount;
    }
  }

  return { success: successCount, errors: errorCount };
}

// Log sync result
async function logSyncResult(
  status: 'success' | 'error',
  message: string,
  details?: any
): Promise<void> {
  try {
    await db.collection('sync_logs').add({
      status,
      message,
      details,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Error logging sync result:', error);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron Jobs send a special header
  const isCronRequest = req.headers['x-vercel-cron'] === '1';
  const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
  const expectedSecret = process.env.CRON_SECRET;

  // Allow Vercel Cron requests or requests with valid secret
  if (!isCronRequest) {
    if (req.method === 'GET' && cronSecret !== expectedSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${expectedSecret}` && cronSecret !== expectedSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
  }

  try {
    console.log('🚀 Starting D365 sync...');

    // Get yesterday's date (end of day sync)
    // If running at 1 AM, we sync yesterday's data
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);

    const endDate = new Date(yesterday);
    endDate.setUTCHours(23, 59, 59, 999);

    console.log(`📅 Syncing data for: ${yesterday.toISOString().split('T')[0]}`);

    // 1. Get access token
    const token = await getAccessToken();
    console.log('✅ Got access token');

    // 2. Fetch transactions
    const transactions = await fetchTransactions(token, yesterday, endDate);
    console.log(`✅ Fetched ${transactions.length} transactions`);

    if (transactions.length === 0) {
      await logSyncResult('success', 'No transactions found for the date', {
        date: yesterday.toISOString().split('T')[0],
      });
      return res.status(200).json({
        success: true,
        message: 'No transactions found for yesterday',
        date: yesterday.toISOString().split('T')[0],
      });
    }

    // 3. Load store mapping
    const storeMapping = await loadStoreMapping();
    console.log(`✅ Loaded ${storeMapping.size} store mappings`);

    // 4. Transform data
    const { dailyMetrics, salesTransactions } = transformToFirestoreFormat(
      transactions,
      storeMapping
    );
    console.log(`✅ Transformed ${dailyMetrics.size} daily metrics and ${salesTransactions.size} sales transactions`);

    // 5. Write to Firestore
    const { success, errors } = await writeToFirestore(dailyMetrics, salesTransactions);
    console.log(`✅ Wrote ${success} documents, ${errors} errors`);

    // 6. Log result
    await logSyncResult('success', 'Sync completed successfully', {
      date: yesterday.toISOString().split('T')[0],
      transactionsCount: transactions.length,
      dailyMetricsCount: dailyMetrics.size,
      salesTransactionsCount: salesTransactions.size,
      successCount: success,
      errorCount: errors,
    });

    return res.status(200).json({
      success: true,
      message: 'Sync completed successfully',
      date: yesterday.toISOString().split('T')[0],
      transactionsCount: transactions.length,
      dailyMetricsCount: dailyMetrics.size,
      salesTransactionsCount: salesTransactions.size,
      successCount: success,
      errorCount: errors,
    });
  } catch (error: any) {
    console.error('❌ Sync error:', error);
    
    await logSyncResult('error', error.message || 'Unknown error', {
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Sync failed',
    });
  }
}
