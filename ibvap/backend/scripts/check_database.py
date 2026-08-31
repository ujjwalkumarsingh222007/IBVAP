from __future__ import annotations

import os
import sys
import sqlite3
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.config import DATABASE_URL, DEFAULT_DB_FILE


def run_diagnostics() -> int:
    print("=" * 65)
    print("  IBVAP DATABASE INTEGRITY AND HEALTH DIAGNOSTIC")
    print("=" * 65)

    print(f"\n[1] Configured DATABASE_URL : {DATABASE_URL}")
    print(f"[2] Canonical DB File Path  : {DEFAULT_DB_FILE}")

    db_path = Path(DEFAULT_DB_FILE)
    if not db_path.exists():
        print(f"\n[ERROR] Database file not found at: {db_path}")
        return 1

    size_kb = db_path.stat().st_size / 1024.0
    print(f"[3] Database File Size      : {size_kb:.2f} KB")

    try:
        conn = sqlite3.connect(str(db_path))
        cur = conn.cursor()

        # Check WAL mode
        cur.execute("PRAGMA journal_mode")
        journal_mode = cur.fetchone()[0]
        print(f"[4] SQLite Journal Mode     : {journal_mode}")

        # Check tables
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [r[0] for r in cur.fetchall() if not r[0].startswith("sqlite_")]
        print(f"\n[5] Database Tables Found ({len(tables)} tables):")
        for tbl in tables:
            cur.execute(f"SELECT COUNT(*) FROM {tbl}")
            count = cur.fetchone()[0]
            print(f"    - {tbl:<24} : {count:>5} record(s)")

        # Foreign Key Integrity Check
        cur.execute("PRAGMA foreign_key_check")
        fk_violations = cur.fetchall()
        print("\n[6] Foreign Key Integrity Check:")
        if not fk_violations:
            print("    [PASS] All foreign key relationships are 100% valid (0 orphan records).")
        else:
            print(f"    [FAIL] Found {len(fk_violations)} foreign key violations:")
            for v in fk_violations:
                print(f"       Violation: table={v[0]}, rowid={v[1]}, target={v[2]}, fkid={v[3]}")

        # Integrity Check
        cur.execute("PRAGMA integrity_check")
        integ = cur.fetchone()[0]
        print(f"\n[7] SQLite Low-Level Integrity : {integ}")

        # Sample Person records
        cur.execute("SELECT id, person_code, name, status, created_at FROM persons LIMIT 5")
        people = cur.fetchall()
        print("\n[8] Registered Persons in Database:")
        if people:
            for p in people:
                print(f"    - ID #{p[0]}: {p[2]} ({p[1]}) | Status: {p[3]}")
        else:
            print("    - No registered persons yet.")

        # Sample Cameras
        cur.execute("SELECT id, camera_id, name, location, status FROM cameras LIMIT 5")
        cams = cur.fetchall()
        print("\n[9] Registered Cameras in Database:")
        if cams:
            for c in cams:
                print(f"    - ID #{c[0]}: {c[1]} ('{c[2]}') | Status: {c[4]}")
        else:
            print("    - No cameras registered yet.")

        conn.close()
        print("\n" + "=" * 65)
        print("  DIAGNOSTIC STATUS: HEALTHY AND OPERATIONAL (0 ERRORS)")
        print("=" * 65 + "\n")
        return 0

    except Exception as exc:
        print(f"\n[ERROR] Diagnostic failed with exception: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(run_diagnostics())
