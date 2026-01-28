import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DATABASE || 'showroom_sales',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    port: parseInt(process.env.PG_PORT || '5432'),
});

async function fixSchema() {
    const client = await pool.connect();
    try {
        console.log('🚀 Fixing schema...');
        await client.query(`
      ALTER TABLE stores ALTER COLUMN store_id TYPE TEXT;
      ALTER TABLE stores ALTER COLUMN name TYPE TEXT;
      ALTER TABLE stores ALTER COLUMN city TYPE TEXT;
      ALTER TABLE stores ALTER COLUMN area_manager TYPE TEXT;
      ALTER TABLE stores ALTER COLUMN type TYPE TEXT;
    `);

        // Check if employees exists and fix
        const empTable = await client.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'employees'");
        if (empTable.rows.length > 0) {
            await client.query(`
        ALTER TABLE employees ALTER COLUMN employee_id TYPE TEXT;
        ALTER TABLE employees ALTER COLUMN name TYPE TEXT;
        ALTER TABLE employees ALTER COLUMN current_store TYPE TEXT;
        ALTER TABLE employees ALTER COLUMN status TYPE TEXT;
      `);
        }
        console.log('✅ Schema fixed successfully');
    } catch (err) {
        console.error('❌ Error fixing schema:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

fixSchema();
