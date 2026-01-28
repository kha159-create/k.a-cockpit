
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: 'localhost',
    database: 'showroom_sales',
    user: 'postgres',
    password: 'KhaKha11@',
    port: 5432,
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting Employee Mapping Migration...');

        // 1. Create mapping table
        await client.query(`
      CREATE TABLE IF NOT EXISTS employee_store_mapping (
        employee_id TEXT PRIMARY KEY,
        primary_store_id TEXT,
        txn_count INT DEFAULT 0,
        total_sales DECIMAL(15, 2) DEFAULT 0,
        computed_from_start_date DATE,
        computed_from_end_date DATE,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
        console.log('✅ Created employee_store_mapping table');

        // 2. Identify employees and their best stores from dynamic_sales_items
        const mappingRes = await client.query(`
      WITH EmployeeStats AS (
        SELECT 
          sales_group as employee_id,
          store_number as store_id,
          COUNT(DISTINCT transaction_id) as txn_count,
          SUM(net_amount) as total_sales,
          MIN(item_date) as start_date,
          MAX(item_date) as end_date
        FROM dynamic_sales_items
        WHERE sales_group IS NOT NULL AND sales_group != ''
        GROUP BY sales_group, store_number
      ),
      RankedStats AS (
        SELECT 
          *,
          ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY txn_count DESC, total_sales DESC) as rank
        FROM EmployeeStats
      )
      SELECT * FROM RankedStats WHERE rank = 1
    `);

        console.log(`📊 Found ${mappingRes.rows.length} mappings to upsert.`);

        for (const row of mappingRes.rows) {
            // Upsert into employees master table if missing
            await client.query(`
        INSERT INTO employees (employee_id, name, current_store, is_active)
        VALUES ($1, $2, $3, TRUE)
        ON CONFLICT (employee_id) DO UPDATE SET 
          current_store = EXCLUDED.current_store
      `, [row.employee_id, `Employee ${row.employee_id}`, row.store_id]);

            // Upsert into mapping table
            await client.query(`
        INSERT INTO employee_store_mapping (
          employee_id, primary_store_id, txn_count, total_sales, 
          computed_from_start_date, computed_from_end_date, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (employee_id) DO UPDATE SET
          primary_store_id = EXCLUDED.primary_store_id,
          txn_count = EXCLUDED.txn_count,
          total_sales = EXCLUDED.total_sales,
          computed_from_start_date = EXCLUDED.computed_from_start_date,
          computed_from_end_date = EXCLUDED.computed_from_end_date,
          updated_at = NOW()
      `, [row.employee_id, row.store_id, row.txn_count, row.total_sales, row.start_date, row.end_date]);
        }

        console.log('✅ Employee mapping and master table updated successfully.');

    } catch (err) {
        console.error('❌ Migration Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
