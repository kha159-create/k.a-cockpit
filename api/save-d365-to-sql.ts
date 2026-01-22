/**
 * Save D365 data to PostgreSQL (dynamic_sales_bills and dynamic_sales_items)
 * This endpoint is called after fetching data from D365 to cache it in SQL
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'showroom_sales',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  port: parseInt(process.env.PG_PORT || '5432'),
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

interface D365Bill {
  '@odata.etag'?: string;
  OperatingUnitNumber: string;
  TransactionDate: string;
  PaymentAmount: number;
  TransactionId: string;
  ItemLinesCount?: number;
}

interface D365Item {
  '@odata.etag'?: string;
  OperatingUnitNumber: string;
  TransactionId: string;
  SalesGroup?: string;
  NetAmount: number;
  Quantity: number;
  TransactionStatus?: string;
  ItemDate: string;
  ItemId: string;
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
    const { bills, items, year, month } = req.body;

    if (!bills || !items || !Array.isArray(bills) || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Invalid request: bills and items arrays required' });
    }

    console.log(`💾 Saving ${bills.length} bills and ${items.length} items to PostgreSQL...`);

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Delete existing data for this period (to avoid duplicates)
      if (year && month !== undefined) {
        const startDate = new Date(Date.UTC(year, month, 1));
        const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));
        
        await client.query(
          `DELETE FROM dynamic_sales_bills WHERE bill_date >= $1 AND bill_date <= $2`,
          [startDate, endDate]
        );
        await client.query(
          `DELETE FROM dynamic_sales_items WHERE item_date >= $1 AND item_date <= $2`,
          [startDate, endDate]
        );
        console.log(`🗑️  Deleted existing data for ${year}-${month + 1}`);
      }

      // Insert bills
      if (bills.length > 0) {
        const billsValues = bills.map((bill: D365Bill) => [
          bill['@odata.etag'] || null,
          bill.OperatingUnitNumber,
          bill.TransactionDate ? new Date(bill.TransactionDate) : null,
          bill.PaymentAmount || 0,
          bill.TransactionId,
          bill.ItemLinesCount || 0,
        ]);

        const billsQuery = `
          INSERT INTO dynamic_sales_bills 
          ("@odata.etag", store_number, bill_date, payment_amount, transaction_id, item_lines_count)
          VALUES ${billsValues.map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`).join(', ')}
          ON CONFLICT DO NOTHING
        `;

        await client.query(billsQuery, billsValues.flat());
        console.log(`✅ Inserted ${bills.length} bills`);
      }

      // Insert items (in batches of 1000 to avoid query size limits)
      if (items.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          const itemsValues = batch.map((item: D365Item) => [
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

          const itemsQuery = `
            INSERT INTO dynamic_sales_items 
            ("@odata.etag", store_number, transaction_id, sales_group, net_amount, quantity, transaction_status, item_date, item_id)
            VALUES ${itemsValues.map((_, idx) => `($${idx * 9 + 1}, $${idx * 9 + 2}, $${idx * 9 + 3}, $${idx * 9 + 4}, $${idx * 9 + 5}, $${idx * 9 + 6}, $${idx * 9 + 7}, $${idx * 9 + 8}, $${idx * 9 + 9})`).join(', ')}
            ON CONFLICT DO NOTHING
          `;

          await client.query(itemsQuery, itemsValues.flat());
        }
        console.log(`✅ Inserted ${items.length} items`);
      }

      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: `Saved ${bills.length} bills and ${items.length} items to PostgreSQL`,
        billsCount: bills.length,
        itemsCount: items.length,
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('❌ Error saving D365 data to SQL:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
