#!/usr/bin/env bash
# Download all audit report PDFs locally
# Usage: bash scripts/download-reports.sh
# Resumable — skips files that already exist

set -euo pipefail

SEED_FILE="server/database/seeds/data/reports.json"
OUT_DIR="public/pdf/reports"
DELAY=1.5

mkdir -p "$OUT_DIR"

total=$(python3 -c "import json; print(len(json.load(open('$SEED_FILE'))))")
echo "Downloading $total reports to $OUT_DIR/"
echo "---"

count=0
skipped=0
failed=0
downloaded=0

python3 -c "
import json
with open('$SEED_FILE') as f:
    for r in json.load(f):
        print(r['slug'] + '\t' + r['fileUrl'])
" | while IFS=$'\t' read -r slug url; do
    count=$((count + 1))
    dest="$OUT_DIR/${slug}.pdf"

    if [ -f "$dest" ] && [ -s "$dest" ]; then
        skipped=$((skipped + 1))
        continue
    fi

    echo "[$count/$total] $slug"

    http_code=$(curl -sL -o "$dest" -w "%{http_code}" --connect-timeout 30 --max-time 120 "$url" 2>/dev/null || echo "000")

    if [ "$http_code" = "200" ] && [ -s "$dest" ]; then
        size=$(du -h "$dest" | cut -f1)
        echo "  OK ($size)"
        downloaded=$((downloaded + 1))
    else
        echo "  FAILED (HTTP $http_code)"
        rm -f "$dest"
        failed=$((failed + 1))
    fi

    sleep "$DELAY"
done

echo ""
echo "Done!"
echo "  Downloaded: $downloaded"
echo "  Skipped (existing): $skipped"
echo "  Failed: $failed"
