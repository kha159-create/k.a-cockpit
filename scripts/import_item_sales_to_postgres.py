"""
Import item-level sales data from New folder (2) into PostgreSQL.

Sources:
- downloads_3111: "Sales Detail - Itemwise"  (per-item with Bill No)
- downloads_3016: "Margin Summary - Itemwise" (per-item per outlet)

Target table:
- public.gofrugal_item_sales
"""

import os
import csv
from datetime import datetime

import psycopg2

DB_CONFIG = {
    "host": "localhost",
    "database": "showroom_sales",
    "user": "postgres",
    "password": "KhaKha11@",
    "port": 5432,
}

BASE_DIR = r"C:\Users\Orange1\Desktop\New folder (2)"
DIR_DETAIL = os.path.join(BASE_DIR, "downloads_3111")
DIR_MARGIN = os.path.join(BASE_DIR, "downloads_3016")


def clean_amount(value):
    if value is None:
        return 0
    s = str(value).replace(",", "").replace('"', "").strip()
    if s == "":
        return 0
    try:
        return float(s)
    except ValueError:
        return 0


def clean_int(value):
    if value is None:
        return 0
    s = str(value).replace(",", "").strip()
    if s == "":
        return 0
    try:
        return int(float(s))
    except ValueError:
        return 0


def parse_date(value):
    if not value:
        return None
    s = str(value).strip()
    # Expected format: YYYY-MM-DD
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def read_detail_csv(path):
    """
    Read Sales Detail - Itemwise CSV (downloads_3111)
    Header:
    Outlet Name,Bill No,Bill Dt.,Item Code,Item Name,Item Alias,Sold Qty,Item Net Amt,SalesMan Name
    """
    records = []
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f)
        rows = list(reader)

    # Find header
    header_idx = None
    for i, row in enumerate(rows):
        if row and "Outlet Name" in row[0] and "Bill No" in ",".join(row):
            header_idx = i
            break
    if header_idx is None:
        print(f"[WARNING] No detail header found in {path}")
        return records

    header = rows[header_idx]
    print(f"[HEADER-DETAIL] {os.path.basename(path)} -> {header}")

    def idx(name_part):
        for j, col in enumerate(header):
            if name_part.lower() in str(col).lower():
                return j
        return None

    idx_outlet = idx("Outlet Name")
    idx_bill_no = idx("Bill No")
    idx_bill_dt = idx("Bill Dt")
    idx_item_code = idx("Item Code")
    idx_item_name = idx("Item Name")
    idx_item_alias = idx("Item Alias")
    idx_qty = idx("Sold Qty")
    idx_net = idx("Item Net Amt")
    idx_salesman = idx("SalesMan")

    for row in rows[header_idx + 1 :]:
        if len(row) < 5:
            continue
        outlet_name = (row[idx_outlet] or "").strip() if idx_outlet is not None else ""
        bill_no = (row[idx_bill_no] or "").strip() if idx_bill_no is not None else ""
        if not outlet_name or not bill_no:
            # skip summary / blank rows
            continue

        bill_date = parse_date(row[idx_bill_dt]) if idx_bill_dt is not None else None
        item_code = (row[idx_item_code] or "").strip() if idx_item_code is not None else ""
        item_name = (row[idx_item_name] or "").strip() if idx_item_name is not None else ""
        qty = clean_int(row[idx_qty]) if idx_qty is not None else 0
        net_amount = clean_amount(row[idx_net]) if idx_net is not None else 0
        salesman_name = (row[idx_salesman] or "").strip() if idx_salesman is not None else ""

        records.append(
            {
                "outlet_name": outlet_name,
                "transaction_type": None,
                "bill_no": bill_no,
                "bill_date": bill_date,
                "item_code": item_code,
                "item_name": item_name,
                "quantity": qty,
                "net_amount": net_amount,
                "salesman_name": salesman_name,
                "ref_bill_no": None,
                "source_file": os.path.basename(path),
            }
        )

    print(f"[DETAIL] {os.path.basename(path)} -> {len(records)} rows")
    return records


def read_margin_csv(path):
    """
    Read Margin Summary - Itemwise CSV (downloads_3016)
    Header:
    Net Sale Qty,OUTLET NAME,Sale Qty,Sales Amount,Selling Price,Bill Date,Item Alias,Item Code,Item Name
    """
    records = []
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f)
        rows = list(reader)

    # Find header
    header_idx = None
    for i, row in enumerate(rows):
        if row and "Net Sale Qty" in row[0]:
            header_idx = i
            break
    if header_idx is None:
        print(f"[WARNING] No margin header found in {path}")
        return records

    header = rows[header_idx]
    print(f"[HEADER-MARGIN] {os.path.basename(path)} -> {header}")

    def idx(name_part):
        for j, col in enumerate(header):
            if name_part.lower() in str(col).lower():
                return j
        return None

    idx_outlet = idx("OUTLET NAME")
    idx_bill_dt = idx("Bill Date")
    idx_item_code = idx("Item Code")
    idx_item_name = idx("Item Name")
    idx_qty = idx("Sale Qty")
    idx_net = idx("Sales Amount")

    for row in rows[header_idx + 1 :]:
        if len(row) < 5:
            continue
        outlet_name = (row[idx_outlet] or "").strip() if idx_outlet is not None else ""
        if not outlet_name:
            continue

        bill_date = parse_date(row[idx_bill_dt]) if idx_bill_dt is not None else None
        item_code = (row[idx_item_code] or "").strip() if idx_item_code is not None else ""
        item_name = (row[idx_item_name] or "").strip() if idx_item_name is not None else ""
        qty = clean_int(row[idx_qty]) if idx_qty is not None else 0
        net_amount = clean_amount(row[idx_net]) if idx_net is not None else 0

        records.append(
            {
                "outlet_name": outlet_name,
                "transaction_type": None,
                "bill_no": None,
                "bill_date": bill_date,
                "item_code": item_code,
                "item_name": item_name,
                "quantity": qty,
                "net_amount": net_amount,
                "salesman_name": None,
                "ref_bill_no": None,
                "source_file": os.path.basename(path),
            }
        )

    print(f"[MARGIN] {os.path.basename(path)} -> {len(records)} rows")
    return records


def import_item_sales(records, batch_size=1000):
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
            print(f"[IMPORT] Inserted {inserted}/{total} item rows...")

        cur.close()
        print("[SUCCESS] Item sales import completed")
    except Exception as e:
        print(f"[ERROR] import_item_sales: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()


def main():
    print("[START] Item-level import starting...")
    all_records = []

    # Detail CSVs
    if os.path.isdir(DIR_DETAIL):
        files = [f for f in os.listdir(DIR_DETAIL) if f.lower().endswith(".csv")]
        files.sort()
        print(f"[INFO] Detail files ({DIR_DETAIL}): {len(files)}")
        for name in files:
            path = os.path.join(DIR_DETAIL, name)
            try:
                recs = read_detail_csv(path)
                all_records.extend(recs)
            except Exception as e:
                print(f"[ERROR] reading detail {name}: {e}")
    else:
        print(f"[WARNING] Detail directory missing: {DIR_DETAIL}")

    # Margin CSVs
    if os.path.isdir(DIR_MARGIN):
        files = [f for f in os.listdir(DIR_MARGIN) if f.lower().endswith(".csv")]
        files.sort()
        print(f"[INFO] Margin files ({DIR_MARGIN}): {len(files)}")
        for name in files:
            path = os.path.join(DIR_MARGIN, name)
            try:
                recs = read_margin_csv(path)
                all_records.extend(recs)
            except Exception as e:
                print(f"[ERROR] reading margin {name}: {e}")
    else:
        print(f"[WARNING] Margin directory missing: {DIR_MARGIN}")

    print(f"[INFO] Total item rows collected: {len(all_records)}")
    if all_records:
        import_item_sales(all_records)
    else:
        print("[WARNING] Nothing to import")


if __name__ == "__main__":
    main()

