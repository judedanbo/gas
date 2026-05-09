#!/usr/bin/env python3
"""
Update reports.json to use local PDF paths for all successfully downloaded reports.
Run after download-reports.sh completes.

Usage: python3 scripts/localize-report-urls.py
       python3 scripts/localize-report-urls.py --dry-run
"""
import json
import os
import sys

SEED_FILE = "server/database/seeds/data/reports.json"
PDF_DIR = "public/pdf/reports"
dry_run = "--dry-run" in sys.argv

with open(SEED_FILE) as f:
    reports = json.load(f)

updated = 0
missing = 0

for r in reports:
    local_path = os.path.join(PDF_DIR, f"{r['slug']}.pdf")
    local_url = f"/pdf/reports/{r['slug']}.pdf"

    if r["fileUrl"] == local_url:
        continue

    if os.path.isfile(local_path) and os.path.getsize(local_path) > 0:
        if dry_run:
            print(f"  WOULD UPDATE: {r['slug']}")
        else:
            r["fileUrl"] = local_url
        updated += 1
    else:
        missing += 1
        print(f"  MISSING: {r['slug']}")

if not dry_run and updated > 0:
    with open(SEED_FILE, "w") as f:
        json.dump(reports, f, indent=2, ensure_ascii=False)

print(f"\n{'[DRY RUN] ' if dry_run else ''}Results:")
print(f"  Updated: {updated}")
print(f"  Missing (not downloaded): {missing}")
print(f"  Total: {len(reports)}")

if not dry_run and updated > 0:
    print(f"\nSeed data updated. Re-seed the database with:")
    print(f"  npm run db:seed:reports -- --force")
