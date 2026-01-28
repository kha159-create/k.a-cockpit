-- Migration to Unified SQL Architecture
-- Run this: psql -U postgres -h localhost -d showroom_sales -f db/migration_unified.sql

-- 1. Users Table (Replaces users.js)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    pin_hash VARCHAR(100) NOT NULL, -- Storing hash/plain for now based on legacy
    role VARCHAR(20) NOT NULL CHECK (role IN ('Admin', 'Manager', 'Store')),
    display_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Stores Table (Master Data)
CREATE TABLE IF NOT EXISTS stores (
    store_id VARCHAR(50) PRIMARY KEY, -- OperatingUnitNumber
    name VARCHAR(100) NOT NULL,
    city VARCHAR(50),
    area_manager VARCHAR(100),
    type VARCHAR(20), -- 'Showroom', 'Online', 'Mall'
    is_active BOOLEAN DEFAULT TRUE
);

-- 3. Targets Table
CREATE TABLE IF NOT EXISTS targets (
    id SERIAL PRIMARY KEY,
    store_id VARCHAR(50) REFERENCES stores(store_id),
    year INT NOT NULL,
    month INT NOT NULL, -- 1-12
    target_amount DECIMAL(15, 2) DEFAULT 0,
    UNIQUE(store_id, year, month)
);

-- 4. Visitors Table
CREATE TABLE IF NOT EXISTS visitors (
    id SERIAL PRIMARY KEY,
    store_id VARCHAR(50) REFERENCES stores(store_id),
    visit_date DATE NOT NULL,
    visitor_count INT DEFAULT 0,
    UNIQUE(store_id, visit_date)
);

-- 5. Sales Daily Aggregated (Fast Analytics)
CREATE TABLE IF NOT EXISTS sales_daily (
    id SERIAL PRIMARY KEY,
    store_id VARCHAR(50) REFERENCES stores(store_id),
    sale_date DATE NOT NULL,
    total_amount DECIMAL(15, 2) DEFAULT 0, -- Net Amount
    invoice_count INT DEFAULT 0,
    UNIQUE(store_id, sale_date)
);

-- Indexes for Dashboard Performance
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales_daily(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_store ON sales_daily(store_id);
CREATE INDEX IF NOT EXISTS idx_targets_year ON targets(year);
CREATE INDEX IF NOT EXISTS idx_visitors_date ON visitors(visit_date);
