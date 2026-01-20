-- Create employee-store mapping table
-- This table maps employees to stores based on their sales data

CREATE TABLE IF NOT EXISTS employee_store_mapping (
  employee_name TEXT NOT NULL,
  outlet_name TEXT NOT NULL,
  employee_id TEXT,
  last_sale_date TIMESTAMP,
  total_sales DOUBLE PRECISION DEFAULT 0,
  total_invoices BIGINT DEFAULT 0,
  PRIMARY KEY (employee_name, outlet_name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_employee_store_mapping_employee 
  ON employee_store_mapping (employee_name);

CREATE INDEX IF NOT EXISTS idx_employee_store_mapping_outlet 
  ON employee_store_mapping (outlet_name);

-- Populate from existing sales data
INSERT INTO employee_store_mapping (employee_name, outlet_name, employee_id, last_sale_date, total_sales, total_invoices)
SELECT 
  COALESCE(item_sales.salesman_name, sales.salesman) as employee_name,
  COALESCE(item_sales.outlet_name, sales.outlet_name) as outlet_name,
  -- Extract employee ID from name (format: "ID-Name" or "ID Name")
  CASE 
    WHEN COALESCE(item_sales.salesman_name, sales.salesman) ~ '^[0-9]+[-_]?[A-Za-z]' 
    THEN substring(COALESCE(item_sales.salesman_name, sales.salesman) from '^([0-9]+)')
    ELSE NULL
  END as employee_id,
  MAX(COALESCE(item_sales.bill_date, sales.bill_date)) as last_sale_date,
  SUM(COALESCE(item_sales.net_amount, sales.net_amount, 0)) as total_sales,
  COUNT(*) as total_invoices
FROM gofrugal_item_sales item_sales
FULL OUTER JOIN gofrugal_sales sales 
  ON item_sales.outlet_name = sales.outlet_name
WHERE (
  (item_sales.salesman_name IS NOT NULL AND item_sales.salesman_name != '' AND item_sales.salesman_name != 'nan')
  OR (sales.salesman IS NOT NULL AND sales.salesman != '' AND sales.salesman != 'nan')
)
AND (
  (item_sales.outlet_name IS NOT NULL AND item_sales.outlet_name != '')
  OR (sales.outlet_name IS NOT NULL AND sales.outlet_name != '')
)
GROUP BY 
  COALESCE(item_sales.salesman_name, sales.salesman),
  COALESCE(item_sales.outlet_name, sales.outlet_name)
ON CONFLICT (employee_name, outlet_name) 
DO UPDATE SET
  last_sale_date = GREATEST(employee_store_mapping.last_sale_date, EXCLUDED.last_sale_date),
  total_sales = employee_store_mapping.total_sales + EXCLUDED.total_sales,
  total_invoices = employee_store_mapping.total_invoices + EXCLUDED.total_invoices,
  employee_id = COALESCE(employee_store_mapping.employee_id, EXCLUDED.employee_id);
