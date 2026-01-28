/**
 * Verify employee-store mappings
 * Run with: node scripts/verify_mappings.js
 */

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'showroom_sales',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'KhaKha11@',
  port: parseInt(process.env.PG_PORT || '5432'),
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function verifyMappings() {
  const client = await pool.connect();
  try {
    console.log('🔍 Verifying employee-store mappings...\n');

    // Check if employee_store_mapping table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'employee_store_mapping'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('⚠️  employee_store_mapping table does not exist.');
      console.log('   Run: node scripts/create_employee_mapping.js\n');
    } else {
      // Check employee_store_mapping table
      const mappingResult = await client.query(`
        SELECT 
          employee_name,
          outlet_name,
          employee_id,
          last_sale_date,
          total_sales,
          total_invoices
        FROM employee_store_mapping
        ORDER BY employee_name, outlet_name
        LIMIT 20
      `);

      console.log(`📊 Found ${mappingResult.rowCount} mappings (showing first 20):\n`);
      if (mappingResult.rows.length > 0) {
        console.table(mappingResult.rows);
      } else {
        console.log('⚠️  No mappings found. Run scripts/create_employee_mapping.js to populate.');
      }
    }

    // Check gofrugal_employee_mapping table
    const gofrugalResult = await client.query(`
      SELECT 
        employee_id,
        sales_group,
        arabic_name
      FROM gofrugal_employee_mapping
      ORDER BY arabic_name
      LIMIT 20
    `);

    console.log(`\n📊 Found ${gofrugalResult.rowCount} GoFrugal employee mappings (showing first 20):\n`);
    if (gofrugalResult.rows.length > 0) {
      console.table(gofrugalResult.rows);
    } else {
      console.log('⚠️  No GoFrugal mappings found.');
    }

    // Check users table
    const usersResult = await client.query(`
      SELECT 
        id,
        username,
        role,
        display_name
      FROM public.users
      ORDER BY role, username
    `);

    console.log(`\n👥 Found ${usersResult.rowCount} users:\n`);
    if (usersResult.rows.length > 0) {
      console.table(usersResult.rows);
    } else {
      console.log('⚠️  No users found. Run scripts/seed_users.js to populate.');
    }

  } catch (error) {
    console.error('❌ Error verifying mappings:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

verifyMappings()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });
