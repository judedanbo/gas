#!/usr/bin/env python3
"""Maintain the `uptime-history` branch: append probe results, compute rolling
uptime, and regenerate the status page.

Usage:
    update-history.py <results-dir> <history-dir>

<results-dir>   directory of result-<env>.json files written by the probe jobs
                in .github/workflows/uptime.yml
<history-dir>   a checkout (worktree) of the uptime-history branch

Layout written to <history-dir>:
    data/<env>/<YYYY-MM>.jsonl   raw probe records, one JSON object per line
    status.json                  machine-readable rolling stats
    badge/<env>.json             Shields.io endpoint-badge JSON
    README.md                    human-readable status page

Only the Python stdlib is used — this runs on a bare GitHub-hosted runner.
Records are deduplicated per (env, ts) so re-running a workflow's record job
cannot double-count a probe.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

WINDOWS: list[tuple[str, timedelta]] = [
    ("24h", timedelta(hours=24)),
    ("7d", timedelta(days=7)),
    ("30d", timedelta(days=30)),
    ("90d", timedelta(days=90)),
]
HISTORY_SPAN = timedelta(days=91)  # widest window + 1 day of slack
MAX_INCIDENTS_SHOWN = 10


def parse_ts(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def load_results(results_dir: Path) -> list[dict]:
    results = []
    for path in sorted(results_dir.glob("result-*.json")):
        try:
            record = json.loads(path.read_text())
            parse_ts(record["ts"])  # KeyError/ValueError on a malformed record
            record["env"]
            results.append(record)
        except (json.JSONDecodeError, KeyError, ValueError, OSError) as err:
            print(f"WARN: skipping unreadable result {path.name}: {err}", file=sys.stderr)
    return results


def append_results(history_dir: Path, results: list[dict]) -> None:
    for record in results:
        ts = parse_ts(record["ts"])
        month_file = history_dir / "data" / record["env"] / f"{ts:%Y-%m}.jsonl"
        month_file.parent.mkdir(parents=True, exist_ok=True)
        existing_ts = set()
        if month_file.exists():
            for line in month_file.read_text().splitlines():
                try:
                    existing_ts.add(json.loads(line)["ts"])
                except (json.JSONDecodeError, KeyError):
                    continue
        if record["ts"] in existing_ts:
            print(f"INFO: {record['env']} @ {record['ts']} already recorded; skipping")
            continue
        with month_file.open("a") as fh:
            fh.write(json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n")


def load_history(history_dir: Path, env: str, since: datetime) -> list[tuple[datetime, dict]]:
    records = []
    for month_file in sorted((history_dir / "data" / env).glob("*.jsonl")):
        # Month files are zero-padded, so string comparison orders correctly.
        if month_file.stem < f"{since:%Y-%m}":
            continue
        for line in month_file.read_text().splitlines():
            try:
                record = json.loads(line)
                ts = parse_ts(record["ts"])
            except (json.JSONDecodeError, KeyError, ValueError):
                continue
            if ts >= since:
                records.append((ts, record))
    records.sort(key=lambda pair: pair[0])
    return records


def window_stats(records: list[tuple[datetime, dict]], now: datetime) -> dict:
    stats = {}
    for name, delta in WINDOWS:
        window = [r for ts, r in records if ts >= now - delta]
        total = len(window)
        up = sum(1 for r in window if r.get("up"))
        latencies = [
            r["latency_ms"]
            for r in window
            if r.get("up") and isinstance(r.get("latency_ms"), int) and r["latency_ms"] > 0
        ]
        stats[name] = {
            "checks": total,
            "up": up,
            "uptime_pct": round(100 * up / total, 2) if total else None,
            "avg_latency_ms": round(sum(latencies) / len(latencies)) if latencies else None,
        }
    return stats


def find_incidents(records: list[tuple[datetime, dict]]) -> list[dict]:
    """Group consecutive down checks into incidents (oldest first)."""
    incidents: list[dict] = []
    current: dict | None = None
    for ts, record in records:
        if not record.get("up"):
            if current is None:
                current = {
                    "start": ts,
                    "last_down": ts,
                    "checks": 0,
                    "reason": record.get("reason") or "unknown",
                }
            current["last_down"] = ts
            current["checks"] += 1
        elif current is not None:
            current["resolved"] = ts
            incidents.append(current)
            current = None
    if current is not None:
        current["resolved"] = None  # ongoing
        incidents.append(current)
    return incidents


def fmt_duration(start: datetime, end: datetime) -> str:
    minutes = max(1, int((end - start).total_seconds() // 60))
    if minutes < 60:
        return f"{minutes} min"
    if minutes < 60 * 24:
        return f"{minutes // 60} h {minutes % 60:02d} min"
    return f"{minutes // (60 * 24)} d {(minutes % (60 * 24)) // 60} h"


def badge_json(env: str, current_up: bool, stats: dict) -> dict:
    pct = stats["30d"]["uptime_pct"]
    if not current_up:
        message, color = "down", "red"
    elif pct is None:
        message, color = "no data", "lightgrey"
    else:
        message = f"{pct:g}% (30d)"
        color = (
            "brightgreen"
            if pct >= 99.9
            else "green" if pct >= 99 else "yellow" if pct >= 95 else "red"
        )
    return {"schemaVersion": 1, "label": f"uptime ({env})", "message": message, "color": color}


def fmt_pct(value: float | None) -> str:
    return f"{value:g}%" if value is not None else "–"


def fmt_latency(value: int | None) -> str:
    return f"{value} ms" if value is not None else "–"


def render_readme(now: datetime, environments: dict) -> str:
    lines = [
        "# Uptime — Ghana Audit Service",
        "",
        "> Auto-generated by [`uptime.yml`](../../blob/main/.github/workflows/uptime.yml)"
        " on every probe (~5 min). **Do not edit by hand** — see"
        " [`MONITORING.md`](../../blob/main/MONITORING.md) on `main`.",
        "",
        f"_Last updated: {now:%Y-%m-%d %H:%M} UTC_",
        "",
    ]
    for env, info in environments.items():
        state = "🟢 **Up**" if info["current_up"] else "🔴 **Down**"
        lines += [
            f"## {env} — {info['url'] or ''}",
            "",
            f"Current status: {state}",
            "",
            "| Window | Checks | Uptime | Avg latency |",
            "| ------ | -----: | -----: | ----------: |",
        ]
        for name, _ in WINDOWS:
            w = info["windows"][name]
            lines.append(
                f"| {name} | {w['checks']} | {fmt_pct(w['uptime_pct'])}"
                f" | {fmt_latency(w['avg_latency_ms'])} |"
            )
        lines += ["", f"### Incidents (last {MAX_INCIDENTS_SHOWN}, 90-day window)", ""]
        incidents = info["incidents"]
        if not incidents:
            lines += ["None in the last 90 days 🎉", ""]
        else:
            lines += [
                "| Started (UTC) | Duration | Failed checks | First failure |",
                "| ------------- | -------- | ------------: | ------------- |",
            ]
            for inc in list(reversed(incidents))[:MAX_INCIDENTS_SHOWN]:
                if inc["resolved"] is not None:
                    duration = fmt_duration(inc["start"], inc["resolved"])
                else:
                    duration = f"**ongoing** ({fmt_duration(inc['start'], now)})"
                reason = str(inc["reason"]).replace("|", "\\|")[:120]
                lines.append(
                    f"| {inc['start']:%Y-%m-%d %H:%M} | {duration}"
                    f" | {inc['checks']} | {reason} |"
                )
            lines.append("")
    lines += [
        "---",
        "",
        "Raw records: [`data/`](./data) (one JSON line per probe, monthly files).",
        "Machine-readable stats: [`status.json`](./status.json).",
        "Badges: `badge/<env>.json` (Shields.io endpoint schema).",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    results_dir, history_dir = Path(sys.argv[1]), Path(sys.argv[2])
    now = datetime.now(timezone.utc)

    append_results(history_dir, load_results(results_dir))

    data_root = history_dir / "data"
    envs = sorted(d.name for d in data_root.iterdir() if d.is_dir()) if data_root.is_dir() else []
    if not envs:
        print("No history data yet; nothing to render.")
        return 0

    environments = {}
    for env in envs:
        records = load_history(history_dir, env, now - HISTORY_SPAN)
        if not records:
            continue
        last = records[-1][1]
        environments[env] = {
            "url": last.get("url"),
            "current_up": bool(last.get("up")),
            "last_check": last.get("ts"),
            "windows": window_stats(records, now),
            "incidents": find_incidents(records),
        }

    status = {
        "generated": f"{now:%Y-%m-%dT%H:%M:%SZ}",
        "environments": {
            env: {k: v for k, v in info.items() if k != "incidents"}
            for env, info in environments.items()
        },
    }
    (history_dir / "status.json").write_text(json.dumps(status, indent=2) + "\n")

    badge_dir = history_dir / "badge"
    badge_dir.mkdir(exist_ok=True)
    for env, info in environments.items():
        (badge_dir / f"{env}.json").write_text(
            json.dumps(badge_json(env, info["current_up"], info["windows"])) + "\n"
        )

    (history_dir / "README.md").write_text(render_readme(now, environments))
    print(f"Recorded {len(environments)} environment(s): {', '.join(environments)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
