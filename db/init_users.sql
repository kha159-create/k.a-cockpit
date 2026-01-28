-- Create public.users table for authentication
-- This table stores user credentials matching the reference project's users.js

CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  display_name TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users (username);

-- Insert users from reference project (allorangedashboard/users.js)
-- Role mapping: "Admin" -> "admin", "Manager" -> "area_manager" (or "general_manager" for regions)

INSERT INTO public.users (username, password, role, display_name) VALUES
  ('Sales Manager', '6587', 'admin', 'Sales Manager'),
  ('المنطقة الغربية', '1478', 'general_manager', 'المنطقة الغربية'),
  ('اماني عسيري', '3698', 'area_manager', 'اماني عسيري'),
  ('جهاد ايوبي', '2587', 'area_manager', 'جهاد ايوبي'),
  ('خليل الصانع', '2131', 'area_manager', 'خليل الصانع'),
  ('رضوان عطيوي', '7643', 'area_manager', 'رضوان عطيوي'),
  ('شريفة العمري', '8491', 'area_manager', 'شريفة العمري'),
  ('عبد الجليل الحبال', '1637', 'area_manager', 'عبد الجليل الحبال'),
  ('عبدالله السرداح', '4618', 'area_manager', 'عبدالله السرداح'),
  ('عبيدة السباعي', '1647', 'area_manager', 'عبيدة السباعي'),
  ('محمدكلو', '4891', 'area_manager', 'محمدكلو'),
  ('منطقة الطائف', '6342', 'general_manager', 'منطقة الطائف')
ON CONFLICT (username) 
DO UPDATE SET
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  display_name = EXCLUDED.display_name,
  updated_at = now();

-- Verify the insert
SELECT 
  id,
  username,
  password,
  role,
  display_name,
  created_at
FROM public.users
ORDER BY role, username;
