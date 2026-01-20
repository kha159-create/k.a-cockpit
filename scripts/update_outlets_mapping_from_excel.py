"""
Update gofrugal_outlets_mapping with correct dynamic_number from mapping.xlsx
This matches the Store Number (OperatingUnitNumber) used in the system
"""

import sys
import io
import psycopg2
import requests
import pandas as pd
from io import BytesIO

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DB_CONFIG = {
    "host": "localhost",
    "database": "showroom_sales",
    "user": "postgres",
    "password": "KhaKha11@",
    "port": 5432,
}


def load_mapping_from_excel():
    """Load store mapping from mapping.xlsx (from dailysales repository)"""
    try:
        print("[INFO] Fetching mapping.xlsx from GitHub...")
        url = "https://raw.githubusercontent.com/ALAAWF2/dailysales/main/backend/mapping.xlsx"
        response = requests.get(url)
        
        if not response.ok:
            print(f"[ERROR] Failed to fetch mapping.xlsx: {response.status_code}")
            return {}
        
        # Read Excel file
        excel_data = BytesIO(response.content)
        df = pd.read_excel(excel_data, engine='openpyxl')
        
        # Find columns (flexible matching)
        columns = df.columns.tolist()
        store_number_col = None
        outlet_name_col = None
        
        for col in columns:
            col_lower = col.lower()
            if 'store' in col_lower and ('number' in col_lower or 'id' in col_lower):
                store_number_col = col
            elif 'outlet' in col_lower or ('name' in col_lower and 'store' not in col_lower):
                outlet_name_col = col
        
        if not store_number_col or not outlet_name_col:
            # Try first two columns as fallback
            store_number_col = columns[0] if len(columns) > 0 else None
            outlet_name_col = columns[1] if len(columns) > 1 else None
        
        if not store_number_col or not outlet_name_col:
            print("[ERROR] Could not identify columns in mapping.xlsx")
            return {}
        
        print(f"[INFO] Using columns: {store_number_col} -> {outlet_name_col}")
        
        # Build mapping: outlet_name -> dynamic_number (Store Number)
        mapping = {}
        for _, row in df.iterrows():
            store_number = str(row[store_number_col]).strip() if pd.notna(row[store_number_col]) else None
            outlet_name = str(row[outlet_name_col]).strip() if pd.notna(row[outlet_name_col]) else None
            
            if store_number and outlet_name and store_number != 'NaN' and outlet_name != 'NaN':
                mapping[outlet_name] = store_number
        
        print(f"[SUCCESS] Loaded {len(mapping)} mappings from Excel")
        return mapping
        
    except Exception as e:
        print(f"[ERROR] Failed to load mapping.xlsx: {e}")
        import traceback
        traceback.print_exc()
        return {}


def update_outlets_mapping(file_path=None):
    """Update gofrugal_outlets_mapping with correct dynamic_number from mapping.xlsx"""
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        print("[START] Updating outlets mapping with dynamic_number from mapping.xlsx...")
        
        # Load mapping from Excel (local file or GitHub)
        excel_mapping = load_mapping_from_excel(file_path)
        
        if not excel_mapping:
            print("[ERROR] No mappings loaded from Excel, aborting")
            return
        
        # Get all outlets from database
        cur.execute("""
            SELECT outlet_name, dynamic_number
            FROM gofrugal_outlets_mapping
            ORDER BY outlet_name
        """)
        
        outlets = cur.fetchall()
        print(f"[INFO] Found {len(outlets)} outlets in database")
        
        # Update dynamic_number from Excel mapping
        updated = 0
        not_found = []
        
        for outlet_name, current_dynamic_number in outlets:
            if outlet_name in excel_mapping:
                new_dynamic_number = excel_mapping[outlet_name]
                
                # Only update if different
                if str(current_dynamic_number) != str(new_dynamic_number):
                    cur.execute("""
                        UPDATE gofrugal_outlets_mapping
                        SET dynamic_number = %s
                        WHERE outlet_name = %s
                    """, (new_dynamic_number, outlet_name))
                    updated += 1
                    print(f"  Updated: {outlet_name} -> {new_dynamic_number} (was: {current_dynamic_number})")
            else:
                not_found.append(outlet_name)
        
        conn.commit()
        print(f"[SUCCESS] Updated {updated} outlet mappings")
        
        if not_found:
            print(f"[WARNING] {len(not_found)} outlets not found in mapping.xlsx:")
            for name in not_found[:10]:  # Show first 10
                print(f"  - {name}")
            if len(not_found) > 10:
                print(f"  ... and {len(not_found) - 10} more")
        
        # Verify
        cur.execute("""
            SELECT outlet_name, dynamic_number
            FROM gofrugal_outlets_mapping
            WHERE dynamic_number IS NOT NULL
            ORDER BY outlet_name
            LIMIT 10
        """)
        print("\n[VERIFY] Sample updated mappings:")
        for row in cur.fetchall():
            print(f"  {row[0]} -> {row[1]}")
        
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
    import sys
    # Allow passing file path as argument
    file_path = sys.argv[1] if len(sys.argv) > 1 else None
    if file_path:
        print(f"[INFO] Using local file: {file_path}")
    update_outlets_mapping(file_path)
