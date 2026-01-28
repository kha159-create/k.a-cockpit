
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: 'localhost',
    database: 'showroom_sales',
    user: 'postgres',
    password: 'KhaKha11@',
    port: 5432,
});

async function inspect() {
    try {
        const res = await pool.query("SELECT employee_id, name FROM employees LIMIT 10");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

inspect();
