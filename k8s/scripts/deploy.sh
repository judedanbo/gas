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
# cache-tls -> cache -> migrate Job -> storage -> app -> backup.
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
k get pvc gas-public-files-pvc -n "$NAMESPACE" >/dev/null 2>&1 || apply_stage storage
k wait --for=jsonpath='{.status.phase}'=Bound pvc/gas-public-files-pvc -n "$NAMESPACE" --timeout=180s

echo "==> app";      apply_stage app
echo "==> backup";   apply_stage backup

echo "==> verify"
k rollout status deployment/gas-frontend -n "$NAMESPACE" --timeout=600s
k get pods,svc,ingress,certificate -n "$NAMESPACE"
