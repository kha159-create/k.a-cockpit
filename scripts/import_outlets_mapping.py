"""
Extract and import outlets mapping from sales data
Creates gofrugal_outlets_mapping table
"""

import sys
import io
import psycopg2

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DB_CONFIG = {
    "host": "localhost",
    "database": "showroom_sales",
    "user": "postgres",
    "password": "KhaKha11@",
    "port": 5432,
}


def extract_outlet_number(outlet_name):
    """Extract outlet number from name (e.g., "01-Jeddah INT Market" -> "01")"""
    if not outlet_name:
        return None
    
    name_str = str(outlet_name).strip()
    
    # Pattern: "01-Jeddah INT Market" or "01 Jeddah INT Market"
    import re
    match = re.match(r'^(\d+)[\s-]+(.+)$', name_str)
    if match:
        return match.group(1)
    
    return None


def import_outlets_mapping():
    """Extract unique outlets from sales data and import to gofrugal_outlets_mapping"""
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        print("[START] Extracting outlets mapping from sales data...")
        
        # Get unique outlets from gofrugal_sales
        cur.execute("""
            SELECT DISTINCT outlet_name
            FROM gofrugal_sales
            WHERE outlet_name IS NOT NULL 
            AND outlet_name != ''
            ORDER BY outlet_name
        """)
        
        outlets = []
        for row in cur.fetchall():
            if row[0]:
                outlet_name = str(row[0]).strip()
                dynamic_number = extract_outlet_number(outlet_name)
                
                outlets.append({
                    'outlet_name': outlet_name,
                    'dynamic_number': dynamic_number,
                    'area_manager': None,  # Will be filled later if available
                    'outlet_type': None,   # Will be filled later if available
                    'city': None           # Will be filled later if available
                })
        
        print(f"[INFO] Found {len(outlets)} unique outlets")
        
        # Clear existing data
        cur.execute("TRUNCATE TABLE gofrugal_outlets_mapping;")
        conn.commit()
        print("[INFO] Cleared existing outlets_mapping data")
        
        # Insert outlets
        insert_sql = """
            INSERT INTO gofrugal_outlets_mapping 
            (outlet_name, area_manager, outlet_type, dynamic_number, city)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """
        
        inserted = 0
        for outlet in outlets:
            try:
                cur.execute(insert_sql, (
                    outlet['outlet_name'],
                    outlet['area_manager'],
                    outlet['outlet_type'],
                    outlet['dynamic_number'],
                    outlet['city']
                ))
                inserted += 1
            except Exception as e:
                print(f"[WARNING] Failed to insert {outlet['outlet_name']}: {e}")
        
        conn.commit()
        print(f"[SUCCESS] Inserted {inserted} outlet mappings")
        
        # Verify
        cur.execute("SELECT COUNT(*) FROM gofrugal_outlets_mapping;")
        count = cur.fetchone()[0]
        print(f"[VERIFY] Total records in gofrugal_outlets_mapping: {count}")
        
        # Show sample
        cur.execute("SELECT * FROM gofrugal_outlets_mapping ORDER BY outlet_name LIMIT 10;")
        print("\n[SAMPLE] First 10 outlet mappings:")
        for row in cur.fetchall():
            print(f"  {row[0]} | {row[1]} | {row[2]} | {row[3]} | {row[4]}")
        
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
    import_outlets_mapping()
