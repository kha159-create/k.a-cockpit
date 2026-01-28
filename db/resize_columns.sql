-- Resize columns to TEXT to avoid 'value too long' errors
ALTER TABLE stores ALTER COLUMN store_id TYPE TEXT;
ALTER TABLE stores ALTER COLUMN name TYPE TEXT;
ALTER TABLE stores ALTER COLUMN city TYPE TEXT;
ALTER TABLE stores ALTER COLUMN area_manager TYPE TEXT;
ALTER TABLE stores ALTER COLUMN type TYPE TEXT;

-- For employees table (created dynamically or in previous steps)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
        ALTER TABLE employees ALTER COLUMN employee_id TYPE TEXT;
        ALTER TABLE employees ALTER COLUMN name TYPE TEXT;
        ALTER TABLE employees ALTER COLUMN current_store TYPE TEXT;
        ALTER TABLE employees ALTER COLUMN status TYPE TEXT;
    END IF;
END $$;
