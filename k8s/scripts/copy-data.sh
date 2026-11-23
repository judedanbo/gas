#!/usr/bin/env bash
# One-time data copy between two deployments of this app (different clusters
# and/or namespaces): MySQL dump/restore plus the public-files volume.
#
#   usage: scripts/copy-data.sh <src-context> <src-ns> <dst-context> <dst-ns> [full|production]
#
#   full        — everything (staging -> staging move). Default.
#   production  — data only, EXCLUDING analytics/telemetry tables (raw client
#                 IPs), sessions, audit log, rate-limit state, newsletter and
#                 contact submissions, and the Drizzle migration ledger (the
#                 destination's migrate Job owns it). Clears invitation tokens
#                 and lockout state after import.
#
# Prerequisites: destination stack already deployed (scripts/deploy.sh), so
# mysql-0 and a frontend pod (with the public-files PVC) exist on both sides.
# Run from a machine with both kube contexts. Needs ~2x the DB dump size free
# in $TMPDIR.
set -euo pipefail
if [ "$#" -lt 4 ]; then echo "usage: copy-data.sh <src-context> <src-ns> <dst-context> <dst-ns> [full|production]" >&2; exit 2; fi
SRC_CTX="$1"; SRC_NS="$2"; DST_CTX="$3"; DST_NS="$4"; MODE="${5:-full}"
DB=ghana_audit_service
umask 077
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
DUMP="$WORK/dump.sql.gz"

sql() { kubectl --context "$1" -n "$2" exec -i mysql-0 -- sh -c "mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" --default-character-set=utf8mb4 $DB $3"; }

echo "==> [1/4] dump $SRC_CTX/$SRC_NS ($MODE)"
case "$MODE" in
  full)
    OPTS="--routines --triggers" ;;
  production)
    EXCLUDE="request_events download_events route_stats_hourly bot_signatures abuse_incidents search_queries admin_sessions rate_limit_entries audit_logs newsletter_subscribers contact_submissions __drizzle_migrations"
    OPTS="--no-create-info --complete-insert --skip-triggers"
    for t in $EXCLUDE; do OPTS="$OPTS --ignore-table=$DB.$t"; done ;;
  *) echo "mode must be full or production" >&2; exit 1 ;;
esac
kubectl --context "$SRC_CTX" -n "$SRC_NS" exec mysql-0 -- sh -c \
  "mysqldump -uroot -p\"\$MYSQL_ROOT_PASSWORD\" --single-transaction --hex-blob \
   --set-gtid-purged=OFF --default-character-set=utf8mb4 $OPTS $DB 2>/dev/null | gzip -c" > "$DUMP"
gzip -t "$DUMP"
zcat "$DUMP" | tail -1 | grep -q 'Dump completed' || { echo "dump did not complete" >&2; exit 1; }
echo "    $(du -h "$DUMP" | cut -f1)"

echo "==> [2/4] restore into $DST_CTX/$DST_NS"
zcat "$DUMP" | sql "$DST_CTX" "$DST_NS" ""
if [ "$MODE" = production ]; then
  sql "$DST_CTX" "$DST_NS" "-e \"UPDATE users SET invitation_token=NULL, invitation_token_expires_at=NULL, failed_login_attempts=0, lockout_count=0, locked_until=NULL\""
fi
echo "    tables: $(sql "$DST_CTX" "$DST_NS" "-N -e 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=\"$DB\"'")"

echo "==> [3/4] public files (img images uploads pdf)"
src_pod="$(kubectl --context "$SRC_CTX" -n "$SRC_NS" get pod -l app.kubernetes.io/name=gas-frontend -o jsonpath='{.items[0].metadata.name}')"
dst_pod="$(kubectl --context "$DST_CTX" -n "$DST_NS" get pod -l app.kubernetes.io/name=gas-frontend -o jsonpath='{.items[0].metadata.name}')"
for d in img images uploads pdf; do
  n="$(kubectl --context "$SRC_CTX" -n "$SRC_NS" exec "$src_pod" -c frontend -- sh -c "find /app/public/$d -type f 2>/dev/null | wc -l")"
  echo "    $d: $n files"
  kubectl --context "$SRC_CTX" -n "$SRC_NS" exec "$src_pod" -c frontend -- tar -C /app/public -cf - "$d" \
    | kubectl --context "$DST_CTX" -n "$DST_NS" exec -i "$dst_pod" -c frontend -- tar -C /app/public -xf -
done

echo "==> [4/4] restart destination frontend so it sees the imported data"
kubectl --context "$DST_CTX" -n "$DST_NS" rollout restart deployment/gas-frontend
kubectl --context "$DST_CTX" -n "$DST_NS" rollout status deployment/gas-frontend --timeout=600s
echo "done"
