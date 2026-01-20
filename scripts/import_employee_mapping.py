"""
Extract and import employee mapping from sales data
Creates gofrugal_employee_mapping table with employee_id, sales_group, arabic_name
"""

import sys
import io
import psycopg2
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DB_CONFIG = {
    "host": "localhost",
    "database": "showroom_sales",
    "user": "postgres",
    "password": "KhaKha11@",
    "port": 5432,
}


def extract_employee_id(name):
    """Extract employee ID from name (format: "ID-Name" or "ID Name")"""
    if not name:
        return None
    
    name_str = str(name).strip()
    
    # Try pattern: "3050-Manar Balrshid" or "3050 Manar Balrshid"
    match = re.match(r'^(\d+)[\s-]+(.+)$', name_str)
    if match:
        return match.group(1)
    
    # Try pattern: just numbers at start
    match = re.match(r'^(\d+)', name_str)
    if match:
        return match.group(1)
    
    return None


def extract_employee_name(name):
    """Extract clean employee name"""
    if not name:
        return None
    
    name_str = str(name).strip()
    
    # Remove ID prefix if exists
    match = re.match(r'^\d+[\s-]+(.+)$', name_str)
    if match:
        return match.group(1).strip()
    
    return name_str


def import_employee_mapping():
    """Extract unique employees from sales data and import to gofrugal_employee_mapping"""
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        print("[START] Extracting employees from sales data...")
        
        # Get unique employees from gofrugal_item_sales
        cur.execute("""
            SELECT DISTINCT salesman_name
            FROM gofrugal_item_sales
            WHERE salesman_name IS NOT NULL 
            AND salesman_name != ''
            AND salesman_name != 'nan'
        """)
        
        item_sales_employees = set()
        for row in cur.fetchall():
            if row[0]:
                item_sales_employees.add(str(row[0]).strip())
        
        print(f"[INFO] Found {len(item_sales_employees)} unique employees in gofrugal_item_sales")
        
        # Get unique employees from gofrugal_sales
        cur.execute("""
            SELECT DISTINCT salesman
            FROM gofrugal_sales
            WHERE salesman IS NOT NULL 
            AND salesman != ''
            AND salesman != 'nan'
        """)
        
        sales_employees = set()
        for row in cur.fetchall():
            if row[0]:
                sales_employees.add(str(row[0]).strip())
        
        print(f"[INFO] Found {len(sales_employees)} unique employees in gofrugal_sales")
        
        # Combine and deduplicate
        all_employees = item_sales_employees.union(sales_employees)
        print(f"[INFO] Total unique employees: {len(all_employees)}")
        
        # Extract employee mappings
        employee_mappings = []
        for emp_name in all_employees:
            emp_id = extract_employee_id(emp_name)
            clean_name = extract_employee_name(emp_name)
            
            if emp_id and clean_name:
                employee_mappings.append({
                    'employee_id': emp_id,
                    'sales_group': None,  # Will be filled later if available
                    'arabic_name': clean_name
                })
        
        print(f"[INFO] Extracted {len(employee_mappings)} employee mappings")
        
        # Clear existing data
        cur.execute("TRUNCATE TABLE gofrugal_employee_mapping;")
        conn.commit()
        print("[INFO] Cleared existing employee_mapping data")
        
        # Insert employee mappings
        insert_sql = """
            INSERT INTO gofrugal_employee_mapping (employee_id, sales_group, arabic_name)
            VALUES (%s, %s, %s)
            ON CONFLICT DO NOTHING
        """
        
        inserted = 0
        for emp in employee_mappings:
            try:
                cur.execute(insert_sql, (emp['employee_id'], emp['sales_group'], emp['arabic_name']))
                inserted += 1
            except Exception as e:
                print(f"[WARNING] Failed to insert {emp['employee_id']}: {e}")
        
        conn.commit()
        print(f"[SUCCESS] Inserted {inserted} employee mappings")
        
        # Verify
        cur.execute("SELECT COUNT(*) FROM gofrugal_employee_mapping;")
        count = cur.fetchone()[0]
        print(f"[VERIFY] Total records in gofrugal_employee_mapping: {count}")
        
        # Show sample
        cur.execute("SELECT * FROM gofrugal_employee_mapping LIMIT 10;")
        print("\n[SAMPLE] First 10 employee mappings:")
        for row in cur.fetchall():
            print(f"  {row[0]} | {row[1]} | {row[2]}")
        
        cur.close()
        
    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    import_employee_mapping()
