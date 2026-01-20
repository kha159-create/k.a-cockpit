"""
Import Excel (.xls) files from downloads_3126 into PostgreSQL.
These files contain item-level sales data in Excel format.
"""

import os
import sys
import io
from datetime import datetime

import psycopg2
import pandas as pd

# Fix encoding for Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DB_CONFIG = {
    "host": "localhost",
    "database": "showroom_sales",
    "user": "postgres",
    "password": "KhaKha11@",
    "port": 5432,
}

BASE_DIR = r"C:\Users\Orange1\Desktop\New folder (2)"
DIR_EXCEL = os.path.join(BASE_DIR, "downloads_3126")


def clean_amount(value):
    """Clean and convert amount to float"""
    if value is None:
        return 0.0
    s = str(value).replace(",", "").replace('"', "").strip()
    if s == "" or s == "-":
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def clean_int(value):
    """Clean and convert to integer"""
    if value is None:
        return 0
    s = str(value).replace(",", "").strip()
    if s == "" or s == "-":
        return 0
    try:
        return int(float(s))
    except ValueError:
        return 0


def parse_date(date_value):
    """Parse date from Excel or string"""
    if date_value is None:
        return None
    
    # If it's already a datetime object
    if isinstance(date_value, datetime):
        return date_value
    
    # If it's a string
    if isinstance(date_value, str):
        date_str = date_value.strip()
        if not date_str:
            return None
        try:
            return datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            try:
                return datetime.strptime(date_str, '%d-%m-%Y')
            except ValueError:
                return None
    
    return None


def read_excel_file(path):
    """Read Excel file (.xls or .xlsx) and extract item sales data using pandas"""
    records = []
    
    try:
        # Try to read with pandas (supports both .xls and .xlsx)
        # Skip first few rows that might contain headers/metadata
        df = pd.read_excel(path, engine=None, header=None)
        
        # Find header row
        header_row = None
        for idx, row in df.iterrows():
            row_str = ' '.join(str(cell) if pd.notna(cell) else '' for cell in row).lower()
            if 'outlet' in row_str and ('name' in row_str or 'outlet' in row_str):
                header_row = idx
                break
        
        if header_row is None:
            print(f"[WARNING] Could not find header in {os.path.basename(path)}")
            return []
        
        # Read again with proper header
        df = pd.read_excel(path, engine=None, header=header_row)
        
        # Normalize column names
        df.columns = [str(col).strip().lower() if pd.notna(col) else f'col_{i}' for i, col in enumerate(df.columns)]
        
        # Map columns
        outlet_col = None
        bill_no_col = None
        bill_date_col = None
        item_code_col = None
        item_name_col = None
        quantity_col = None
        net_amount_col = None
        salesman_col = None
        
        for col in df.columns:
            col_lower = str(col).lower()
            if 'outlet' in col_lower and 'name' in col_lower:
                outlet_col = col
            elif 'bill' in col_lower and ('no' in col_lower or 'number' in col_lower):
                bill_no_col = col
            elif 'bill' in col_lower and ('date' in col_lower or 'dt' in col_lower):
                bill_date_col = col
            elif 'item' in col_lower and 'code' in col_lower:
                item_code_col = col
            elif 'item' in col_lower and 'name' in col_lower:
                item_name_col = col
            elif ('sold' in col_lower or 'qty' in col_lower) and 'quantity' in col_lower:
                quantity_col = col
            elif ('net' in col_lower or 'amount' in col_lower) and 'amt' in col_lower:
                net_amount_col = col
            elif 'salesman' in col_lower or ('sales' in col_lower and 'name' in col_lower):
                salesman_col = col
        
        if not outlet_col or not bill_no_col:
            print(f"[WARNING] Missing required columns in {os.path.basename(path)}")
            return []
        
        print(f"[HEADER] Found columns: outlet={outlet_col}, bill_no={bill_no_col}, item_code={item_code_col}")
        
        # Process rows
        for _, row in df.iterrows():
            outlet_name = str(row[outlet_col]).strip() if pd.notna(row.get(outlet_col)) else ''
            
            # Try different bill_no columns
            bill_no = None
            if bill_no_col:
                bill_no = str(row[bill_no_col]).strip() if pd.notna(row.get(bill_no_col)) else ''
            
            # Also try "Manual Bill Number" or "Ret. No." for returns
            if not bill_no or bill_no == 'nan':
                for col in df.columns:
                    if 'manual' in str(col).lower() and 'bill' in str(col).lower():
                        bill_no = str(row[col]).strip() if pd.notna(row.get(col)) else ''
                        break
                    elif 'ret' in str(col).lower() and 'no' in str(col).lower():
                        bill_no = str(row[col]).strip() if pd.notna(row.get(col)) else ''
                        break
            
            # Skip empty/summary rows
            if not outlet_name or outlet_name == 'nan' or not bill_no or bill_no == 'nan':
                continue
            
            bill_date = None
            if bill_date_col and pd.notna(row.get(bill_date_col)):
                bill_date = parse_date(row[bill_date_col])
            
            item_code = str(row[item_code_col]).strip() if item_code_col and pd.notna(row.get(item_code_col)) else ''
            item_name = str(row[item_name_col]).strip() if item_name_col and pd.notna(row.get(item_name_col)) else ''
            
            if not item_code and not item_name:
                continue
            
            quantity = clean_int(row[quantity_col]) if quantity_col and pd.notna(row.get(quantity_col)) else 0
            net_amount = clean_amount(row[net_amount_col]) if net_amount_col and pd.notna(row.get(net_amount_col)) else 0.0
            salesman = str(row[salesman_col]).strip() if salesman_col and pd.notna(row.get(salesman_col)) else None
            
            # Determine transaction type (RETURN or SALES)
            transaction_type = 'RETURN' if 'return' in os.path.basename(path).lower() or 'ret' in str(df.columns).lower() else 'SALES'
            
            # Get ref_bill_no if available (for returns)
            ref_bill_no = None
            for col in df.columns:
                if 'ref' in str(col).lower() or 'sold' in str(col).lower() and 'bill' in str(col).lower():
                    ref_val = row.get(col)
                    if pd.notna(ref_val):
                        ref_bill_no = str(ref_val).strip()
                        break
            
            records.append({
                'outlet_name': outlet_name,
                'transaction_type': transaction_type,
                'bill_no': bill_no,
                'bill_date': bill_date,
                'item_code': item_code,
                'item_name': item_name,
                'quantity': quantity,
                'net_amount': net_amount,
                'salesman_name': salesman,
                'ref_bill_no': ref_bill_no,
                'source_file': os.path.basename(path),
            })
        
        print(f"[EXCEL] {os.path.basename(path)} -> {len(records)} rows")
        return records
        
    except Exception as e:
        print(f"[ERROR] Reading {os.path.basename(path)}: {e}")
        import traceback
        traceback.print_exc()
        return []


def import_item_sales(records, batch_size=1000):
    """Import item sales records to PostgreSQL"""
    if not records:
        print("[WARNING] No item records to import")
        return
    
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        insert_sql = """
            INSERT INTO gofrugal_item_sales
            (outlet_name, transaction_type, bill_no, bill_date, item_code, item_name,
             quantity, net_amount, salesman_name, ref_bill_no, source_file)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """
        
        total = len(records)
        inserted = 0
        for i in range(0, total, batch_size):
            batch = records[i : i + batch_size]
            params = [
                (
                    r["outlet_name"],
                    r["transaction_type"],
                    r["bill_no"],
                    r["bill_date"],
                    r["item_code"],
                    r["item_name"],
                    r["quantity"],
                    r["net_amount"],
                    r["salesman_name"],
                    r["ref_bill_no"],
                    r["source_file"],
                )
                for r in batch
            ]
            cur.executemany(insert_sql, params)
            conn.commit()
            inserted += len(batch)
            if inserted % 10000 == 0:
                print(f"[PROGRESS] Inserted {inserted}/{total} Excel rows...")
        
        cur.close()
        print(f"[SUCCESS] Excel import completed: {inserted} rows")
    except Exception as e:
        print(f"[ERROR] import_item_sales: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()


def main():
    print("[START] Excel file import starting...")
    
    if not os.path.isdir(DIR_EXCEL):
        print(f"[ERROR] Excel directory not found: {DIR_EXCEL}")
        return
    
    all_records = []
    
    # Find all Excel files
    excel_files = [f for f in os.listdir(DIR_EXCEL) if f.lower().endswith(('.xls', '.xlsx'))]
    excel_files.sort()
    
    print(f"[INFO] Found {len(excel_files)} Excel files in {DIR_EXCEL}")
    
    for filename in excel_files:
        filepath = os.path.join(DIR_EXCEL, filename)
        print(f"\n[READ] Processing {filename}...")
        try:
            records = read_excel_file(filepath)
            all_records.extend(records)
        except Exception as e:
            print(f"[ERROR] Processing {filename}: {e}")
            continue
    
    print(f"\n[INFO] Total Excel rows collected: {len(all_records)}")
    
    if all_records:
        import_item_sales(all_records)
    else:
        print("[WARNING] No data to import from Excel files")


if __name__ == "__main__":
    main()
