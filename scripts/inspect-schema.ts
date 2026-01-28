
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DATABASE || 'showroom_sales',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    port: parseInt(process.env.PG_PORT || '5432'),
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function run() {
    try {
        console.log('🔍 Inspecting Schema...');

        // Check Employees Columns
        console.log('\n👤 Employees Table Columns:');
        const empRes = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'employees'
        `);
        console.log(empRes.rows.map(r => r.column_name).join(', '));

        // Check Legacy Sales Columns
        console.log('\n📜 GoFrugal Sales Columns:');
        const legacyRes = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'gofrugal_sales'
        `);
        console.log(legacyRes.rows.map(r => r.column_name).join(', '));

        // Check Legacy Targets Columns
        console.log('\n🎯 GoFrugal Targets Columns:');
        const legacyTargetRes = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'gofrugal_targets'
        `);
        console.log(legacyTargetRes.rows.map(r => r.column_name).join(', '));

        // Check Legacy Mapping Columns
        console.log('\n🗺️ GoFrugal Mapping Columns:');
        const legacyMapRes = await pool.query(`
             SELECT column_name 
             FROM information_schema.columns 
             WHERE table_name = 'gofrugal_outlets_mapping'
         `);
        console.log(legacyMapRes.rows.map(r => r.column_name).join(', '));

        console.log('\n🧾 Dynamic Sales Bills Columns:');
        const d365Res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'dynamic_sales_bills'
        `);
        console.log(d365Res.rows.map(r => r.column_name).join(', '));

        console.log('\n✅ Inspection Complete');

    } catch (e: any) {
        console.error('🔥 Schema Inspection Error:', e);
    } finally {
        await pool.end();
    }
}

run();
