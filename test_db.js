
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: 'localhost',
    database: 'showroom_sales',
    user: 'postgres',
    password: 'KhaKha11@',
    port: 5432,
});

async function checkData() {
    try {
        const q1 = await pool.query("SELECT count(*) FROM dynamic_sales_bills WHERE bill_date >= '2026-01-01'");
        console.log('📈 2026 Sales Count:', q1.rows[0].count);

        const q2 = await pool.query("SELECT count(*) FROM stores");
        console.log('🏪 Stores Count:', q2.rows[0].count);

        const q3 = await pool.query("SELECT count(*) FROM employees");
        console.log('👥 Employees Count:', q3.rows[0].count);

        const q4 = await pool.query("SELECT min(bill_date), max(bill_date) FROM dynamic_sales_bills");
        console.log('📅 dynamic_sales_bills Range:', q4.rows[0]);

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

checkData();
