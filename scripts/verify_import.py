"""
Comprehensive verification script to check all imported data
Compares file counts, row counts, and data integrity
"""

import os
import sys
import io
import csv
import psycopg2
import pandas as pd

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DB_CONFIG = {
    "host": "localhost",
    "database": "showroom_sales",
    "user": "postgres",
    "password": "KhaKha11@",
    "port": 5432,
}

BASE_DIR = r"C:\Users\Orange1\Desktop\New folder (2)"


def count_csv_rows(path):
    """Count rows in CSV file (excluding headers and summary rows)"""
    try:
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.reader(f)
            lines = list(reader)
            
            # Find header
            header_idx = None
            for i, line in enumerate(lines):
                if len(line) > 0 and 'outlet' in str(line[0]).lower() and 'name' in str(line[0]).lower():
                    header_idx = i
                    break
            
            if header_idx is None:
                return 0
            
            # Count data rows (skip header and empty rows)
            count = 0
            for line in lines[header_idx + 1:]:
                # Check if row has outlet name and at least one other field
                if len(line) >= 2 and line[0] and str(line[0]).strip():
                    # Skip summary rows (rows with totals in first column)
                    first_col = str(line[0]).strip().lower()
                    if first_col and not first_col.replace(',', '').replace('.', '').isdigit():
                        count += 1
            
            return count
    except Exception as e:
        print(f"  [ERROR] Counting {os.path.basename(path)}: {e}")
        return 0


def count_excel_rows(path):
    """Count rows in Excel file"""
    try:
        df = pd.read_excel(path, engine=None, header=None)
        
        # Find header
        header_idx = None
        for idx, row in df.iterrows():
            row_str = ' '.join(str(cell) if pd.notna(cell) else '' for cell in row).lower()
            if 'outlet' in row_str and 'name' in row_str:
                header_idx = idx
                break
        
        if header_idx is None:
            return 0
        
        # Count data rows
        df_data = pd.read_excel(path, engine=None, header=header_idx)
        count = 0
        for _, row in df_data.iterrows():
            if pd.notna(row.iloc[0]) and pd.notna(row.iloc[1]):  # Has outlet and bill_no
                count += 1
        
        return count
    except Exception as e:
        print(f"  [ERROR] Counting {os.path.basename(path)}: {e}")
        return 0


def verify_database():
    """Verify data in PostgreSQL"""
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        print("\n" + "="*60)
        print("DATABASE VERIFICATION")
        print("="*60)
        
        # Count gofrugal_sales
        cur.execute("SELECT COUNT(*) FROM gofrugal_sales;")
        sales_count = cur.fetchone()[0]
        print(f"\n[gofrugal_sales] Total records: {sales_count:,}")
        
        # Count by year/month
        cur.execute("""
            SELECT 
                EXTRACT(YEAR FROM bill_date) as year,
                EXTRACT(MONTH FROM bill_date) as month,
                COUNT(*) as cnt
            FROM gofrugal_sales
            WHERE bill_date IS NOT NULL
            GROUP BY year, month
            ORDER BY year, month;
        """)
        print("\n  By Year/Month:")
        for row in cur.fetchall():
            print(f"    {int(row[0])}-{int(row[1]):02d}: {row[2]:,} records")
        
        # Count gofrugal_item_sales
        cur.execute("SELECT COUNT(*) FROM gofrugal_item_sales;")
        item_count = cur.fetchone()[0]
        print(f"\n[gofrugal_item_sales] Total records: {item_count:,}")
        
        # Count by transaction type
        cur.execute("""
            SELECT 
                COALESCE(transaction_type, 'NULL') as trans_type,
                COUNT(*) as cnt
            FROM gofrugal_item_sales
            GROUP BY transaction_type
            ORDER BY cnt DESC;
        """)
        print("\n  By Transaction Type:")
        for row in cur.fetchall():
            print(f"    {row[0]}: {row[1]:,} records")
        
        # Count by source file
        cur.execute("""
            SELECT 
                source_file,
                COUNT(*) as cnt
            FROM gofrugal_item_sales
            GROUP BY source_file
            ORDER BY source_file;
        """)
        print("\n  By Source File (first 10):")
        for row in cur.fetchall()[:10]:
            print(f"    {row[0]}: {row[1]:,} records")
        
        # Check date ranges
        cur.execute("""
            SELECT 
                MIN(bill_date) as min_date,
                MAX(bill_date) as max_date
            FROM gofrugal_sales
            WHERE bill_date IS NOT NULL;
        """)
        date_range = cur.fetchone()
        print(f"\n[gofrugal_sales] Date range: {date_range[0]} to {date_range[1]}")
        
        cur.execute("""
            SELECT 
                MIN(bill_date) as min_date,
                MAX(bill_date) as max_date
            FROM gofrugal_item_sales
            WHERE bill_date IS NOT NULL;
        """)
        item_date_range = cur.fetchone()
        print(f"[gofrugal_item_sales] Date range: {item_date_range[0]} to {item_date_range[1]}")
        
        # Sample data check
        cur.execute("""
            SELECT outlet_name, bill_no, bill_date, net_amount
            FROM gofrugal_sales
            WHERE bill_date IS NOT NULL
            ORDER BY bill_date DESC
            LIMIT 5;
        """)
        print("\n[gofrugal_sales] Sample (latest 5):")
        for row in cur.fetchall():
            print(f"    {row[0]} | {row[1]} | {row[2]} | {row[3]:,.2f}")
        
        cur.execute("""
            SELECT outlet_name, item_code, item_name, quantity, net_amount
            FROM gofrugal_item_sales
            WHERE bill_date IS NOT NULL
            ORDER BY bill_date DESC
            LIMIT 5;
        """)
        print("\n[gofrugal_item_sales] Sample (latest 5):")
        for row in cur.fetchall():
            print(f"    {row[0]} | {row[1]} | {row[2][:30]}... | Qty: {row[3]} | Amt: {row[4]:,.2f}")
        
        cur.close()
        return sales_count, item_count
        
    except Exception as e:
        print(f"[ERROR] Database verification: {e}")
        return 0, 0
    finally:
        if conn:
            conn.close()


def verify_files():
    """Verify all files and count expected rows"""
    print("\n" + "="*60)
    print("FILE VERIFICATION")
    print("="*60)
    
    total_expected_sales = 0
    total_expected_items = 0
    
    # Check downloads/ (Sales - bill level)
    downloads_dir = os.path.join(BASE_DIR, "downloads")
    if os.path.isdir(downloads_dir):
        csv_files = [f for f in os.listdir(downloads_dir) if f.endswith('.csv')]
        csv_files.sort()
        print(f"\n[downloads] Found {len(csv_files)} CSV files")
        
        for filename in csv_files:
            filepath = os.path.join(downloads_dir, filename)
            row_count = count_csv_rows(filepath)
            total_expected_sales += row_count
            print(f"  {filename}: {row_count:,} rows")
    
    # Check downloads_3111/ (Item Detail)
    dir_3111 = os.path.join(BASE_DIR, "downloads_3111")
    if os.path.isdir(dir_3111):
        csv_files = [f for f in os.listdir(dir_3111) if f.endswith('.csv')]
        xls_files = [f for f in os.listdir(dir_3111) if f.endswith(('.xls', '.xlsx'))]
        csv_files.sort()
        xls_files.sort()
        print(f"\n[downloads_3111] Found {len(csv_files)} CSV + {len(xls_files)} Excel files")
        
        for filename in csv_files:
            filepath = os.path.join(dir_3111, filename)
            row_count = count_csv_rows(filepath)
            total_expected_items += row_count
            print(f"  {filename}: {row_count:,} rows")
        
        for filename in xls_files:
            filepath = os.path.join(dir_3111, filename)
            row_count = count_excel_rows(filepath)
            total_expected_items += row_count
            print(f"  {filename}: {row_count:,} rows")
    
    # Check downloads_3016/ (Margin Summary)
    dir_3016 = os.path.join(BASE_DIR, "downloads_3016")
    if os.path.isdir(dir_3016):
        csv_files = [f for f in os.listdir(dir_3016) if f.endswith('.csv')]
        xls_files = [f for f in os.listdir(dir_3016) if f.endswith(('.xls', '.xlsx'))]
        csv_files.sort()
        xls_files.sort()
        print(f"\n[downloads_3016] Found {len(csv_files)} CSV + {len(xls_files)} Excel files")
        
        for filename in csv_files:
            filepath = os.path.join(dir_3016, filename)
            row_count = count_csv_rows(filepath)
            total_expected_items += row_count
            print(f"  {filename}: {row_count:,} rows")
        
        for filename in xls_files:
            filepath = os.path.join(dir_3016, filename)
            row_count = count_excel_rows(filepath)
            total_expected_items += row_count
            print(f"  {filename}: {row_count:,} rows")
    
    # Check downloads_3126/ (Returns)
    dir_3126 = os.path.join(BASE_DIR, "downloads_3126")
    if os.path.isdir(dir_3126):
        xls_files = [f for f in os.listdir(dir_3126) if f.endswith(('.xls', '.xlsx'))]
        xls_files.sort()
        print(f"\n[downloads_3126] Found {len(xls_files)} Excel files")
        
        for filename in xls_files:
            filepath = os.path.join(dir_3126, filename)
            row_count = count_excel_rows(filepath)
            total_expected_items += row_count
            print(f"  {filename}: {row_count:,} rows")
    
    print(f"\n[SUMMARY] Expected rows:")
    print(f"  gofrugal_sales: {total_expected_sales:,}")
    print(f"  gofrugal_item_sales: {total_expected_items:,}")
    
    return total_expected_sales, total_expected_items


def main():
    print("="*60)
    print("COMPREHENSIVE DATA VERIFICATION")
    print("="*60)
    
    # Verify files
    expected_sales, expected_items = verify_files()
    
    # Verify database
    actual_sales, actual_items = verify_database()
    
    # Compare
    print("\n" + "="*60)
    print("COMPARISON")
    print("="*60)
    
    print(f"\n[gofrugal_sales]")
    print(f"  Expected: {expected_sales:,}")
    print(f"  Actual:   {actual_sales:,}")
    if expected_sales > 0:
        diff = actual_sales - expected_sales
        pct = (diff / expected_sales) * 100
        print(f"  Difference: {diff:+,} ({pct:+.2f}%)")
    
    print(f"\n[gofrugal_item_sales]")
    print(f"  Expected: {expected_items:,}")
    print(f"  Actual:   {actual_items:,}")
    if expected_items > 0:
        diff = actual_items - expected_items
        pct = (diff / expected_items) * 100
        print(f"  Difference: {diff:+,} ({pct:+.2f}%)")
    
    print("\n" + "="*60)
    if abs(diff) < expected_items * 0.01:  # Within 1%
        print("[RESULT] ✅ Data import looks good!")
    else:
        print("[RESULT] ⚠️  Some discrepancies detected - review above")


if __name__ == "__main__":
    main()
