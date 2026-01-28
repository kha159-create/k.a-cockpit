# Users and Employee Mappings Setup

## Overview
This directory contains SQL scripts and Node.js scripts to set up user authentication and employee-store mappings in the PostgreSQL database.

## Files

### SQL Scripts
- `init_users.sql` - Creates `public.users` table and inserts all users from the reference project
- `create_employee_store_mapping.sql` - Creates `employee_store_mapping` table and populates it from sales data

### Node.js Scripts
- `scripts/seed_users.js` - Seeds the `public.users` table with all users from reference project
- `scripts/create_employee_mapping.js` - Creates and populates `employee_store_mapping` table
- `scripts/verify_mappings.js` - Verifies all users and mappings are correctly set up

## Usage

### 1. Seed Users
```bash
node scripts/seed_users.js
```

This will:
- Create `public.users` table if it doesn't exist
- Insert/update all 12 users from the reference project (`allorangedashboard/users.js`)
- Map roles correctly (Admin → admin, Manager → area_manager/general_manager)

### 2. Create Employee-Store Mappings
```bash
node scripts/create_employee_mapping.js
```

This will:
- Create `employee_store_mapping` table if it doesn't exist
- Populate it from existing sales data (`gofrugal_item_sales` and `gofrugal_sales`)
- Extract employee IDs from names
- Calculate total sales and invoice counts per employee-store pair

**Note:** This script may take a while if there's a lot of sales data.

### 3. Verify Setup
```bash
node scripts/verify_mappings.js
```

This will:
- Check if `employee_store_mapping` table exists
- Show sample mappings
- Show GoFrugal employee mappings
- List all users in `public.users`

## Users Added

All users from the reference project (`allorangedashboard/users.js`):

| Username | PIN | Role |
|----------|-----|------|
| Sales Manager | 6587 | admin |
| المنطقة الغربية | 1478 | general_manager |
| اماني عسيري | 3698 | area_manager |
| جهاد ايوبي | 2587 | area_manager |
| خليل الصانع | 2131 | area_manager |
| رضوان عطيوي | 7643 | area_manager |
| شريفة العمري | 8491 | area_manager |
| عبد الجليل الحبال | 1637 | area_manager |
| عبدالله السرداح | 4618 | area_manager |
| عبيدة السباعي | 1647 | area_manager |
| محمدكلو | 4891 | area_manager |
| منطقة الطائف | 6342 | general_manager |

## Database Schema

### public.users
```sql
CREATE TABLE public.users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,  -- PIN as plain text
  role TEXT NOT NULL DEFAULT 'employee',
  display_name TEXT,
  created_at TIMESTAMP DEFAULT now()
);
```

### employee_store_mapping
```sql
CREATE TABLE employee_store_mapping (
  employee_name TEXT NOT NULL,
  outlet_name TEXT NOT NULL,
  employee_id TEXT,
  last_sale_date TIMESTAMP,
  total_sales DOUBLE PRECISION DEFAULT 0,
  total_invoices BIGINT DEFAULT 0,
  PRIMARY KEY (employee_name, outlet_name)
);
```

## Authentication Flow

1. User submits `username` and `pin` to `/api/auth-sql`
2. API queries `public.users` table for matching username
3. If found, compares `password` (PIN) with submitted pin
4. If not found in DB, falls back to hardcoded `fallbackPins` in `api/_lib/apiHandler.ts`
5. Returns user object with `id`, `name`, `displayName`, and `role`

## Notes

- Passwords are stored as plain text (matching reference project behavior)
- The `employee_store_mapping` table is populated from sales data, so it requires existing sales records
- Users can be updated by re-running `seed_users.js` (uses `ON CONFLICT` to update existing records)
