#!/usr/bin/env bash
# Populate a GitHub Environment's secrets from a LIVE deployment's Kubernetes
# Secrets, so CI re-renders exactly the credentials the running MySQL/Redis
# were initialised with. Values are read into this process and piped straight
# to `gh secret set`; nothing is printed.
#
#   usage: scripts/github-env-from-cluster.sh <kube-context> <namespace> <github-env>
#   e.g.   scripts/github-env-from-cluster.sh website gas-staging staging
#
# Also sets the non-secret identifiers (Azure tenant/subscription, the
# gas-github-deploy client ID, the website cluster + resource group).
set -euo pipefail
if [ "$#" -lt 3 ]; then echo "usage: github-env-from-cluster.sh <kube-context> <namespace> <github-env>" >&2; exit 2; fi
CTX="$1"; NS="$2"; ENV_NAME="$3"
root="$(cd "$(dirname "$0")/.." && pwd)"

val() { # secret, key -> decoded value ("" if absent)
  kubectl --context "$CTX" -n "$NS" get secret "$1" -o jsonpath="{.data.$2}" 2>/dev/null | base64 -d || true
}

export AZURE_CLIENT_ID="${AZURE_CLIENT_ID:-b0a69f79-c87a-4775-b9b0-c70e7a0137ac}"   # gas-github-deploy
export AZURE_TENANT_ID="$(az account show --query tenantId -o tsv)"
export AZURE_SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
export AKS_CLUSTER_NAME="${AKS_CLUSTER_NAME:-website}" AKS_RESOURCE_GROUP="${AKS_RESOURCE_GROUP:-website_group}"

for k in DB_USER DB_PASSWORD JWT_SECRET NUXT_API_SECRET ANALYTICS_IP_SALT REDIS_PASSWORD \
         AZURE_STORAGE_CONNECTION_STRING AZURE_BLOB_CONTAINER ADMIN_EMAIL ADMIN_PASSWORD ADMIN_NAME \
         NUXT_SMTP_HOST NUXT_SMTP_PORT NUXT_SMTP_USER NUXT_SMTP_PASS NUXT_SMTP_FROM YOUTUBE_API_KEY; do
  export "$k=$(val gas-secrets "$k")"
done
export MYSQL_ROOT_PASSWORD="$(val gas-db-credentials MYSQL_ROOT_PASSWORD)"
export AZURE_STORAGE_ACCOUNT_NAME="$(val azure-storage-secret azurestorageaccountname)"
export AZURE_STORAGE_ACCOUNT_KEY="$(val azure-storage-secret azurestorageaccountkey)"
export MAXMIND_ACCOUNT_ID="$(val gas-maxmind GEOIPUPDATE_ACCOUNT_ID)"
export MAXMIND_LICENSE_KEY="$(val gas-maxmind GEOIPUPDATE_LICENSE_KEY)"

for k in DB_USER DB_PASSWORD MYSQL_ROOT_PASSWORD JWT_SECRET NUXT_API_SECRET ANALYTICS_IP_SALT; do
  [ -n "${!k}" ] || { echo "error: $k is empty in $CTX/$NS — refusing (bootstrap would generate a new one and break the running DB)" >&2; exit 1; }
done

exec "$root/bootstrap-deploy-secrets.sh" "$ENV_NAME"
