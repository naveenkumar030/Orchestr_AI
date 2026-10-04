import sqlite3

conn = sqlite3.connect('backend/sentinelops.db')
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = c.fetchall()
print("Tables:", tables)

for (t,) in tables:
    c.execute(f"SELECT COUNT(*) FROM {t}")
    count = c.fetchone()[0]
    print(f"Table {t}: {count} rows")
    # check if 572 is in table
    try:
        c.execute(f"SELECT * FROM {t}")
        for row in c.fetchall():
            for val in row:
                if '572' in str(val):
                    print(f"  FOUND 572 in {t}: {val}")
    except Exception as e:
        pass
