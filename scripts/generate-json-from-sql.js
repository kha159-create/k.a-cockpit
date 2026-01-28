/**
 * Generate JSON files from PostgreSQL (like generate_management_data.py)
 * Run locally: node scripts/generate-json-from-sql.js
 * 
 * This script:
 * 1. Connects to local PostgreSQL database
 * 2. Generates management_data.json (like generate_management_data.py)
 * 3. Optionally commits and pushes to GitHub
 */

import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'showroom_sales',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'KhaKha11@',
  port: parseInt(process.env.PG_PORT || '5432'),
  ssl: false, // Local DB
});

async function generateManagementData() {
  console.log('🚀 Generating management_data.json from PostgreSQL...');
  const startTime = Date.now();

  const client = await pool.connect();
  try {
    // 1. Fetch Sales Data
    console.log('  📊 Fetching sales data...');
    const salesResult = await client.query(`
      SELECT 
        item_date::text as item_date,
        store_number::text as store_number,
        SUM(net_amount) as total_sales
      FROM dynamic_sales_items 
      GROUP BY item_date, store_number
      ORDER BY item_date ASC
    `);

    // 2. Fetch Store Mapping
    console.log('  🏪 Fetching store mapping...');
    const storesResult = await client.query(`
      SELECT 
        outlet_name,
        dynamic_number::text as dynamic_number,
        area_manager,
        city
      FROM gofrugal_outlets_mapping 
      WHERE dynamic_number IS NOT NULL
    `);

    // 3. Fetch Legacy Sales (2024-2025)
    console.log('  📜 Fetching legacy sales...');
    const legacySalesResult = await client.query(`
      SELECT 
        bill_date::text as item_date,
        outlet_name,
        SUM(net_amount) as total_sales
      FROM gofrugal_sales
      WHERE bill_date <= '2025-12-31'
      GROUP BY bill_date, outlet_name
    `);

    // 4. Fetch Targets
    console.log('  🎯 Fetching targets...');
    const targetsResult = await client.query(`
      SELECT 
        target_date::text as target_date,
        outlet_name,
        target_amount
      FROM gofrugal_targets
    `);

    // 5. Fetch Visitors
    console.log('  👥 Fetching visitors...');
    const visitorsResult = await client.query(`
      SELECT 
        visit_date::text as visit_date,
        outlet_name,
        visitor_count
      FROM gofrugal_visitors
    `);

    // Process data
    const storeMap = {};
    const storeMeta = {};
    const areaMap = {};
    const nameToId = {};

    storesResult.rows.forEach((row) => {
      const storeId = String(row.dynamic_number);
      storeMap[storeId] = row.outlet_name;
      nameToId[row.outlet_name] = storeId;
      areaMap[storeId] = row.area_manager || 'Unknown';
      
      const name = String(row.outlet_name).toLowerCase();
      const isOnline = name.includes('warehouse') || name.includes('platform');
      
      storeMeta[storeId] = {
        city: row.city || 'Unknown',
        manager: row.area_manager || 'Unknown',
        type: isOnline ? 'Online' : 'Showroom',
      };
    });

    // Build sales array (merge dynamic + legacy)
    const salesData = [];
    
    // Add dynamic sales
    salesResult.rows.forEach((row) => {
      salesData.push([
        row.item_date,
        String(row.store_number),
        Math.round(Number(row.total_sales) * 100) / 100,
      ]);
    });

    // Add legacy sales (map outlet_name to store_number)
    legacySalesResult.rows.forEach((row) => {
      const storeId = nameToId[row.outlet_name];
      if (storeId) {
        salesData.push([
          row.item_date,
          storeId,
          Math.round(Number(row.total_sales) * 100) / 100,
        ]);
      }
    });

    // Build targets array
    const targetsData = [];
    targetsResult.rows.forEach((row) => {
      const storeId = nameToId[row.outlet_name];
      if (storeId) {
        targetsData.push([
          row.target_date,
          storeId,
          Math.round(Number(row.target_amount) * 100) / 100,
        ]);
      }
    });

    // Build visitors array
    const visitorsData = [];
    visitorsResult.rows.forEach((row) => {
      const storeId = nameToId[row.outlet_name];
      if (storeId) {
        visitorsData.push([
          row.visit_date,
          storeId,
          Number(row.visitor_count),
        ]);
      }
    });

    const managementData = {
      metadata: {
        generated_at: new Date().toISOString(),
        total_sales_records: salesData.length,
        total_target_records: targetsData.length,
        total_visitor_records: visitorsData.length,
        ramadan_dates: [],
      },
      stores: storeMap,
      store_meta: storeMeta,
      areas: areaMap,
      sales: salesData,
      targets: targetsData,
      visitors: visitorsData,
      transactions: [],
    };

    // Save to file
    const outputDir = join(__dirname, '..', 'public', 'data');
    mkdirSync(outputDir, { recursive: true });
    const outputFile = join(outputDir, 'management_data.json');
    
    writeFileSync(outputFile, JSON.stringify(managementData, null, 2), 'utf-8');
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ Generated ${outputFile} in ${elapsed}ms`);
    console.log(`   Sales: ${salesData.length} records`);
    console.log(`   Targets: ${targetsData.length} records`);
    console.log(`   Visitors: ${visitorsData.length} records`);

    return managementData;
  } finally {
    client.release();
    await pool.end();
  }
}

generateManagementData()
  .then(() => {
    console.log('\n✨ Done!');
    console.log('💡 Next step: Commit and push management_data.json to GitHub');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
