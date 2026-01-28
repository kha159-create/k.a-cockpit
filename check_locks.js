
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: 'localhost',
    database: 'showroom_sales',
    user: 'postgres',
    password: 'KhaKha11@',
    port: 5432,
});

async function checkLocks() {
    try {
        const res = await pool.query(`
      SELECT 
        pid, 
        now() - query_start AS duration, 
        query, 
        state,
        wait_event_type,
        wait_event
      FROM pg_stat_activity 
      WHERE state != 'idle' 
      AND query NOT LIKE '%pg_stat_activity%';
    `);
        console.log('🔒 Active Queries & Locks:');
        res.rows.forEach(r => {
            console.log(`- [${r.pid}] ${r.duration.minutes || 0}m ${r.duration.seconds || 0}s | ${r.state} | ${r.query.substring(0, 100)}`);
            if (r.wait_event) console.log(`  Waiting for: ${r.wait_event_type}:${r.wait_event}`);
        });

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

checkLocks();
