/**
 * Seed users table from reference project's users.js
 * Run with: node scripts/seed_users.js
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'showroom_sales',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'KhaKha11@',
  port: parseInt(process.env.PG_PORT || '5432'),
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Users from reference project (allorangedashboard/users.js)
const USERS = {
  'Sales Manager': { pin: '6587', role: 'admin' },
  'المنطقة الغربية': { pin: '1478', role: 'general_manager' },
  'اماني عسيري': { pin: '3698', role: 'area_manager' },
  'جهاد ايوبي': { pin: '2587', role: 'area_manager' },
  'خليل الصانع': { pin: '2131', role: 'area_manager' },
  'رضوان عطيوي': { pin: '7643', role: 'area_manager' },
  'شريفة العمري': { pin: '8491', role: 'area_manager' },
  'عبد الجليل الحبال': { pin: '1637', role: 'area_manager' },
  'عبدالله السرداح': { pin: '4618', role: 'area_manager' },
  'عبيدة السباعي': { pin: '1647', role: 'area_manager' },
  'محمدكلو': { pin: '4891', role: 'area_manager' },
  'منطقة الطائف': { pin: '6342', role: 'general_manager' },
};

async function seedUsers() {
  const client = await pool.connect();
  try {
    console.log('🔧 Creating public.users table if not exists...');

    // Create table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'employee',
        display_name TEXT,
        created_at TIMESTAMP DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_users_username ON public.users (username);
    `);

    // Add updated_at column if it doesn't exist
    try {
      await client.query(`
        ALTER TABLE public.users 
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();
      `);
    } catch (err) {
      // Column might already exist, ignore
      console.log('  (updated_at column already exists or error adding it)');
    }

    console.log('✅ Table created/verified');

    // Insert users
    console.log(`📝 Inserting ${Object.keys(USERS).length} users...`);

    for (const [username, { pin, role }] of Object.entries(USERS)) {
      await client.query(
        `
        INSERT INTO public.users (username, password, role, display_name)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (username) 
        DO UPDATE SET
          password = EXCLUDED.password,
          role = EXCLUDED.role,
          display_name = EXCLUDED.display_name
        `,
        [username, pin, role, username]
      );
      console.log(`  ✓ ${username} (${role})`);
    }

    // Verify
    const result = await client.query(`
      SELECT id, username, password, role, display_name
      FROM public.users
      ORDER BY role, username
    `);

    console.log(`\n✅ Successfully seeded ${result.rows.length} users:\n`);
    console.table(result.rows.map((r) => ({
      id: r.id,
      username: r.username,
      pin: r.password,
      role: r.role,
      display_name: r.display_name,
    })));

  } catch (error) {
    console.error('❌ Error seeding users:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedUsers()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });
