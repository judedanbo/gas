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
                        cache → migrate → storage → app → backup → geoip); used by CI and by hand
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

## Visitor geolocation — MaxMind GeoLite2

The admin **Analytics → Geo** page resolves each visit's country and network
(ASN) from MaxMind's free GeoLite2 databases. The licence forbids committing
them, so the cluster downloads them itself:

- `base/geoip/geoip-update-cronjob.yaml` runs the official `geoipupdate` image
  every Wednesday and Saturday (the day after MaxMind's Tuesday/Friday
  releases) and writes `GeoLite2-Country.mmdb` + `GeoLite2-ASN.mmdb` to
  `gas-geoip-pvc` (`base/storage/geoip-pvc.yaml`, Azure Files, RWX).
- The frontend mounts that volume read-only at `/app/data/geoip`
  (`ANALYTICS_GEOIP_DB_PATH` / `ANALYTICS_ASN_DB_PATH` in
  `base/config/configmap.yaml`) and re-checks the files every 15 minutes.
- Lookups also need the real visitor IP, which is why the ingress controller
  runs with `externalTrafficPolicy: Local` (`cluster/ingress-nginx`);
  `scripts/deploy.sh` warns if that ever changes.

Setup: create a free GeoLite2 account at <https://www.maxmind.com/en/geolite2/signup>,
generate a licence key, set `MAXMIND_ACCOUNT_ID` / `MAXMIND_LICENSE_KEY` on
each GitHub environment (or export them for a manual deploy). `deploy.sh`
renders them into the `gas-maxmind` Secret (read only by the CronJob, never by
the frontend), applies the CronJob, and until one run has succeeded starts an
immediate download. Without them it skips the CronJob with a warning and every
visit shows as "Unknown" country.

```bash
kubectl --context website -n gas-production get jobs -l app.kubernetes.io/name=geoip-update
kubectl --context website -n gas-production logs deploy/gas-frontend | grep analytics/geoip
kubectl --context website -n gas-production create job geoip-manual-$(date +%s) --from=cronjob/geoip-update
```

## Frontend probes

A-G report PDF optimization (Ghostscript, qpdf, pdftoppm, Tesseract) runs
**inside the frontend pod**: its child processes share the container's CPU
quota and memory limit with the Nitro server. Anything that restarts or kills
the container also cuts short every in-flight upload pipeline and
optimization: uploads whose PDF already reached storage redo their remaining
steps, ones still being stored must be uploaded again, and explicit
optimizations have to be run again. The probes are built so that load never
causes a restart:

| Probe     | Path       | Checks                                                       | On failure                                           |
| --------- | ---------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| startup   | `/healthz` | Nitro is listening and its event loop answers                | restarted if not up within 60s                       |
| liveness  | `/healthz` | the event loop answers — no SSR, database or Redis           | restarted after 5 failures 30s apart                 |
| readiness | `/readyz`  | the above, plus this pod's MySQL pool answers `SELECT 1` ≤2s | removed from the Service until it passes; no restart |

The probes used to hit `/`. That is a full SSR render plus several MySQL
queries on every request: the `isr` route rules do not cache HTML on the
`node-server` preset. While an optimization saturates the CPU quota, that
render can stretch past the 5s probe timeout. `/healthz` does no I/O, so a database or Redis outage can
never restart pods. `/readyz` does depend on MySQL, so a rollout whose new
pods cannot reach the database stalls (and `kubectl rollout status` fails the
deploy) instead of replacing healthy pods. The trade-off: during a MySQL outage
every pod goes unready, and the ingress answers 503 until MySQL is back.

Both endpoints skip the app's rate limiter and analytics capture, answer
`Cache-Control: no-store`, and are safe to hit from outside the cluster (the
`/readyz` database check is shared across concurrent requests and cached for
1s). The code lives in `ghana-audit-service/server/utils/healthProbes.ts`.

```bash
# What the kubelet sees, from inside a frontend pod
kubectl exec -n gas-production deploy/gas-frontend -- wget -qO- http://localhost:3000/healthz
kubectl exec -n gas-production deploy/gas-frontend -- wget -qO- http://localhost:3000/readyz

# Restart history and the reason for the last one (OOMKilled vs. probe failure)
kubectl get pods -n gas-production -l app.kubernetes.io/name=gas-frontend
kubectl describe pod -n gas-production -l app.kubernetes.io/name=gas-frontend | grep -A6 "Last State"
kubectl get events -n gas-production --field-selector reason=Unhealthy
```

## Frontend resources and PDF optimization

The frontend container is sized for one optimization at a time:

| Setting                                                | Value                                      |
| ------------------------------------------------------ | ------------------------------------------ |
| `resources.requests` (`base/frontend/deployment.yaml`) | `cpu: 250m`, `memory: 512Mi`               |
| `resources.limits`                                     | `cpu: "2"`, `memory: 1Gi`                  |
| `PDF_OPTIMIZATION_MAX_CONCURRENT` (`gas-config`)       | `1` per pod; further jobs queue FIFO       |
| HPA scale-down (`base/frontend/hpa.yaml`)              | after 30 min below target, ≤1 pod / 10 min |

These come from running the built app under cgroup limits equal to the pod's,
with two 60 MB / 40-page 300-DPI scans optimized through the admin API (MySQL
seeded, Tesseract with `OMP_THREAD_LIMIT=1`):

| Limits / concurrency     | Both scans done | `/healthz` max | `/` max | Peak anon RSS  | CPU throttled  |
| ------------------------ | --------------- | -------------- | ------- | -------------- | -------------- |
| 500m / 512Mi, 2 at once  | 509s            | 1.0s           | 2.8s    | 490 / 512 MiB  | 99% of periods |
| 2 CPU / 1Gi, 1 at a time | 118s            | 31ms           | 213ms   | 326 / 1024 MiB | 33%            |
| 1 CPU / 1Gi, 1 at a time | 234s            | 82ms           | 592ms   | 353 / 1024 MiB | 97%            |

The server idles at ~200 MiB. One optimization keeps ~2 cores busy while it
OCRs (two Tesseract processes), so a second concurrent run under the same CPU
limit finishes nothing sooner and only adds memory. An OOM kill is the worst
outcome: on cgroup v2 (AKS, Kubernetes ≥ 1.28) it kills the whole container,
and with it every in-flight upload and optimization. Raise
`PDF_OPTIMIZATION_MAX_CONCURRENT` only together with the pod's CPU and memory,
never on its own.

**Autoscaling caveat.** The HPA scales on CPU at 70% of the 250m request, and
an optimization pins its pod near the 2-CPU limit, so every optimization
scales the Deployment out to `maxReplicas`. Scaling back in terminates pods.
On SIGTERM a pod gives its in-flight uploads a 20s grace period, then hands
them off: uploads already in storage resume on another pod, which redoes their
remaining steps, and ones not yet stored fail at once asking for a re-upload
(see `terminationGracePeriodSeconds` in `base/frontend/deployment.yaml`). Its
explicit optimizations are reported as interrupted for the admin to run
again. So minutes of optimization can be lost, and an upload still being
stored has to be sent again. Hence the slow scale-down: it makes cutting a
pod's work short much rarer, but cannot rule it out. Rollouts
(`kubectl rollout restart`, deploys) also terminate pods, so prefer deploying
while no large uploads are being processed.

```bash
# Live usage per pod (needs metrics-server) and HPA state
kubectl top pods -n gas-production -l app.kubernetes.io/name=gas-frontend
kubectl get hpa gas-frontend -n gas-production
```

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
