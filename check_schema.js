
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: 'localhost',
    database: 'showroom_sales',
    user: 'postgres',
    password: 'KhaKha11@',
    port: 5432,
});

async function checkSchema() {
    try {
        const res = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'dynamic_sales_bills';
    `);
        console.log('🔍 Indexes for dynamic_sales_bills:');
        res.rows.forEach(r => console.log(`- ${r.indexname}: ${r.indexdef}`));

        const countRes = await pool.query("SELECT count(*) FROM dynamic_sales_bills");
        console.log('\n📊 Total rows in dynamic_sales_bills:', countRes.rows[0].count);

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

checkSchema();
