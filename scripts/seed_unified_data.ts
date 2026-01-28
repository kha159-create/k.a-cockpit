
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import * as url from 'url';
import * as dotenv from 'dotenv';
dotenv.config();

// ESM dirname fix
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

// Configuration
const PG_CONFIG = {
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DATABASE || 'showroom_sales',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'KhaKha11@',
    port: parseInt(process.env.PG_PORT || '5432'),
    ssl: false,
};

const REF_REPO_PATH = path.join(__dirname, '../temp_ref_repo');
const MGMT_DATA_PATH = path.join(REF_REPO_PATH, 'management_data.json');

const pool = new Pool(PG_CONFIG);

async function main() {
    console.log('🚀 Starting Unified Data Seeding...');

    try {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 0. Ensure Schema Exists (Run Migration SQL)
            console.log('🏗️ Applying Database Schema...');
            const migrationSqlPath = path.join(__dirname, '../db/migration_unified.sql');
            if (fs.existsSync(migrationSqlPath)) {
                const migrationSql = fs.readFileSync(migrationSqlPath, 'utf-8');
                await client.query(migrationSql);
                console.log('✅ Schema applied successfully.');
            } else {
                console.warn('⚠️ Warning: db/migration_unified.sql not found. Assuming schema exists.');
            }

            // 1. Load Management Data
            if (!fs.existsSync(MGMT_DATA_PATH)) {
                throw new Error(`Management Data file not found at: ${MGMT_DATA_PATH}`);
            }
            const rawData = JSON.parse(fs.readFileSync(MGMT_DATA_PATH, 'utf-8'));
            console.log('📄 Loaded management_data.json');

            // ---------------------------------------------------------
            // 2. Seed Stores (from management_data.stores)
            // ---------------------------------------------------------
            console.log('🏢 Seeding Stores...');
            const stores = rawData.stores; // { "id": "Name" }
            const meta = rawData.store_meta || {}; // { "id": { city, manager, type } }

            let storeCount = 0;
            for (const [id, name] of Object.entries(stores)) {
                const m = meta[id] || {};
                await client.query(`
          INSERT INTO stores (store_id, name, city, area_manager, type)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (store_id) DO UPDATE SET
            name = EXCLUDED.name,
            city = EXCLUDED.city,
            area_manager = EXCLUDED.area_manager,
            type = EXCLUDED.type
        `, [id, name, m.city || 'Unknown', m.manager || 'Unknown', m.type || 'Showroom']);
                storeCount++;
            }
            console.log(`✅ Seeded ${storeCount} stores.`);

            // ---------------------------------------------------------
            // 3. Seed Users (Standard Set from reference)
            // ---------------------------------------------------------
            console.log('👥 Seeding Users...');
            // Manually defining based on users.js logic
            const USERS = {
                "Sales Manager": { pin: "6587", role: "Admin" },
                "المنطقة الغربية": { pin: "1478", role: "Manager" },
                "اماني عسيري": { pin: "3698", role: "Manager" },
                "جهاد ايوبي": { pin: "2587", role: "Manager" },
                "خليل الصانع": { pin: "2131", role: "Manager" },
                "رضوان عطيوي": { pin: "7643", role: "Manager" },
                "شريفة العمري": { pin: "8491", role: "Manager" },
                "عبد الجليل الحبال": { pin: "1637", role: "Manager" },
                "عبدالله السرداح": { pin: "4618", role: "Manager" },
                "عبيدة السباعي": { pin: "1647", role: "Manager" },
                "محمدكلو": { pin: "4891", role: "Manager" },
                "منطقة الطائف": { pin: "6342", role: "Manager" }
            };

            let userCount = 0;
            for (const [name, data] of Object.entries(USERS)) {
                await client.query(`
          INSERT INTO users (username, pin_hash, role, display_name)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (username) DO UPDATE SET
            pin_hash = EXCLUDED.pin_hash,
            role = EXCLUDED.role
        `, [name, data.pin, data.role, name]);
                userCount++;
            }
            console.log(`✅ Seeded ${userCount} users.`);

            // ---------------------------------------------------------
            // 4. Seed Targets
            // ---------------------------------------------------------
            console.log('🎯 Seeding Targets...');
            let targetCount = 0;
            if (rawData.targets && Array.isArray(rawData.targets)) {
                for (const row of rawData.targets) {
                    if (!Array.isArray(row) || row.length < 3) continue;

                    const [dateStr, storeId, val] = row;
                    const date = new Date(dateStr);
                    if (isNaN(date.getTime())) continue;

                    const year = date.getFullYear();
                    const month = date.getMonth() + 1; // 1-12

                    await client.query(`
            INSERT INTO targets (store_id, year, month, target_amount)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (store_id, year, month) DO UPDATE SET
                target_amount = EXCLUDED.target_amount
            `, [storeId, year, month, val]);
                    targetCount++;
                }
            }
            console.log(`✅ Seeded ${targetCount} monthly targets.`);

            // ---------------------------------------------------------
            // 5. Seed Visitors
            // ---------------------------------------------------------
            console.log('👣 Seeding Visitors...');
            let visitorCount = 0;
            if (rawData.visitors && Array.isArray(rawData.visitors)) {
                for (const row of rawData.visitors) {
                    if (!Array.isArray(row) || row.length < 3) continue;

                    const [dateStr, storeId, val] = row;

                    await client.query(`
            INSERT INTO visitors (store_id, visit_date, visitor_count)
            VALUES ($1, $2, $3)
            ON CONFLICT (store_id, visit_date) DO UPDATE SET
                visitor_count = EXCLUDED.visitor_count
            `, [storeId, dateStr, val]);
                    visitorCount++;
                }
            }
            console.log(`✅ Seeded ${visitorCount} visitor entries.`);

            await client.query('COMMIT');
            console.log('🎉 Unified Data Seeding Completed Successfully!');

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error('❌ Error during seeding:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
