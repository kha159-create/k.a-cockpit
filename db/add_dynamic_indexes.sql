-- Add indexes for dynamic_sales_bills and dynamic_sales_items for faster queries

-- Indexes for dynamic_sales_bills
CREATE INDEX IF NOT EXISTS idx_dynamic_sales_bills_store_number 
  ON dynamic_sales_bills (store_number);

CREATE INDEX IF NOT EXISTS idx_dynamic_sales_bills_bill_date 
  ON dynamic_sales_bills (bill_date);

CREATE INDEX IF NOT EXISTS idx_dynamic_sales_bills_transaction_id 
  ON dynamic_sales_bills (transaction_id);

CREATE INDEX IF NOT EXISTS idx_dynamic_sales_bills_store_date 
  ON dynamic_sales_bills (store_number, bill_date);

-- Indexes for dynamic_sales_items
CREATE INDEX IF NOT EXISTS idx_dynamic_sales_items_store_number 
  ON dynamic_sales_items (store_number);

CREATE INDEX IF NOT EXISTS idx_dynamic_sales_items_transaction_id 
  ON dynamic_sales_items (transaction_id);

CREATE INDEX IF NOT EXISTS idx_dynamic_sales_items_item_date 
  ON dynamic_sales_items (item_date);

CREATE INDEX IF NOT EXISTS idx_dynamic_sales_items_sales_group 
  ON dynamic_sales_items (sales_group);

CREATE INDEX IF NOT EXISTS idx_dynamic_sales_items_store_transaction 
  ON dynamic_sales_items (store_number, transaction_id);

-- Index for all_products
CREATE INDEX IF NOT EXISTS idx_all_products_product_number 
  ON all_products (product_number);
