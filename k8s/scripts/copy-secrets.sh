#!/usr/bin/env bash
# Copy the app's Secrets from one deployment to another (cluster/namespace),
# without ever printing a value. Rewrites REDIS_URL to the namespace-independent
# short host (`redis`) that templates/secrets.yaml uses.
#
#   usage: scripts/copy-secrets.sh <src-context> <src-ns> <dst-context> <dst-ns> [secret ...]
#   default secrets: gas-secrets gas-db-credentials azure-storage-secret gas-tls
set -euo pipefail
if [ "$#" -lt 4 ]; then echo "usage: copy-secrets.sh <src-context> <src-ns> <dst-context> <dst-ns> [secret ...]" >&2; exit 2; fi
SRC_CTX="$1"; SRC_NS="$2"; DST_CTX="$3"; DST_NS="$4"; shift 4
SECRETS=("$@"); [ ${#SECRETS[@]} -gt 0 ] || SECRETS=(gas-secrets gas-db-credentials azure-storage-secret gas-tls)
for s in "${SECRETS[@]}"; do
  kubectl --context "$SRC_CTX" -n "$SRC_NS" get secret "$s" -o json | python3 -c '
import sys, json, base64
dst_ns = sys.argv[1]
o = json.load(sys.stdin)
md = o["metadata"]
o["metadata"] = {"name": md["name"], "namespace": dst_ns, "labels": md.get("labels", {})}
d = o.get("data") or {}
if "REDIS_URL" in d:
    u = base64.b64decode(d["REDIS_URL"]).decode()
    u = u.replace("@redis.gas.svc.cluster.local:", "@redis:")
    d["REDIS_URL"] = base64.b64encode(u.encode()).decode()
o["data"] = d
json.dump(o, sys.stdout)' "$DST_NS" | kubectl --context "$DST_CTX" apply -f -
done
echo "non-empty keys in $DST_CTX/$DST_NS/gas-secrets:"
kubectl --context "$DST_CTX" -n "$DST_NS" get secret gas-secrets \
  -o go-template='{{range $k,$v := .data}}{{if $v}}{{$k}} {{end}}{{end}}{{"\n"}}'
