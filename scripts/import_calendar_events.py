"""
Create sample calendar events or import from data if available
"""

import sys
import io
import psycopg2
from datetime import datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DB_CONFIG = {
    "host": "localhost",
    "database": "showroom_sales",
    "user": "postgres",
    "password": "KhaKha11@",
    "port": 5432,
}


def create_sample_calendar_events():
    """Create sample calendar events for common holidays/events"""
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        print("[START] Creating calendar events...")
        
        # Clear existing
        cur.execute("TRUNCATE TABLE calendar_events;")
        conn.commit()
        
        # Sample events (Ramadan, Eid, National Day, etc.)
        events = [
            {
                'event_name': 'Ramadan 2024',
                'year': 2024,
                'start_date': datetime(2024, 3, 11),
                'end_date': datetime(2024, 4, 9),
                'description': 'Ramadan month'
            },
            {
                'event_name': 'Eid Al-Fitr 2024',
                'year': 2024,
                'start_date': datetime(2024, 4, 10),
                'end_date': datetime(2024, 4, 12),
                'description': 'Eid Al-Fitr holiday'
            },
            {
                'event_name': 'Eid Al-Adha 2024',
                'year': 2024,
                'start_date': datetime(2024, 6, 16),
                'end_date': datetime(2024, 6, 20),
                'description': 'Eid Al-Adha holiday'
            },
            {
                'event_name': 'Saudi National Day 2024',
                'year': 2024,
                'start_date': datetime(2024, 9, 23),
                'end_date': datetime(2024, 9, 23),
                'description': 'Saudi National Day'
            },
            {
                'event_name': 'Ramadan 2025',
                'year': 2025,
                'start_date': datetime(2025, 3, 1),
                'end_date': datetime(2025, 3, 30),
                'description': 'Ramadan month'
            },
            {
                'event_name': 'Eid Al-Fitr 2025',
                'year': 2025,
                'start_date': datetime(2025, 3, 31),
                'end_date': datetime(2025, 4, 2),
                'description': 'Eid Al-Fitr holiday'
            },
            {
                'event_name': 'Eid Al-Adha 2025',
                'year': 2025,
                'start_date': datetime(2025, 6, 6),
                'end_date': datetime(2025, 6, 10),
                'description': 'Eid Al-Adha holiday'
            },
            {
                'event_name': 'Saudi National Day 2025',
                'year': 2025,
                'start_date': datetime(2025, 9, 23),
                'end_date': datetime(2025, 9, 23),
                'description': 'Saudi National Day'
            },
        ]
        
        insert_sql = """
            INSERT INTO calendar_events (event_name, year, start_date, end_date, description)
            VALUES (%s, %s, %s, %s, %s)
        """
        
        inserted = 0
        for event in events:
            cur.execute(insert_sql, (
                event['event_name'],
                event['year'],
                event['start_date'],
                event['end_date'],
                event['description']
            ))
            inserted += 1
        
        conn.commit()
        print(f"[SUCCESS] Inserted {inserted} calendar events")
        
        # Verify
        cur.execute("SELECT COUNT(*) FROM calendar_events;")
        count = cur.fetchone()[0]
        print(f"[VERIFY] Total records in calendar_events: {count}")
        
        # Show all events
        cur.execute("SELECT * FROM calendar_events ORDER BY year, start_date;")
        print("\n[EVENTS] All calendar events:")
        for row in cur.fetchall():
            print(f"  {row[0]} ({row[1]}): {row[2]} to {row[3]} - {row[4]}")
        
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
    create_sample_calendar_events()
