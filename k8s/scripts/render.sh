#!/usr/bin/env bash
# Render an overlay to stdout with the image placeholders substituted, and
# refuse anything unsafe for a staged apply.
#   usage: ACR_REGISTRY=regisry IMAGE_TAG=<sha> scripts/render.sh <overlay>
set -euo pipefail
overlay="${1:?usage: render.sh <overlay>}"
: "${ACR_REGISTRY:?set ACR_REGISTRY (ACR name, e.g. regisry)}"
: "${IMAGE_TAG:?set IMAGE_TAG (image tag, normally the commit SHA)}"
root="$(cd "$(dirname "$0")/.." && pwd)"

# Restricted envsubst: ONLY these two names are substituted, so the shell
# variables inside the backup CronJob and the seed-public init script, and the
# $(REDIS_PASSWORD) Kubernetes expansion, pass through untouched.
out="$(kubectl kustomize "$root/overlays/$overlay" | envsubst '${ACR_REGISTRY} ${IMAGE_TAG}')"

if grep -qE '\$\{(ACR_REGISTRY|IMAGE_TAG)\}' <<<"$out"; then
  echo "render.sh: unsubstituted image placeholder in output" >&2
  exit 1
fi
objects="$(grep -cE '^kind: ' <<<"$out")"
labelled="$(grep -cE '^    deploy\.audit\.gov\.gh/stage: ' <<<"$out")"
if [ "$objects" != "$labelled" ]; then
  echo "render.sh: $objects objects but $labelled stage labels — an unlabelled object would never be applied" >&2
  exit 1
fi
printf '%s\n' "$out"
