"""
Import product category rules from category2026.xlsx
Creates product_category_rules table with prefix_pattern -> category_name mapping
"""

import sys
import io
import pandas as pd
import psycopg2

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DB_CONFIG = {
    "host": "localhost",
    "database": "showroom_sales",
    "user": "postgres",
    "password": "KhaKha11@",
    "port": 5432,
}

CATEGORY_FILE = r"C:\Users\Orange1\Desktop\category2026.xlsx"


def import_category_rules():
    """Import category rules from Excel file"""
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        print("[START] Importing category rules from category2026.xlsx...")
        
        # Read Excel file
        df = pd.read_excel(CATEGORY_FILE)
        
        print(f"[INFO] Found {len(df)} rules in Excel file")
        print(f"[INFO] Columns: {df.columns.tolist()}")
        
        # Get column names (should be "Item Starts With" and "Category")
        prefix_col = df.columns[0]
        category_col = df.columns[1]
        
        print(f"[INFO] Using columns: '{prefix_col}' -> '{category_col}'")
        
        # Clear existing data
        cur.execute("TRUNCATE TABLE product_category_rules;")
        conn.commit()
        print("[INFO] Cleared existing category_rules data")
        
        # Prepare data
        rules = []
        for _, row in df.iterrows():
            prefix = str(row[prefix_col]).strip() if pd.notna(row[prefix_col]) else None
            category = str(row[category_col]).strip() if pd.notna(row[category_col]) else None
            
            if prefix and category and prefix != 'nan' and category != 'nan':
                rules.append({
                    'prefix_pattern': prefix,
                    'category_name': category
                })
        
        print(f"[INFO] Prepared {len(rules)} valid rules")
        
        # Insert rules
        insert_sql = """
            INSERT INTO product_category_rules (prefix_pattern, category_name)
            VALUES (%s, %s)
            ON CONFLICT DO NOTHING
        """
        
        inserted = 0
        for rule in rules:
            try:
                cur.execute(insert_sql, (rule['prefix_pattern'], rule['category_name']))
                inserted += 1
            except Exception as e:
                print(f"[WARNING] Failed to insert {rule['prefix_pattern']}: {e}")
        
        conn.commit()
        print(f"[SUCCESS] Inserted {inserted} category rules")
        
        # Verify
        cur.execute("SELECT COUNT(*) FROM product_category_rules;")
        count = cur.fetchone()[0]
        print(f"[VERIFY] Total records in product_category_rules: {count}")
        
        # Show sample
        cur.execute("SELECT * FROM product_category_rules ORDER BY prefix_pattern LIMIT 20;")
        print("\n[SAMPLE] First 20 category rules:")
        for row in cur.fetchall():
            print(f"  {row[0]} -> {row[1]}")
        
        # Show unique categories
        cur.execute("SELECT DISTINCT category_name FROM product_category_rules ORDER BY category_name;")
        categories = [row[0] for row in cur.fetchall()]
        print(f"\n[CATEGORIES] Found {len(categories)} unique categories:")
        for cat in categories[:10]:
            print(f"  - {cat}")
        if len(categories) > 10:
            print(f"  ... and {len(categories) - 10} more")
        
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
    import_category_rules()
