"""
Script to import CSV sales data from "New folder (2)/downloads" into PostgreSQL
Reads all Report_YYYY_MM.csv files and imports into gofrugal_sales table
"""

import os
import csv
import psycopg2
from datetime import datetime
import re

# Database connection settings
DB_CONFIG = {
    'host': 'localhost',
    'database': 'showroom_sales',
    'user': 'postgres',
    'password': 'KhaKha11@',
    'port': 5432
}

# Path to CSV files
CSV_DIR = r"C:\Users\Orange1\Desktop\New folder (2)\downloads"

def clean_amount(amount_str):
    """Clean amount string (remove commas, quotes) and convert to float"""
    if not amount_str or amount_str.strip() == '':
        return 0.0
    # Remove commas, quotes, and whitespace
    cleaned = str(amount_str).replace(',', '').replace('"', '').strip()
    try:
        return float(cleaned)
    except ValueError:
        return 0.0

def parse_date(date_str):
    """Parse date string (YYYY-MM-DD) to datetime"""
    if not date_str or date_str.strip() == '':
        return None
    try:
        return datetime.strptime(date_str.strip(), '%Y-%m-%d')
    except ValueError:
        return None

def read_csv_file(file_path):
    """Read CSV file and extract sales data"""
    sales_data = []
    
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.reader(f)
        lines = list(reader)
        
        # Find header row (contains "Outlet Name")
        header_idx = None
        for i, line in enumerate(lines):
            if len(line) > 0 and 'Outlet Name' in str(line[0]):
                header_idx = i
                break
        
        if header_idx is None:
            print(f"[WARNING] Could not find header in {file_path}")
            return []
        
        # Extract header
        header = lines[header_idx]
        print(f"[HEADER] Header found at line {header_idx + 1}: {header}")
        
        # Map column indices
        col_map = {}
        for i, col in enumerate(header):
            col_lower = str(col).lower().strip()
            if 'outlet' in col_lower and 'name' in col_lower:
                col_map['outlet_name'] = i
            elif 'bill no' in col_lower or 'billno' in col_lower:
                col_map['bill_no'] = i
            elif 'bill dt' in col_lower or 'bill date' in col_lower:
                col_map['bill_date'] = i
            elif 'bill amount' in col_lower or 'amount' in col_lower:
                col_map['net_amount'] = i
            elif 'tran' in col_lower and 'type' in col_lower:
                col_map['transaction_type'] = i
            elif 'salesman' in col_lower:
                col_map['salesman'] = i
            elif 'source' in col_lower or 'file' in col_lower:
                col_map['source_file'] = i
        
        print(f"[MAP] Column mapping: {col_map}")
        
        # Process data rows (skip header and empty rows)
        for i, row in enumerate(lines[header_idx + 1:], start=header_idx + 2):
            if len(row) < 3:  # Skip empty or invalid rows
                continue
            
            # Skip summary rows (rows with totals)
            if not row[col_map.get('outlet_name', 0)] or not row[col_map.get('bill_no', 1)]:
                continue
            
            outlet_name = str(row[col_map.get('outlet_name', 0)]).strip()
            bill_no = str(row[col_map.get('bill_no', 1)]).strip()
            
            if not outlet_name or not bill_no:
                continue
            
            bill_date = parse_date(row[col_map.get('bill_date', 2)]) if col_map.get('bill_date') else None
            net_amount = clean_amount(row[col_map.get('net_amount', 4)]) if col_map.get('net_amount') else 0.0
            transaction_type = str(row[col_map.get('transaction_type', 5)]).strip() if col_map.get('transaction_type') else None
            salesman = str(row[col_map.get('salesman', 7)]).strip() if col_map.get('salesman') else None
            source_file = os.path.basename(file_path)
            
            sales_data.append({
                'outlet_name': outlet_name,
                'bill_no': bill_no,
                'bill_date': bill_date,
                'net_amount': net_amount,
                'transaction_type': transaction_type,
                'salesman': salesman,
                'source_file': source_file
            })
    
    return sales_data

def import_to_postgres(sales_data, batch_size=1000):
    """Import sales data to PostgreSQL"""
    if not sales_data:
        print("[WARNING] No data to import")
        return
    
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Clear existing data (optional - comment out if you want to keep existing)
        # cur.execute("TRUNCATE TABLE gofrugal_sales;")
        # conn.commit()
        # print("🗑️  Cleared existing data")
        
        # Insert data in batches
        insert_query = """
            INSERT INTO gofrugal_sales 
            (outlet_name, bill_no, bill_date, net_amount, transaction_type, salesman, source_file)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """
        
        total = len(sales_data)
        imported = 0
        
        for i in range(0, total, batch_size):
            batch = sales_data[i:i + batch_size]
            batch_data = [
                (
                    item['outlet_name'],
                    item['bill_no'],
                    item['bill_date'],
                    item['net_amount'],
                    item['transaction_type'],
                    item['salesman'],
                    item['source_file']
                )
                for item in batch
            ]
            
            cur.executemany(insert_query, batch_data)
            conn.commit()
            
            imported += len(batch)
            print(f"[PROGRESS] Imported {imported}/{total} records...")
        
        # Get final count
        cur.execute("SELECT COUNT(*) FROM gofrugal_sales;")
        final_count = cur.fetchone()[0]
        print(f"[SUCCESS] Import complete! Total records in database: {final_count}")
        
        cur.close()
        
    except psycopg2.Error as e:
        print(f"[ERROR] Database error: {e}")
        if conn:
            conn.rollback()
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

def main():
    """Main function"""
    import sys
    import io
    # Fix encoding for Windows console
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    
    print("[START] Starting CSV import to PostgreSQL...")
    print(f"[INFO] Reading CSV files from: {CSV_DIR}")
    
    if not os.path.exists(CSV_DIR):
        print(f"[ERROR] Directory not found: {CSV_DIR}")
        return
    
    # Find all CSV files
    csv_files = [f for f in os.listdir(CSV_DIR) if f.endswith('.csv') and f.startswith('Report_')]
    csv_files.sort()
    
    print(f"[INFO] Found {len(csv_files)} CSV files")
    
    all_sales_data = []
    
    # Read all CSV files
    for csv_file in csv_files:
        file_path = os.path.join(CSV_DIR, csv_file)
        print(f"\n[READ] Reading {csv_file}...")
        
        try:
            sales_data = read_csv_file(file_path)
            print(f"   [OK] Extracted {len(sales_data)} records")
            all_sales_data.extend(sales_data)
        except Exception as e:
            print(f"   [ERROR] Error reading {csv_file}: {e}")
            continue
    
    print(f"\n[INFO] Total records extracted: {len(all_sales_data)}")
    
    # Import to PostgreSQL
    if all_sales_data:
        print(f"\n[IMPORT] Importing to PostgreSQL...")
        import_to_postgres(all_sales_data)
    else:
        print("[WARNING] No data to import")

if __name__ == "__main__":
    main()
