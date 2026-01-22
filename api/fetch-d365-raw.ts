/**
 * Fetch raw D365 transactions and items (for saving to SQL)
 * This endpoint fetches raw data from D365 and saves it to dynamic_sales_bills and dynamic_sales_items
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'showroom_sales',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  port: parseInt(process.env.PG_PORT || '5432'),
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

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

interface D365RawTransaction {
  '@odata.etag'?: string;
  OperatingUnitNumber: string;
  TransactionDate: string;
  PaymentAmount: number;
  TransactionId: string;
  [key: string]: any;
}

interface D365RawItem {
  '@odata.etag'?: string;
  OperatingUnitNumber: string;
  TransactionId: string;
  SalesGroup?: string;
  NetAmount: number;
  Quantity: number;
  TransactionStatus?: string;
  ItemDate: string;
  ItemId: string;
  [key: string]: any;
}

async function fetchRawTransactions(
  token: string,
  startDate: Date,
  endDate: Date,
  storeId: string | undefined,
  entity: string,
  amountField: string
): Promise<D365RawTransaction[]> {
  const d365Url = process.env.D365_URL || 'https://orangepax.operations.eu.dynamics.com';
  const baseUrl = `${d365Url}/data/${entity}`;

  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  let filter = `${amountField} ne 0 and TransactionDate ge ${startStr} and TransactionDate lt ${endStr}`;
  if (storeId) {
    filter += ` and OperatingUnitNumber eq '${storeId}'`;
  }

  const selectFields = `OperatingUnitNumber,${amountField},TransactionDate,TransactionId`;
  const queryUrl = `${baseUrl}?$filter=${encodeURIComponent(filter)}&$select=${encodeURIComponent(selectFields)}&$orderby=TransactionDate`;

  const allTransactions: D365RawTransaction[] = [];
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
    if (!data || !Array.isArray(data.value)) {
      throw new Error('D365 API returned invalid response');
    }

    const transactions: D365RawTransaction[] = data.value.map((item: any) => ({
      '@odata.etag': item['@odata.etag'],
      OperatingUnitNumber: String(item.OperatingUnitNumber || '').trim(),
      TransactionDate: item.TransactionDate || '',
      PaymentAmount: Number(item[amountField] || 0),
      TransactionId: item.TransactionId || `${item.OperatingUnitNumber}_${item.TransactionDate}_${Math.random()}`,
    }));

    allTransactions.push(...transactions);
    nextLink = data['@odata.nextLink'] || null;
  }

  return allTransactions;
}

async function fetchRawItems(
  token: string,
  startDate: Date,
  endDate: Date,
  storeId: string | undefined
): Promise<D365RawItem[]> {
  const d365Url = process.env.D365_URL || 'https://orangepax.operations.eu.dynamics.com';
  const baseUrl = `${d365Url}/data/RetailTransactionSalesTrans`;

  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  let filter = `ItemDate ge ${startStr} and ItemDate lt ${endStr}`;
  if (storeId) {
    filter += ` and OperatingUnitNumber eq '${storeId}'`;
  }

  const selectFields = `OperatingUnitNumber,TransactionId,SalesGroup,NetAmount,Quantity,TransactionStatus,ItemDate,ItemId`;
  const queryUrl = `${baseUrl}?$filter=${encodeURIComponent(filter)}&$select=${encodeURIComponent(selectFields)}&$orderby=ItemDate`;

  const allItems: D365RawItem[] = [];
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
      console.warn(`⚠️ Failed to fetch items: ${response.status} ${response.statusText}`);
      break; // Items are optional, continue without them
    }

    const data: any = await response.json();
    if (!data || !Array.isArray(data.value)) {
      break;
    }

    const items: D365RawItem[] = data.value.map((item: any) => ({
      '@odata.etag': item['@odata.etag'],
      OperatingUnitNumber: String(item.OperatingUnitNumber || '').trim(),
      TransactionId: item.TransactionId || '',
      SalesGroup: item.SalesGroup || null,
      NetAmount: Number(item.NetAmount || 0),
      Quantity: Number(item.Quantity || 0),
      TransactionStatus: item.TransactionStatus || null,
      ItemDate: item.ItemDate || '',
      ItemId: item.ItemId || '',
    }));

    allItems.push(...items);
    nextLink = data['@odata.nextLink'] || null;
  }

  return allItems;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { year, month, storeId } = req.body;

    if (!year || year < 2026) {
      return res.status(400).json({ error: 'Year must be 2026 or later' });
    }

    const startDate = new Date(Date.UTC(year, month || 0, 1, 0, 0, 0));
    const lastDayOfMonth = new Date(Date.UTC(year, (month || 0) + 1, 0));
    const endDate = new Date(Date.UTC(
      lastDayOfMonth.getUTCFullYear(),
      lastDayOfMonth.getUTCMonth(),
      lastDayOfMonth.getUTCDate(),
      23, 59, 59
    ));

    console.log(`📥 Fetching raw D365 data for ${year}-${(month || 0) + 1}...`);

    // Get access token
    const token = await getAccessToken();

    // Fetch raw transactions and items
    const [transactions, items] = await Promise.all([
      fetchRawTransactions(token, startDate, endDate, storeId, 'RetailTransactions', 'PaymentAmount'),
      fetchRawItems(token, startDate, endDate, storeId).catch(() => []), // Items are optional
    ]);

    console.log(`✅ Fetched ${transactions.length} transactions and ${items.length} items from D365`);

    // Save to SQL
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing data for this period
      await client.query(
        `DELETE FROM dynamic_sales_bills WHERE bill_date >= $1 AND bill_date <= $2`,
        [startDate, endDate]
      );
      await client.query(
        `DELETE FROM dynamic_sales_items WHERE item_date >= $1 AND item_date <= $2`,
        [startDate, endDate]
      );

      // Insert bills in batches
      if (transactions.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < transactions.length; i += batchSize) {
          const batch = transactions.slice(i, i + batchSize);
          const values = batch.map((_, idx) => 
            `($${idx * 6 + 1}, $${idx * 6 + 2}, $${idx * 6 + 3}, $${idx * 6 + 4}, $${idx * 6 + 5}, $${idx * 6 + 6})`
          ).join(', ');
          const params = batch.flatMap(tx => [
            tx['@odata.etag'] || null,
            tx.OperatingUnitNumber,
            tx.TransactionDate ? new Date(tx.TransactionDate) : null,
            tx.PaymentAmount || 0,
            tx.TransactionId,
            0, // item_lines_count (will be calculated from items)
          ]);

          await client.query(
            `INSERT INTO dynamic_sales_bills ("@odata.etag", store_number, bill_date, payment_amount, transaction_id, item_lines_count) VALUES ${values} ON CONFLICT DO NOTHING`,
            params
          );
        }
        console.log(`✅ Inserted ${transactions.length} bills`);
      }

      // Insert items in batches
      if (items.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          const values = batch.map((_, idx) => 
            `($${idx * 9 + 1}, $${idx * 9 + 2}, $${idx * 9 + 3}, $${idx * 9 + 4}, $${idx * 9 + 5}, $${idx * 9 + 6}, $${idx * 9 + 7}, $${idx * 9 + 8}, $${idx * 9 + 9})`
          ).join(', ');
          const params = batch.flatMap(item => [
            item['@odata.etag'] || null,
            item.OperatingUnitNumber,
            item.TransactionId,
            item.SalesGroup || null,
            item.NetAmount || 0,
            item.Quantity || 0,
            item.TransactionStatus || null,
            item.ItemDate ? new Date(item.ItemDate) : null,
            item.ItemId,
          ]);

          await client.query(
            `INSERT INTO dynamic_sales_items ("@odata.etag", store_number, transaction_id, sales_group, net_amount, quantity, transaction_status, item_date, item_id) VALUES ${values} ON CONFLICT DO NOTHING`,
            params
          );
        }
        console.log(`✅ Inserted ${items.length} items`);
      }

      // Update item_lines_count in bills based on items
      await client.query(`
        UPDATE dynamic_sales_bills b
        SET item_lines_count = (
          SELECT COUNT(*) 
          FROM dynamic_sales_items i 
          WHERE i.transaction_id = b.transaction_id
        )
        WHERE b.bill_date >= $1 AND b.bill_date <= $2
      `, [startDate, endDate]);

      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: `Saved ${transactions.length} bills and ${items.length} items to SQL`,
        billsCount: transactions.length,
        itemsCount: items.length,
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('❌ Error fetching/saving D365 raw data:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
