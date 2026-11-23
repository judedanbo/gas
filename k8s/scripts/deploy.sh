#!/usr/bin/env bash
# Ordered deploy of one overlay to one cluster. Used by CI and for manual deploys.
#
#   usage: scripts/deploy.sh <overlay> [kube-context]
#   env:   ACR_REGISTRY, IMAGE_TAG            (required)
#          SECRETS_SOURCE=env|existing         (default env)
#            env      — render templates/secrets.yaml from the exported
#                       secret variables (what CI does)
#            existing — Secrets already exist in the namespace (manual
#                       bootstrap / secrets copied from another cluster)
#          SKIP_MIGRATE=1                      skip the migration Job
#
# Order (dependency driven): config -> secrets -> policy -> database ->
# cache-tls -> cache -> migrate Job -> storage -> app -> backup -> geoip.
set -euo pipefail
overlay="${1:?usage: deploy.sh <overlay> [kube-context]}"
ctx="${2:-}"
: "${ACR_REGISTRY:?}" "${IMAGE_TAG:?}"
SECRETS_SOURCE="${SECRETS_SOURCE:-env}"
root="$(cd "$(dirname "$0")/.." && pwd)"
k() { if [ -n "$ctx" ]; then kubectl --context "$ctx" "$@"; else kubectl "$@"; fi; }
STAGE=deploy.audit.gov.gh/stage

rendered="$(mktemp)"; trap 'rm -f "$rendered"' EXIT
"$root/scripts/render.sh" "$overlay" > "$rendered"
NAMESPACE="$(awk '/^kind: Namespace/{f=1} f&&/^  name:/{print $2; exit}' "$rendered")"
export NAMESPACE
echo "==> overlay=$overlay namespace=$NAMESPACE image=$ACR_REGISTRY.azurecr.io/*:$IMAGE_TAG context=${ctx:-current}"

apply_stage() { k apply -f "$rendered" -l "$STAGE=$1"; }

echo "==> config";   apply_stage config

echo "==> secrets ($SECRETS_SOURCE)"
case "$SECRETS_SOURCE" in
  env)
    tmpl="$root/templates/secrets.yaml"
    vars="$(grep -oE '\$\{[A-Z_][A-Z0-9_]*\}' "$tmpl" | sort -u | tr '\n' ' ')"
    for v in DB_USER DB_PASSWORD MYSQL_ROOT_PASSWORD JWT_SECRET NUXT_API_SECRET ANALYTICS_IP_SALT; do
      [ -n "${!v:-}" ] || { echo "deploy.sh: required secret $v is empty" >&2; exit 1; }
    done
    for ref in $vars; do
      name="${ref:2:${#ref}-3}"
      case "${!name:-}" in *'"'*|*'\'*|*$'\n'*)
        echo "deploy.sh: secret $name contains a quote, backslash or newline" >&2; exit 1;; esac
    done
    envsubst "$vars" < "$tmpl" | k apply -f - ;;
  existing)
    for s in gas-secrets gas-db-credentials; do
      k get secret "$s" -n "$NAMESPACE" -o name >/dev/null
    done ;;
  *) echo "deploy.sh: SECRETS_SOURCE must be env or existing" >&2; exit 1 ;;
esac

echo "==> policy";   apply_stage policy

echo "==> database"; apply_stage database
k rollout status statefulset/mysql -n "$NAMESPACE" --timeout=300s

echo "==> cache";    apply_stage cache-tls
k wait --for=condition=Ready certificate/redis-server-tls -n "$NAMESPACE" --timeout=120s
apply_stage cache
k rollout status deployment/redis -n "$NAMESPACE" --timeout=180s

if [ "${SKIP_MIGRATE:-0}" != "1" ]; then
  echo "==> migrate"
  export JOB_SUFFIX="${IMAGE_TAG:0:7}"
  envsubst '${NAMESPACE} ${ACR_REGISTRY} ${IMAGE_TAG} ${JOB_SUFFIX}' \
    < "$root/templates/migrate-job.yaml" | k apply -f -
  k wait --for=condition=complete "job/gas-migrate-$JOB_SUFFIX" -n "$NAMESPACE" --timeout=300s
fi

echo "==> storage"
# A PVC spec is immutable once Bound: create only when absent, then assert Bound.
for pvc in gas-public-files-pvc gas-geoip-pvc; do
  k get pvc "$pvc" -n "$NAMESPACE" >/dev/null 2>&1 || apply_stage storage
  k wait --for=jsonpath='{.status.phase}'=Bound "pvc/$pvc" -n "$NAMESPACE" --timeout=180s
done

echo "==> app";      apply_stage app
echo "==> backup";   apply_stage backup

echo "==> geoip"
# Visitor geolocation (MaxMind GeoLite2). Only when the gas-maxmind Secret has
# credentials; otherwise skip with a warning (every visit shows "Unknown").
maxmind_id="$(k get secret gas-maxmind -n "$NAMESPACE" -o jsonpath='{.data.GEOIPUPDATE_ACCOUNT_ID}' 2>/dev/null || true)"
if [ -z "$maxmind_id" ] || [ "$(printf '%s' "$maxmind_id" | base64 -d)" = "" ]; then
  echo "::warning title=Visitor geolocation disabled::MAXMIND_ACCOUNT_ID / MAXMIND_LICENSE_KEY are not set; geoip-update CronJob skipped."
else
  apply_stage geoip
  # The schedule only fires twice a week; run now until one run has succeeded.
  if [ -z "$(k get cronjob geoip-update -n "$NAMESPACE" -o jsonpath='{.status.lastSuccessfulTime}')" ]; then
    job="geoip-update-${IMAGE_TAG:0:7}"
    k delete job "$job" -n "$NAMESPACE" --ignore-not-found
    k create job "$job" --from=cronjob/geoip-update -n "$NAMESPACE"
    if k wait --for=condition=complete "job/$job" -n "$NAMESPACE" --timeout=180s; then
      k logs "job/$job" -n "$NAMESPACE" --tail=20 || true
    else
      k logs "job/$job" -n "$NAMESPACE" --tail=50 || true
      echo "::warning title=GeoLite2 download failed::job/$job did not complete; check the MaxMind credentials. The frontend keeps running without geolocation."
    fi
  fi
fi

echo "==> verify"
# Visitor geolocation and per-IP rate limiting need the real client IP, which
# only survives the Azure load balancer with externalTrafficPolicy: Local.
policy="$(k get svc -n ingress-nginx -l app.kubernetes.io/component=controller \
  -o jsonpath='{.items[?(@.spec.type=="LoadBalancer")].spec.externalTrafficPolicy}' 2>/dev/null || true)"
[ "$policy" = "Local" ] || echo "::warning title=Client IPs not preserved::ingress-nginx controller Service has externalTrafficPolicy='${policy:-unknown}' (want Local); visitors show as node IPs."
# Print state either way; on failure show why (scheduling, probes, crashes,
# OOM) — Kubernetes state only, no container logs (CI logs are public).
status=0
k rollout status deployment/gas-frontend -n "$NAMESPACE" --timeout=600s || status=$?
k get pods,svc,ingress,certificate -n "$NAMESPACE"
if [ "$status" -ne 0 ]; then
  echo "::group::Why gas-frontend did not finish rolling out"
  k get deployment,replicaset,hpa -n "$NAMESPACE" -o wide || true
  k describe pods -n "$NAMESPACE" -l app.kubernetes.io/name=gas-frontend || true
  k get events -n "$NAMESPACE" --sort-by=.lastTimestamp | tail -n 40 || true
  echo "::endgroup::"
  echo "::error title=gas-frontend rollout did not finish::kubectl rollout status failed (exit $status)."
  exit "$status"
fi
