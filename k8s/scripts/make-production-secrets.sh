#!/usr/bin/env bash
# First-time production Secrets: fresh credentials for everything environment-
# specific, plus the shared integration values (SMTP, admin bootstrap, YouTube,
# Blob) carried over from an existing deployment's gas-secrets. Applies the
# rendered templates/secrets.yaml and writes the generated values to
# k8s/.env.production (git-ignored, mode 600) so they can be loaded into the
# GitHub `production` environment — CI re-renders Secrets from GitHub on every
# deploy, and a mismatch with the passwords MySQL was initialised with would
# take the site down.
#
#   usage: scripts/make-production-secrets.sh <src-context> <src-ns> <dst-context> <dst-ns>
set -euo pipefail
if [ "$#" -lt 4 ]; then echo "usage: make-production-secrets.sh <src-context> <src-ns> <dst-context> <dst-ns>" >&2; exit 2; fi
SRC_CTX="$1"; SRC_NS="$2"; DST_CTX="$3"; DST_NS="$4"
root="$(cd "$(dirname "$0")/.." && pwd)"
umask 077
ENVFILE="$root/.env.production"
[ -e "$ENVFILE" ] && { echo "$ENVFILE already exists — refusing to overwrite production credentials" >&2; exit 1; }

# shared values from the source deployment (never printed)
carry() { kubectl --context "$SRC_CTX" -n "$SRC_NS" get secret gas-secrets -o jsonpath="{.data.$1}" | base64 -d; }
export ADMIN_EMAIL="$(carry ADMIN_EMAIL)" ADMIN_PASSWORD="$(carry ADMIN_PASSWORD)" ADMIN_NAME="$(carry ADMIN_NAME)"
export NUXT_SMTP_HOST="$(carry NUXT_SMTP_HOST)" NUXT_SMTP_PORT="$(carry NUXT_SMTP_PORT)" NUXT_SMTP_USER="$(carry NUXT_SMTP_USER)"
export NUXT_SMTP_PASS="$(carry NUXT_SMTP_PASS)" NUXT_SMTP_FROM="$(carry NUXT_SMTP_FROM)"
export YOUTUBE_API_KEY="$(carry YOUTUBE_API_KEY)" AZURE_STORAGE_CONNECTION_STRING="$(carry AZURE_STORAGE_CONNECTION_STRING)" AZURE_BLOB_CONTAINER="$(carry AZURE_BLOB_CONTAINER)"
export AZURE_STORAGE_ACCOUNT_NAME="" AZURE_STORAGE_ACCOUNT_KEY=""   # legacy static PV, unused

# fresh, URL-safe credentials for this environment
export DB_USER=gas_user
export DB_PASSWORD="$(openssl rand -hex 24)" MYSQL_ROOT_PASSWORD="$(openssl rand -hex 24)"
export JWT_SECRET="$(openssl rand -hex 32)" NUXT_API_SECRET="$(openssl rand -hex 32)"
export ANALYTICS_IP_SALT="$(openssl rand -hex 32)" REDIS_PASSWORD="$(openssl rand -hex 32)"
export NAMESPACE="$DST_NS"

tmpl="$root/templates/secrets.yaml"
vars="$(grep -oE '\$\{[A-Z_][A-Z0-9_]*\}' "$tmpl" | sort -u | tr '\n' ' ')"
envsubst "$vars" < "$tmpl" | kubectl --context "$DST_CTX" apply -f -

{
  echo "# Generated $(date -u +%FT%TZ) by scripts/make-production-secrets.sh for $DST_CTX/$DST_NS."
  echo "# Load into the GitHub 'production' environment (see k8s/README.md). Keep private."
  for v in DB_USER DB_PASSWORD MYSQL_ROOT_PASSWORD JWT_SECRET NUXT_API_SECRET ANALYTICS_IP_SALT REDIS_PASSWORD \
           ADMIN_EMAIL ADMIN_PASSWORD ADMIN_NAME NUXT_SMTP_HOST NUXT_SMTP_PORT NUXT_SMTP_USER NUXT_SMTP_PASS NUXT_SMTP_FROM \
           YOUTUBE_API_KEY AZURE_STORAGE_CONNECTION_STRING AZURE_BLOB_CONTAINER; do
    printf '%s=%s\n' "$v" "${!v}"
  done
} > "$ENVFILE"
echo "applied Secrets to $DST_CTX/$DST_NS; generated values saved to $ENVFILE (mode 600)"
