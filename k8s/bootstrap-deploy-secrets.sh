#!/usr/bin/env bash
#
# bootstrap-deploy-secrets.sh — create the `production` environment and populate
# the GitHub secrets the AKS deploy workflow needs.
#
# Values are read from YOUR SHELL ENVIRONMENT (never hardcoded here) and piped to
# `gh secret set` via stdin (never argv), so no secret is written to disk or the
# process list. Random app secrets are generated with openssl if you don't
# provide them.
#
# ── Usage ────────────────────────────────────────────────────────────────────
#   # 1. Export the values only you have (Azure OIDC IDs + AKS target):
#   export AZURE_CLIENT_ID=...  AZURE_TENANT_ID=...  AZURE_SUBSCRIPTION_ID=...
#   export AKS_CLUSTER_NAME=...  AKS_RESOURCE_GROUP=...
#   # 2. (optional) reuse EXISTING db creds / set admin + blob — see notes below
#   # 3. Run:
#   k8s/bootstrap-deploy-secrets.sh
#   # 4. Verify:
#   k8s/check-deploy-secrets.sh
#
# ⚠️  MySQL credentials are fixed at FIRST init of the data volume. If a MySQL
#     StatefulSet PVC already exists (e.g. from a manual deploy), DO NOT let this
#     generate new DB_PASSWORD / MYSQL_ROOT_PASSWORD — export the EXISTING values
#     so the app can still connect, or reset the mysql-data PVC.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

ENV_NAME="${ENV_NAME:-production}"
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

# Values you must supply by exporting them before running.
REQUIRED_FROM_ENV="AZURE_CLIENT_ID AZURE_TENANT_ID AZURE_SUBSCRIPTION_ID \
AKS_CLUSTER_NAME AKS_RESOURCE_GROUP"

missing=""
for v in $REQUIRED_FROM_ENV; do
  [ -n "${!v:-}" ] || missing="$missing $v"
done
if [ -n "$missing" ]; then
  echo "error: export these first then re-run:$missing" >&2
  exit 1
fi

set_secret() { # name, value — skips silently when value is empty (optional secrets)
  local name="$1" value="${2:-}"
  if [ -z "$value" ]; then
    echo "  skip $name (no value)"
    return
  fi
  printf '%s' "$value" | gh secret set "$name" --env "$ENV_NAME"
  echo "  set  $name"
}

echo "Repo: $REPO   Environment: $ENV_NAME"
gh api -X PUT "repos/$REPO/environments/$ENV_NAME" >/dev/null
echo "Environment ready (created if absent)."

echo "Operator-supplied (Azure OIDC + AKS):"
set_secret AZURE_CLIENT_ID "$AZURE_CLIENT_ID"
set_secret AZURE_TENANT_ID "$AZURE_TENANT_ID"
set_secret AZURE_SUBSCRIPTION_ID "$AZURE_SUBSCRIPTION_ID"
set_secret AKS_CLUSTER_NAME "$AKS_CLUSTER_NAME"
set_secret AKS_RESOURCE_GROUP "$AKS_RESOURCE_GROUP"

echo "App secrets (generated if not exported):"
set_secret DB_USER "${DB_USER:-gas_user}"
set_secret DB_PASSWORD "${DB_PASSWORD:-$(openssl rand -base64 24)}"
set_secret MYSQL_ROOT_PASSWORD "${MYSQL_ROOT_PASSWORD:-$(openssl rand -base64 24)}"
set_secret JWT_SECRET "${JWT_SECRET:-$(openssl rand -base64 48)}"
set_secret NUXT_API_SECRET "${NUXT_API_SECRET:-$(openssl rand -base64 48)}"
set_secret ANALYTICS_IP_SALT "${ANALYTICS_IP_SALT:-$(openssl rand -hex 32)}"

echo "Optional (set only if exported):"
set_secret ADMIN_EMAIL "${ADMIN_EMAIL:-}"
set_secret ADMIN_PASSWORD "${ADMIN_PASSWORD:-}"
set_secret ADMIN_NAME "${ADMIN_NAME:-}"
set_secret AZURE_STORAGE_ACCOUNT_NAME "${AZURE_STORAGE_ACCOUNT_NAME:-}"
set_secret AZURE_STORAGE_ACCOUNT_KEY "${AZURE_STORAGE_ACCOUNT_KEY:-}"
set_secret AZURE_STORAGE_CONNECTION_STRING "${AZURE_STORAGE_CONNECTION_STRING:-}"
set_secret AZURE_BLOB_CONTAINER "${AZURE_BLOB_CONTAINER:-}"

echo
echo "Done. Generated DB/root passwords are now only in GitHub + (after deploy) the"
echo "cluster Secret. Retrieve later with:"
echo "  kubectl get secret gas-db-credentials -n gas -o jsonpath='{.data.MYSQL_PASSWORD}' | base64 -d"
echo "Verify coverage:  k8s/check-deploy-secrets.sh $ENV_NAME"
