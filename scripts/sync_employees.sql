-- Sync employee names from gofrugal_employee_mapping to employees table
UPDATE employees e
SET name = m.employee_name
FROM gofrugal_employee_mapping m
WHERE e.employee_id = m.employee_id
  AND (e.name LIKE 'Employee %' OR e.name IS NULL OR e.name = '');

-- Verification
SELECT employee_id, name FROM employees LIMIT 10;
