-- Add Missing Indexes for Performance Optimization
-- Run this to speed up queries significantly

-- Indexes for gofrugal_sales (most critical)
CREATE INDEX IF NOT EXISTS idx_gofrugal_sales_outlet ON gofrugal_sales(outlet_name);
CREATE INDEX IF NOT EXISTS idx_gofrugal_sales_date ON gofrugal_sales(bill_date);

-- Indexes for gofrugal_visitors
CREATE INDEX IF NOT EXISTS idx_gofrugal_visitors_outlet ON gofrugal_visitors(outlet_name);
CREATE INDEX IF NOT EXISTS idx_gofrugal_visitors_date ON gofrugal_visitors(visit_date);
CREATE INDEX IF NOT EXISTS idx_gofrugal_visitors_date_outlet ON gofrugal_visitors(visit_date, outlet_name);

-- Indexes for gofrugal_targets
CREATE INDEX IF NOT EXISTS idx_gofrugal_targets_outlet ON gofrugal_targets(outlet_name);
CREATE INDEX IF NOT EXISTS idx_gofrugal_targets_year_month ON gofrugal_targets(year, month);

-- Indexes for gofrugal_outlets_mapping
CREATE INDEX IF NOT EXISTS idx_gofrugal_outlets_dynamic ON gofrugal_outlets_mapping(dynamic_number);

-- Analyze tables to update statistics
ANALYZE gofrugal_sales;
ANALYZE gofrugal_visitors;
ANALYZE gofrugal_targets;
ANALYZE gofrugal_outlets_mapping;

-- Show all indexes
SELECT 
  tablename, 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename LIKE 'gofrugal%'
ORDER BY tablename, indexname;
