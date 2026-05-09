#!/usr/bin/env python3
"""
Extract transmittal letter dates from Ghana Audit Service report PDFs.

Strategy:
  1. Extract text from pages 2-5 of each PDF using pdftotext.
  2. Look for "DD Month YYYY" dates near salutation lines
     ("Dear Rt. Hon. Speaker" and variants).
  3. Fall back to dates on the info/copyright page (page 2)
     near "Auditor-General".
  4. Flag PDFs that yield no text (likely scanned/non-OCR) or
     no extractable date for manual review.

Output: CSV with slug, current date, extracted date, confidence, and notes.
"""

import csv
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PDF_DIR = REPO_ROOT / "public" / "pdf" / "reports"
SEED_FILE = REPO_ROOT / "server" / "database" / "seeds" / "data" / "reports.json"
OUTPUT_CSV = REPO_ROOT / "scripts" / "extracted-report-dates.csv"

MONTHS = (
    "January|February|March|April|May|June|"
    "July|August|September|October|November|December"
)
DATE_RE = re.compile(
    rf"\b(\d{{1,2}})\s*(?:st|nd|rd|th|[\"'°®])?\s+({MONTHS}),?\s+(\d{{4}})\b",
    re.IGNORECASE,
)
MONTH_YEAR_RE = re.compile(
    rf"\b({MONTHS}),?\s+(\d{{4}})\b",
    re.IGNORECASE,
)

SALUTATION_RE = re.compile(
    r"Dear\s+(?:R(?:igh)?t\.?\s+Hon(?:ou?rable)?\.?\s+Speaker|Sir|Madam)",
    re.IGNORECASE,
)
SPEAKER_BLOCK_RE = re.compile(
    r"THE\s+R(?:IGH)?T\s+HON(?:OURA?BLE)?\.?\s+SPEAKER",
    re.IGNORECASE,
)
AG_RE = re.compile(r"Auditor[- ]General", re.IGNORECASE)
TRANSMITTAL_RE = re.compile(r"TRANSMIT(?:T)?AL\s+LETTER", re.IGNORECASE)

MONTH_NUM = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}


def parse_date_str(day: str, month: str, year: str) -> str:
    """Convert extracted date parts to YYYY-MM-DD."""
    m = MONTH_NUM[month.lower()]
    return f"{int(year):04d}-{m:02d}-{int(day):02d}"


def parse_month_year(month: str, year: str) -> str:
    """Convert month + year to YYYY-MM-01 (day defaults to 1)."""
    m = MONTH_NUM[month.lower()]
    return f"{int(year):04d}-{m:02d}-01"


def extract_text(pdf_path: Path, first_page: int, last_page: int, layout: bool = False) -> str:
    """Extract text from a page range using pdftotext."""
    try:
        cmd = ["pdftotext", "-f", str(first_page), "-l", str(last_page)]
        if layout:
            cmd.append("-layout")
        cmd.extend([str(pdf_path), "-"])
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return result.stdout
    except (subprocess.TimeoutExpired, Exception):
        return ""


def ocr_extract_text(pdf_path: Path, first_page: int, last_page: int) -> str:
    """
    OCR fallback: render PDF pages to images with pdftoppm,
    then run tesseract on each image.
    """
    combined = []
    with tempfile.TemporaryDirectory() as tmpdir:
        for page in range(first_page, last_page + 1):
            prefix = os.path.join(tmpdir, f"page{page}")
            try:
                subprocess.run(
                    [
                        "pdftoppm", "-png", "-r", "300", "-singlefile",
                        "-f", str(page), "-l", str(page),
                        str(pdf_path), prefix,
                    ],
                    capture_output=True, timeout=60,
                )
            except (subprocess.TimeoutExpired, Exception):
                continue

            img_path = f"{prefix}.png"
            if not os.path.exists(img_path):
                continue

            try:
                result = subprocess.run(
                    ["tesseract", img_path, "stdout", "--psm", "6"],
                    capture_output=True, text=True, timeout=60,
                )
                if result.stdout.strip():
                    combined.append(result.stdout)
            except (subprocess.TimeoutExpired, Exception):
                continue

    return "\n".join(combined)


def find_date_near_salutation(text: str) -> tuple[str | None, str]:
    """
    Look for a date that appears shortly before a salutation line.
    Returns (date_string, method) or (None, "").
    """
    lines = text.split("\n")

    for i, line in enumerate(lines):
        if SALUTATION_RE.search(line) or SPEAKER_BLOCK_RE.search(line):
            window = "\n".join(lines[max(0, i - 10) : i])
            dates = list(DATE_RE.finditer(window))
            if dates:
                m = dates[-1]
                return parse_date_str(m.group(1), m.group(2), m.group(3)), "before_salutation"
            month_dates = list(MONTH_YEAR_RE.finditer(window))
            if month_dates:
                m = month_dates[-1]
                return parse_month_year(m.group(1), m.group(2)), "before_salutation_month_year"

    return None, ""


def find_date_on_transmittal_page(text: str) -> tuple[str | None, str]:
    """
    If the text contains a TRANSMITTAL LETTER heading, look for the date
    in the header block (address area) before the salutation or report title.
    Restrict the search window to avoid picking up dates from body text
    in multi-column layouts.
    """
    match = TRANSMITTAL_RE.search(text)
    if not match:
        return None, ""

    after_heading = text[match.end():]

    salutation_match = SALUTATION_RE.search(after_heading)
    speaker_match = SPEAKER_BLOCK_RE.search(after_heading)
    end_pos = len(after_heading)
    if salutation_match:
        end_pos = min(end_pos, salutation_match.start())
    if speaker_match:
        end_pos = min(end_pos, speaker_match.start())

    header_block = after_heading[:end_pos] if end_pos < len(after_heading) else after_heading[:600]

    dates = list(DATE_RE.finditer(header_block))
    if dates:
        m = dates[-1]
        return (
            parse_date_str(m.group(1), m.group(2), m.group(3)),
            "transmittal_heading",
        )
    month_dates = list(MONTH_YEAR_RE.finditer(header_block))
    if month_dates:
        m = month_dates[-1]
        return parse_month_year(m.group(1), m.group(2)), "transmittal_heading_month_year"
    return None, ""


def find_date_near_ag(text: str) -> tuple[str | None, str]:
    """
    Fallback: date on the info/copyright page near 'Auditor-General'.
    These pages often have "Johnson Akuamoah Asiedu\nAuditor-General\n...\n4 June, 2021".
    """
    lines = text.split("\n")
    for i, line in enumerate(lines):
        if AG_RE.search(line):
            window = "\n".join(lines[i : min(len(lines), i + 5)])
            m = DATE_RE.search(window)
            if m:
                return parse_date_str(m.group(1), m.group(2), m.group(3)), "near_auditor_general"
            m = MONTH_YEAR_RE.search(window)
            if m:
                return parse_month_year(m.group(1), m.group(2)), "near_auditor_general_month_year"
    return None, ""


def process_report(pdf_path: Path) -> dict:
    """Extract the transmittal date from a single PDF."""
    text_2_5 = extract_text(pdf_path, 2, 5)
    text_layout = extract_text(pdf_path, 2, 5, layout=True)

    used_ocr = False
    if len(text_2_5.strip()) < 50 and len(text_layout.strip()) < 50:
        text_2_5 = ocr_extract_text(pdf_path, 2, 7)
        text_layout = ""
        used_ocr = True
        if len(text_2_5.strip()) < 50:
            return {
                "date": None,
                "confidence": "no_text",
                "method": "none",
                "notes": "No text from pdftotext or OCR (tesseract) — needs manual review",
            }

    best_text = text_2_5 if len(text_2_5.strip()) >= len(text_layout.strip()) else text_layout
    ocr_tag = " (via OCR)" if used_ocr else ""
    texts = [text_2_5, text_layout] if not used_ocr else [text_2_5]

    # Strategy 1: date right before salutation
    for text in texts:
        date, method = find_date_near_salutation(text)
        if date:
            return {"date": date, "confidence": "high", "method": method + ocr_tag, "notes": ""}

    # Strategy 2: date after TRANSMITTAL LETTER heading
    for text in (reversed(texts) if not used_ocr else texts):
        date, method = find_date_on_transmittal_page(text)
        if date:
            return {"date": date, "confidence": "high", "method": method + ocr_tag, "notes": ""}

    # Strategy 3: date near Auditor-General on info page
    for text in texts:
        date, method = find_date_near_ag(text)
        if date:
            return {
                "date": date,
                "confidence": "medium",
                "method": method + ocr_tag,
                "notes": "Date from info page, not transmittal letter",
            }

    # Strategy 4: any date found on pages 2-5
    all_dates = DATE_RE.findall(best_text)
    if all_dates:
        day, month, year = all_dates[0]
        return {
            "date": parse_date_str(day, month, year),
            "confidence": "low",
            "method": "first_date_found" + ocr_tag,
            "notes": f"No salutation/transmittal match; used first date found ({len(all_dates)} dates on pages 2-5)",
        }

    return {
        "date": None,
        "confidence": "no_date",
        "method": "none",
        "notes": f"Text extracted{ocr_tag} but no date in DD Month YYYY format found on pages 2-5",
    }


def main():
    with open(SEED_FILE) as f:
        reports = json.load(f)

    results = []
    stats = {"high": 0, "medium": 0, "low": 0, "no_text": 0, "no_date": 0, "remote": 0}

    for i, report in enumerate(reports, 1):
        slug = report["slug"]
        current_date = report["publishedAt"]
        file_url = report["fileUrl"]
        title = report["translations"]["en"]["title"]

        if file_url.startswith("http"):
            results.append({
                "slug": slug,
                "title": title,
                "current_published_at": current_date,
                "extracted_date": "",
                "confidence": "remote",
                "method": "none",
                "notes": "PDF not downloaded locally — needs manual download first",
                "date_changed": "",
            })
            stats["remote"] += 1
            print(f"  [{i}/{len(reports)}] SKIP (remote): {slug}")
            continue

        pdf_filename = file_url.replace("/pdf/reports/", "")
        pdf_path = PDF_DIR / pdf_filename

        if not pdf_path.exists():
            results.append({
                "slug": slug,
                "title": title,
                "current_published_at": current_date,
                "extracted_date": "",
                "confidence": "missing",
                "method": "none",
                "notes": "PDF file not found on disk",
                "date_changed": "",
            })
            print(f"  [{i}/{len(reports)}] MISSING: {slug}")
            continue

        result = process_report(pdf_path)
        date_changed = ""
        if result["date"] and result["date"] != current_date:
            date_changed = "YES"
        elif result["date"] and result["date"] == current_date:
            date_changed = "no"

        results.append({
            "slug": slug,
            "title": title,
            "current_published_at": current_date,
            "extracted_date": result["date"] or "",
            "confidence": result["confidence"],
            "method": result["method"],
            "notes": result["notes"],
            "date_changed": date_changed,
        })
        stats[result["confidence"]] += 1

        status = "OK" if result["date"] else "REVIEW"
        print(f"  [{i}/{len(reports)}] {status} ({result['confidence']}): {slug}")
        if result["date"]:
            print(f"           current={current_date}  extracted={result['date']}  method={result['method']}")

    with open(OUTPUT_CSV, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "slug", "title", "current_published_at", "extracted_date",
            "confidence", "method", "notes", "date_changed",
        ])
        writer.writeheader()
        writer.writerows(results)

    print(f"\n{'='*60}")
    print(f"Results saved to: {OUTPUT_CSV}")
    print(f"{'='*60}")
    print(f"  High confidence:   {stats['high']}")
    print(f"  Medium confidence: {stats['medium']}")
    print(f"  Low confidence:    {stats['low']}")
    print(f"  No text (OCR):     {stats['no_text']}")
    print(f"  No date found:     {stats['no_date']}")
    print(f"  Remote (skipped):  {stats['remote']}")
    print(f"  Total:             {len(reports)}")


if __name__ == "__main__":
    main()
