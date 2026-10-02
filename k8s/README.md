# Kubernetes deployment — Ghana Audit Service

Both environments run on the **`website`** AKS cluster (RG `website_group`,
francecentral) behind one ingress IP, **40.89.171.199**:

| Environment | Namespace        | Hostname            | Deployed by                                    |
| ----------- | ---------------- | ------------------- | ---------------------------------------------- |
| staging     | `gas-staging`    | test.audit.gov.gh   | `deploy.yml` on every push to `main`           |
| production  | `gas-production` | audit.gov.gh (+www) | `deploy-production.yml`, manual, by commit SHA |

Cluster-wide prerequisites (ingress-nginx, cert-manager, issuer, storage
classes, the reset-Job denial policy) live in [`cluster/`](cluster/README.md).

## Layout

```
k8s/
  base/                 shared manifests; every object carries deploy.audit.gov.gh/stage
  overlays/staging/     namespace, hostname, site URL, reset-Job allowance
  overlays/production/  namespace, hostname + www redirect, PDB, Retain storage,
                        Recreate for Redis, 30-day backups, sizing/ (TODO values)
  components/prelaunch/ TEMPORARY prelaunch.audit.gov.gh ingress for pre-cutover tests
  templates/            envsubst-only: secrets.yaml, migrate-job.yaml, seed-job.yaml,
                        reset-job.staging-only.yaml  (never inside a kustomize build)
  scripts/
    render.sh           kubectl kustomize + restricted envsubst for image tags; refuses
                        unlabelled objects
    deploy.sh           ordered apply by stage (config → secrets → policy → database →
                        cache → migrate → storage → app → backup); used by CI and by hand
    copy-secrets.sh     copy Secrets between deployments without printing values
    copy-data.sh        one-time DB + public-files copy between deployments
    make-production-secrets.sh  first-time production credentials
  cluster/              cluster-scoped bootstrap (see cluster/README.md)
  tools/                debug pods for the public-files PVC (manual)
  sql/                  one-off SQL (migration-ledger baseline)
  bootstrap-deploy-secrets.sh / check-deploy-secrets.sh   GitHub environment secrets helpers
```

Secrets are **never** part of a kustomize build. `scripts/deploy.sh` renders
`templates/secrets.yaml` from exported variables (`SECRETS_SOURCE=env`, what
CI does) or verifies they already exist (`SECRETS_SOURCE=existing`, manual
bootstraps and cluster-to-cluster copies).

## Deploying

### Staging (automatic)

Push to `main` → `ci.yml` quality gate → build `gas-frontend` and
`gas-migrate` images tagged with the commit SHA → `deploy-k8s.yml` with the
`staging` overlay. The image is built once with
`NUXT_PUBLIC_SITE_URL=https://audit.gov.gh`; staging overrides it at runtime
through its ConfigMap, so the same image is promoted to production unchanged.

### Production (manual, gated)

Actions → **Promote to production** → enter the full 40-character SHA that
staging already runs. The workflow checks the SHA is on `main`, carries the
production overlay and had a successful staging deploy, then waits for the
`production` environment's required reviewers before deploying. Rollback is
promoting an older SHA (migrations are forward-only; older code tolerates the
newer schema).

### By hand

```bash
export ACR_REGISTRY=regisry IMAGE_TAG=<commit sha>
# secrets already in the namespace:
SECRETS_SOURCE=existing k8s/scripts/deploy.sh staging website
# or render them from exported variables (same names as the GitHub secrets):
set -a; . k8s/.env.production; set +a
k8s/scripts/deploy.sh production website
```

`render.sh <overlay>` prints the rendered manifests for review;
`kubectl --context website diff -f -` against its output shows what a deploy
would change.

## GitHub configuration

Two GitHub Environments, each holding the same secret names (values differ):

| Secret                                                                                                         | Notes                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`                                                  | OIDC login; the app registration needs a federated credential per environment (`repo:judedanbo/gas:environment:<name>`) |
| `AKS_CLUSTER_NAME`, `AKS_RESOURCE_GROUP`                                                                       | `website` / `website_group` for both                                                                                    |
| `DB_USER`, `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD`                                                                | Must match what MySQL was initialised with                                                                              |
| `JWT_SECRET`, `NUXT_API_SECRET`, `ANALYTICS_IP_SALT`, `REDIS_PASSWORD`                                         | `openssl rand -hex 32`; `REDIS_PASSWORD` must be URL-safe                                                               |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`                                                                  | Seed Job only                                                                                                           |
| `NUXT_SMTP_HOST/PORT/USER/PASS/FROM`                                                                           | Transactional email                                                                                                     |
| `YOUTUBE_API_KEY`, `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_BLOB_CONTAINER`, `AZURE_STORAGE_ACCOUNT_NAME/KEY` | Optional                                                                                                                |

Azure RBAC for the `gas-github-deploy` identity: `AcrPush` on `regisry` and
`Azure Kubernetes Service RBAC Cluster Admin` (or Cluster User + in-cluster
RBAC) on the `website` cluster. Set required reviewers and a `main`-only
deployment branch policy on the `production` environment.

`bootstrap-deploy-secrets.sh <environment>` and `check-deploy-secrets.sh
<environment>` manage/verify the secret set.

## One-time runbooks

**First production credentials**

```bash
k8s/scripts/make-production-secrets.sh infosys gas website gas-production
# applies the Secrets, writes k8s/.env.production (git-ignored) — load those
# values into the GitHub `production` environment before the first CI deploy.
```

**Copy data between deployments** (destination stack must already be running)

```bash
k8s/scripts/copy-data.sh <src-ctx> <src-ns> <dst-ctx> <dst-ns> full         # staging move
k8s/scripts/copy-data.sh website gas-staging website gas-production production   # sanitised
```

`production` mode copies data only, excludes analytics/telemetry (raw client
IPs), sessions, audit log, rate-limit state, newsletter/contact submissions and
the Drizzle migration ledger, and clears invitation tokens and lockouts. User
accounts (with password hashes) ARE copied — review them before go-live.

**Seeding a fresh database** — `templates/seed-job.yaml` (idempotent) or the
_Seed Database_ workflow. Not needed when data was copied.

**DNS / TLS cutover** — see [`../docs/deployment/cutover.md`](../docs/deployment/cutover.md).

## Operations

```bash
kubectl --context website -n gas-production get pods,ingress,certificate
kubectl --context website -n gas-production logs deploy/gas-frontend --tail=100 -f
kubectl --context website -n gas-production rollout restart deployment/gas-frontend   # after a config-only change (no Reloader installed)
kubectl --context website -n gas-production create job --from=cronjob/mysql-backup manual-$(date +%s)
```

Backups: daily `mysqldump` at 02:00 UTC to the `mysql-backups` PVC (7 days
staging, 30 days production). They live on a disk in the same cluster — an
off-cluster copy is still an open item.

## Known limits

- The cluster is on the AKS Free tier, two `DS2_v2` nodes, no availability
  zones, no network policy engine (the NetworkPolicies are applied but not
  enforced). Revisit before relying on it for production traffic.
- ingress-nginx upstream is retired; a Gateway API migration is scheduled work.
- MySQL and Redis are single replicas; a node drain pauses them briefly.
- `overlays/production/sizing/*.yaml` still carry staging values (TODO).
