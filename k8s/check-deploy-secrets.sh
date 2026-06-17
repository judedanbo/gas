#!/usr/bin/env bash
#
# check-deploy-secrets.sh — gap-check the GitHub secrets the AKS deploy workflow
# needs against what's actually defined.
#
# The required list is derived from `.github/workflows/deploy.yml` itself (every
# `secrets.*` reference) so it can't drift from the workflow. A secret counts as
# present if it exists in EITHER the target environment OR the repository —
# an `environment:`-scoped job can read both.
#
# Usage:   k8s/check-deploy-secrets.sh [environment]   # default: production
# Exit:    0 if all REQUIRED secrets present, 1 otherwise.
#
# Caveat: org-level secrets shared with the repo may not appear in `gh secret
# list` and could show as MISSING here even though they resolve at runtime.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

ENV_NAME="${1:-production}"
WORKFLOW=".github/workflows/deploy.yml"

# Intentionally optional — the app degrades gracefully if these are unset:
#   AZURE_STORAGE_* / AZURE_BLOB_CONTAINER -> PDF Blob backend falls back to disk
#   ADMIN_*                                -> only consumed by the manual seed Job
#   REDIS_PASSWORD                         -> Redis runs without auth (recommended
#                                             to set it; see k8s/README.md)
OPTIONAL="AZURE_STORAGE_ACCOUNT_NAME AZURE_STORAGE_ACCOUNT_KEY \
AZURE_STORAGE_CONNECTION_STRING AZURE_BLOB_CONTAINER \
ADMIN_EMAIL ADMIN_PASSWORD ADMIN_NAME REDIS_PASSWORD"

if [ ! -f "$WORKFLOW" ]; then
  echo "error: $WORKFLOW not found (run from anywhere inside the repo)" >&2
  exit 2
fi

# Required = every secrets.* the workflow references, minus the optional set and
# the auto-provided GITHUB_TOKEN.
mapfile -t REFERENCED < <(grep -oE 'secrets\.[A-Z_]+' "$WORKFLOW" \
  | sed 's/secrets\.//' | sort -u)

# Existing secret names: union of the environment and the repo (empty if the
# environment doesn't exist yet or gh can't read it).
env_secrets="$(gh secret list --env "$ENV_NAME" --json name -q '.[].name' 2>/dev/null || true)"
repo_secrets="$(gh secret list --json name -q '.[].name' 2>/dev/null || true)"
existing="$(printf '%s\n%s\n' "$env_secrets" "$repo_secrets" | sed '/^$/d' | sort -u)"

is_optional() { case " $OPTIONAL " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }
has()         { printf '%s\n' "$existing"    | grep -qxF "$1"; }
in_env()      { printf '%s\n' "$env_secrets" | grep -qxF "$1"; }

missing_required=0
missing_optional=0

printf '%-34s %-9s %s\n' "SECRET" "STATUS" "SCOPE / NOTE"
printf '%-34s %-9s %s\n' "----------------------------------" "--------" "------------"
for s in "${REFERENCED[@]}"; do
  [ "$s" = "GITHUB_TOKEN" ] && continue
  if has "$s"; then
    if in_env "$s"; then scope="$ENV_NAME"; else scope="repo"; fi
    printf '%-34s %-9s %s\n' "$s" "OK" "$scope"
  elif is_optional "$s"; then
    printf '%-34s %-9s %s\n' "$s" "missing" "optional — graceful fallback"
    missing_optional=$((missing_optional + 1))
  else
    printf '%-34s %-9s %s\n' "$s" "MISSING" "REQUIRED — deploy will fail"
    missing_required=$((missing_required + 1))
  fi
done

echo
echo "Missing required: $missing_required   |   Missing optional: $missing_optional"
if [ "$missing_required" -ne 0 ]; then
  echo "FAIL: required secrets absent in both the '$ENV_NAME' environment and the repo." >&2
  echo "Set one with:  gh secret set <NAME> --env $ENV_NAME" >&2
  exit 1
fi
echo "OK: all required secrets present."
