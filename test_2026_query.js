
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: 'localhost',
    database: 'showroom_sales',
    user: 'postgres',
    password: 'KhaKha11@',
    port: 5432,
});

async function runQuery() {
    const startDate = '2026-01-01';
    const endDate = '2026-12-31';

    const salesQuery = `
      SELECT 
          s.store_id,
          s.name as store_name,
          s.city,
          COALESCE(SUM(db.payment_amount), 0) as total_sales,
          COALESCE(COUNT(db.transaction_id), 0) as invoice_count
      FROM stores s
      LEFT JOIN dynamic_sales_bills db ON s.store_id = db.store_number 
          AND db.bill_date >= $1 AND db.bill_date <= $2
      WHERE 1=1 
      GROUP BY s.store_id, s.name, s.city
  `;

    try {
        console.log('🚀 Running 2026 Query...');
        const start = Date.now();
        const res = await pool.query(salesQuery, [startDate, endDate]);
        const end = Date.now();
        console.log(`✅ Success! Found ${res.rows.length} rows in ${end - start}ms`);

        const totals = res.rows.reduce((acc, r) => ({
            sales: acc.sales + Number(r.total_sales),
            inv: acc.inv + Number(r.invoice_count)
        }), { sales: 0, inv: 0 });

        console.log('📊 Totals:', totals);

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

runQuery();
