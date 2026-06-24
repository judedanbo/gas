# Kubernetes Deployment — Ghana Audit Service

Production deployment on Azure AKS.

## Cluster Prerequisites

Before deploying the application, install these cluster-wide components once:

### 1. NGINX Ingress Controller

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.replicaCount=2
```

### 2. cert-manager

```bash
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set crds.enabled=true
```

### 3. Azure Container Registry

Create an ACR and attach it to the AKS cluster:

```bash
az acr create --name regisry --resource-group <RG> --sku Basic
az aks update --name <CLUSTER> --resource-group <RG> --attach-acr regisry
```

### 4. Reloader (optional — config auto-reload)

The frontend Deployment carries the `reloader.stakater.com/auto: "true"`
annotation so that a change to `gas-config` or `gas-secrets` automatically
rolls the pods. Without the [Reloader](https://github.com/stakater/Reloader)
controller installed, the annotation is a harmless no-op and you must
`kubectl rollout restart deployment/gas-frontend -n gas` by hand after a
config-only change (e.g. updating `NUXT_SMTP_FROM`). To enable auto-reload:

```bash
helm repo add stakater https://stakater.github.io/stakater-charts
helm install reloader stakater/reloader --namespace kube-system
```

## GitHub Secrets

Configure these as **environment** secrets on the `production` environment
(Settings > Environments > production > Secrets), **not** repository-level
secrets. Both the `build-and-push` and `deploy` jobs declare
`environment: production`, so an environment-scoped secret that the build job
cannot see will make `azure/login` fail with empty credentials.

| Secret                            | Description                                                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `AZURE_CLIENT_ID`                 | App registration Application (client) ID — used for OIDC login                                                          |
| `AZURE_TENANT_ID`                 | Microsoft Entra Directory (tenant) ID                                                                                   |
| `AZURE_SUBSCRIPTION_ID`           | Azure subscription ID (`az account show --query id -o tsv`)                                                             |
| `AKS_CLUSTER_NAME`                | AKS cluster name                                                                                                        |
| `AKS_RESOURCE_GROUP`              | Azure resource group                                                                                                    |
| `DB_USER`                         | MySQL user (e.g., `gas_user`)                                                                                           |
| `DB_PASSWORD`                     | MySQL user password                                                                                                     |
| `MYSQL_ROOT_PASSWORD`             | MySQL root password                                                                                                     |
| `JWT_SECRET`                      | JWT signing secret (generate with `openssl rand -hex 32`)                                                               |
| `NUXT_API_SECRET`                 | Nuxt API secret (generate with `openssl rand -hex 32`)                                                                  |
| `ANALYTICS_IP_SALT`               | Analytics IP hashing salt (generate with `openssl rand -hex 32`)                                                        |
| `REDIS_PASSWORD`                  | Redis `--requirepass` password (generate with `openssl rand -hex 32`). Unset ⇒ Redis runs **without** auth             |
| `AZURE_STORAGE_ACCOUNT_NAME`      | Azure Storage account name backing the gas-public file share                                                            |
| `AZURE_STORAGE_ACCOUNT_KEY`       | Azure Storage account access key for the gas-public file share                                                          |
| `ADMIN_EMAIL`                     | Initial admin login email — consumed by the seed Job                                                                    |
| `ADMIN_PASSWORD`                  | Initial admin login password — consumed by the seed Job                                                                 |
| `ADMIN_NAME`                      | Initial admin display name (optional; defaults to `Administrator`)                                                      |
| `AZURE_STORAGE_CONNECTION_STRING` | Optional — Blob backend for report PDFs (see [Report PDFs](#report-pdfs--azure-blob-storage)); unset = on-disk fallback |
| `AZURE_BLOB_CONTAINER`            | Optional — Blob container for report PDFs (e.g. `reports`)                                                              |

> `ACR_NAME` is **not** a secret — it is a workflow `env:` value in `deploy.yml`.

### Deploy approval gate (recommended)

The `build-and-push` and `deploy` jobs run in the `production` GitHub Environment. To require
manual sign-off before a production deploy, add reviewer(s) under **Settings → Environments →
production → Required reviewers**. With that enabled, a push to `main` builds/scans the image
and then **pauses for approval** before applying to the cluster. CI security scanning runs
regardless (npm audit + Trivy in the workflows, CodeQL in `codeql.yml`); CodeQL on a private
repo additionally requires GitHub Advanced Security to be enabled.

### Redis TLS

Redis is encrypted in-cluster (in addition to `--requirepass` auth). `k8s/redis/tls.yaml`
defines cert-manager resources — a self-signed CA chain (`gas-selfsigned` → `redis-ca` →
`gas-ca-issuer`) that issues the `redis-server-tls` Certificate into the **`redis-tls`** secret
(server keypair + CA). The Redis pod serves TLS-only on 6379 from that secret; the frontend
connects via `rediss://` (in `gas-secrets` `REDIS_URL`) and verifies the server against the CA
mounted from `redis-tls` (`REDIS_CA_FILE=/tls/redis-ca.crt`).

`deploy.yml` applies `tls.yaml` and waits for the certificate **before** rolling out Redis. The
frontend's CA mount is `optional`, the client never throws on a missing CA, and any TLS/connect
failure degrades to the in-process rate-limit fallback — so a misconfigured cert does **not**
take the site down (only shared rate-limit state degrades to per-instance). To keep encryption
but bypass a bad cert chain as a stopgap, set `REDIS_TLS_REJECT_UNAUTHORIZED=false`. Requires
cert-manager (Prerequisite 2). Local docker-compose stays plain `redis://`.

### Azure authentication (OIDC federated)

The workflow logs in with `azure/login` using **OIDC federated credentials**
(no long-lived secret). The app registration referenced by `AZURE_CLIENT_ID`
needs a federated credential authorizing this repo's `production` environment,
plus RBAC to push images and deploy:

```bash
# Federated credential — lets GitHub Actions exchange its OIDC token for an
# Azure token when running in the `production` environment.
az ad app federated-credential create --id <AZURE_CLIENT_ID> --parameters '{
  "name": "gh-gas-production",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:judedanbo/gas:environment:production",
  "audiences": ["api://AzureADTokenExchange"]
}'

# RBAC for the service principal behind the app registration:
SP_ID=$(az ad sp show --id <AZURE_CLIENT_ID> --query id -o tsv)
az role assignment create --assignee-object-id "$SP_ID" \
  --assignee-principal-type ServicePrincipal \
  --role AcrPush --scope <ACR_RESOURCE_ID>            # push images
az role assignment create --assignee-object-id "$SP_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Azure Kubernetes Service Cluster User Role" --scope <AKS_RESOURCE_ID>
```

The deploy job also needs Kubernetes RBAC inside the cluster to apply manifests
(e.g. bind the identity to a suitable ClusterRole), or use a cluster-admin
credential via `az aks get-credentials --admin` in a trusted runner.

### Setting the secrets (step by step)

All secrets above must live on the **`production`** environment, because both
the `build-and-push` and `deploy` jobs run with `environment: production`.

1. **Create the `production` environment** (skip if it already exists):
   - UI: repo **Settings → Environments → New environment**, name it `production`.
   - or CLI: `gh api -X PUT repos/judedanbo/gas/environments/production`

2. **Gather the values:**
   - `AZURE_CLIENT_ID` — the OIDC app registration's Application (client) ID.
   - `AZURE_TENANT_ID` — `az account show --query tenantId -o tsv`.
   - `AZURE_SUBSCRIPTION_ID` — `az account show --query id -o tsv`.
   - `ACR_NAME`, `AKS_CLUSTER_NAME`, `AKS_RESOURCE_GROUP` — your Azure resource names.
   - `DB_USER`, `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD` — chosen MySQL credentials.
   - `JWT_SECRET`, `NUXT_API_SECRET`, `ANALYTICS_IP_SALT` — generate each with `openssl rand -hex 32`.
   - `AZURE_STORAGE_ACCOUNT_NAME` — your storage account name (see [Persistent storage](#persistent-storage-for-public-files)).
   - `AZURE_STORAGE_ACCOUNT_KEY` — `az storage account keys list --account-name <acct> --query '[0].value' -o tsv`.

3. **Set each secret** on the `production` environment. Via the UI:
   **Settings → Environments → production → Add secret** (one per row in the table above).
   Or via the `gh` CLI (omitting `--body` makes `gh` prompt, keeping the value out of shell history — preferred for sensitive values):

   ```bash
   ENV=production

   # Azure auth (OIDC)
   gh secret set AZURE_CLIENT_ID       --env $ENV   # paste the app (client) ID
   gh secret set AZURE_TENANT_ID       --env $ENV --body "$(az account show --query tenantId -o tsv)"
   gh secret set AZURE_SUBSCRIPTION_ID --env $ENV --body "$(az account show --query id -o tsv)"

   # ACR / AKS
   gh secret set ACR_NAME              --env $ENV --body "regisry"
   gh secret set AKS_CLUSTER_NAME      --env $ENV   # paste cluster name
   gh secret set AKS_RESOURCE_GROUP    --env $ENV   # paste resource group

   # Database
   gh secret set DB_USER               --env $ENV --body "gas_user"
   gh secret set DB_PASSWORD           --env $ENV   # paste DB password
   gh secret set MYSQL_ROOT_PASSWORD   --env $ENV   # paste root password

   # App secrets (generate fresh)
   gh secret set JWT_SECRET            --env $ENV --body "$(openssl rand -hex 32)"
   gh secret set NUXT_API_SECRET       --env $ENV --body "$(openssl rand -hex 32)"
   gh secret set ANALYTICS_IP_SALT     --env $ENV --body "$(openssl rand -hex 32)"
   gh secret set REDIS_PASSWORD        --env $ENV --body "$(openssl rand -hex 32)"

   # Azure Files (persistent storage)
   gh secret set AZURE_STORAGE_ACCOUNT_NAME --env $ENV   # paste storage account name
   gh secret set AZURE_STORAGE_ACCOUNT_KEY  --env $ENV --body "$(az storage account keys list --account-name <acct> --query '[0].value' -o tsv)"
   ```

4. **Verify** all required secrets are present (or run `k8s/check-deploy-secrets.sh`):

   ```bash
   gh secret list --env production
   ```

5. Don't forget the [federated credential](#azure-authentication-oidc-federated) — the secrets alone are not enough for OIDC login.

## Pre-Deploy Checklist

Run through this before the first automated deploy (push to `main`) or a manual
deploy to a cluster. Applies to the **staging** target (`test.audit.gov.gh`);
production (`audit.gov.gh`) will be a separate deployment.

1. **Migration ledger (most common failure).** The migrate Job runs file-based
   Drizzle migrations (`db:apply`), which read the `__drizzle_migrations` ledger.
   The history is squashed to `0000_init_squash`, and a schema created with
   `drizzle-kit push` leaves that ledger empty — so the Job would try to
   `CREATE TABLE` over existing tables and fail. Diagnose:

   ```bash
   kubectl exec -n gas mysql-0 -- sh -c \
     'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SHOW TABLES IN ghana_audit_service; SELECT hash FROM ghana_audit_service.__drizzle_migrations"'
   ```

   - No tables yet → do nothing; the Job creates the schema on first run.
   - Tables exist **and** the ledger has a row → no action.
   - Tables exist but ledger empty/missing → run the one-time baseline first
     (idempotent; precondition: schema already matches the current Drizzle
     schema — confirm `drizzle-kit push` reports no changes):

     ```bash
     kubectl exec -i -n gas mysql-0 -- sh -c \
       'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" ghana_audit_service' \
       < k8s/jobs/baseline-prod-drizzle-migrations.sql
     ```

2. **GitHub `production` environment secrets exist.** All keys in the
   [GitHub Secrets](#github-secrets) table must be set. Unset secrets render
   empty via `envsubst`; in particular empty `ADMIN_EMAIL`/`ADMIN_PASSWORD`/
   `ADMIN_NAME` make the seed Job exit 1.

3. **Public-files PVC storage class.** The frontend mounts `gas-public-files-pvc`
   (`storage/prod-pvc.yaml`, `storageClassName: my-blobstorage`).
   `storageClassName` is immutable — if the PVC already exists with a different
   class, `kubectl apply` is rejected; delete and recreate it to switch.

4. **Cluster has the assumed dependencies:** the `infosys-issuer` ClusterIssuer
   (referenced by the ingress, managed outside this repo), the `ingress-nginx`
   controller + namespace, the `managed-csi` and `my-blobstorage` storage
   classes, and metrics-server (for the frontend HPA).

## Manual Deploy

If you need to deploy manually (not via GitHub Actions):

```bash
# 1. Get cluster credentials
az aks get-credentials --name <CLUSTER> --resource-group <RG>

# 2. Apply namespace and config
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/config/configmap.yaml

# 3. Apply secrets (set env vars first)
export DB_USER=gas_user DB_PASSWORD=... JWT_SECRET=... NUXT_API_SECRET=... ANALYTICS_IP_SALT=... REDIS_PASSWORD=... MYSQL_ROOT_PASSWORD=... AZURE_STORAGE_ACCOUNT_NAME=... AZURE_STORAGE_ACCOUNT_KEY=...
envsubst < k8s/config/secrets.yaml | kubectl apply -f -

# 4. Apply infrastructure
#    (TLS: the ingress uses the pre-existing `infosys-issuer` ClusterIssuer,
#     managed outside this repo — nothing to apply here.)
kubectl apply -f k8s/mysql/
kubectl rollout status statefulset/mysql -n gas --timeout=120s
kubectl apply -f k8s/redis/

# 5. Run migration
export ACR_REGISTRY=<ACR_NAME>   # e.g. regisry — must match where you pushed the image
export IMAGE_TAG=<TAG>           # the tag you pushed, e.g. the commit SHA
export JOB_SUFFIX=$(date +%s)
envsubst < k8s/jobs/migrate-job.yaml | kubectl apply -f -
kubectl wait --for=condition=complete job/gas-migrate-${JOB_SUFFIX} -n gas --timeout=120s

# 5b. (One-time bootstrap) Seed the admin user + content. Idempotent — re-running
#     skips existing rows. Requires ADMIN_EMAIL/ADMIN_PASSWORD in gas-secrets and a
#     migrator image rebuilt with the seed scripts. See k8s/jobs/seed-job.yaml header.
envsubst < k8s/jobs/seed-job.yaml | kubectl apply -f -
kubectl wait --for=condition=complete job/gas-seed-job -n gas --timeout=300s

# 6. Apply persistent storage (dynamically-provisioned blob PVC)
kubectl apply -f k8s/storage/prod-pvc.yaml
kubectl wait --for=jsonpath='{.status.phase}'=Bound pvc/gas-public-files-pvc -n gas --timeout=60s

# 7. Deploy frontend (pin image via envsubst — restricted so the seed-public
#    initContainer's busybox script ($d/$f) is left untouched)
export ACR_REGISTRY=<ACR_NAME>   # e.g. regisry
export IMAGE_TAG=<TAG>           # the tag you pushed, e.g. the commit SHA
envsubst '${ACR_REGISTRY} ${IMAGE_TAG}' < k8s/frontend/deployment.yaml | kubectl apply -f -
kubectl apply -f k8s/frontend/service.yaml
kubectl apply -f k8s/frontend/ingress.yaml
kubectl apply -f k8s/frontend/hpa.yaml

# 8. Apply policies and backup
kubectl apply -f k8s/network/network-policies.yaml
kubectl apply -f k8s/jobs/mysql-backup-cronjob.yaml

# 9. Verify
kubectl rollout status deployment/gas-frontend -n gas
kubectl get pods -n gas
```

## Useful Commands

```bash
# View all resources
kubectl get all -n gas

# View pod logs
kubectl logs -n gas deployment/gas-frontend --tail=100 -f

# View MySQL logs
kubectl logs -n gas statefulset/mysql --tail=100

# Check backup history
kubectl get jobs -n gas -l app.kubernetes.io/name=mysql-backup

# Manual backup trigger
kubectl create job --from=cronjob/mysql-backup manual-backup-$(date +%s) -n gas

# Scale frontend
kubectl scale deployment gas-frontend -n gas --replicas=3

# Restart frontend (rolling restart)
kubectl rollout restart deployment/gas-frontend -n gas
```

## Directory Structure

```
k8s/
  namespace.yaml              # Namespace with Pod Security Standards
  config/
    configmap.yaml            # Non-sensitive environment variables
    secrets.yaml              # Template — real values injected by CI
  frontend/
    deployment.yaml           # Nuxt app (2 replicas, HPA, probes)
    service.yaml              # ClusterIP Service (port 80 -> 3000)
    ingress.yaml              # NGINX Ingress with TLS
    hpa.yaml                  # Autoscaler (2-5 replicas, 70% CPU)
  mysql/
    statefulset.yaml          # MySQL 8.0 with 20Gi PVC
    service.yaml              # Headless Service
  redis/
    deployment.yaml           # Redis 7 with 1Gi PVC
    service.yaml              # ClusterIP Service
  jobs/
    migrate-job.yaml          # DB migration (runs before each deploy)
    seed-job.yaml             # One-time DB seed: admin user + content (manual)
    mysql-backup-cronjob.yaml # Daily mysqldump (02:00 UTC, 7-day retention)
  network/
    network-policies.yaml     # Default-deny + per-service allow rules
  storage/
    prod-pvc.yaml             # Active: dynamic ReadWriteMany PVC (gas-public-files-pvc)
    public-files.yaml         # Legacy: static PV/PVC for Azure Files (gas-public share)
```

## Persistent storage for public files

`public/{img,images,uploads,pdf}` are backed by a single ReadWriteMany volume
mounted by the frontend Deployment (`claimName: gas-public-files-pvc`).

The **active** deploy path uses `k8s/storage/prod-pvc.yaml` — a dynamically
provisioned PVC (storageClassName `my-blobstorage`, 50Gi) that the cluster
binds automatically; no manual share provisioning is required.

The static Azure Files approach below (`k8s/storage/public-files.yaml`,
`gas-public-pvc`) is the **legacy** alternative, retained for reference. It
requires provisioning the share before the first deploy:

```bash
# 1. Storage account (Standard, LRS) — reuse an existing one if you have it.
az storage account create \
  --name <storageaccount> \
  --resource-group <rg> \
  --sku Standard_LRS \
  --kind StorageV2

# 2. File share (quota in GiB; must be >= the PV capacity, 50Gi).
az storage share-rm create \
  --resource-group <rg> \
  --storage-account <storageaccount> \
  --name gas-public \
  --quota 50

# 3. Account key -> set as GitHub Actions secrets used by deploy.yml:
#    AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY
az storage account keys list \
  --resource-group <rg> \
  --account-name <storageaccount> \
  --query '[0].value' -o tsv
```

The Deployment's `seed-public` initContainer copies baked `img`/`images`/
`uploads` assets into the share on first run (no-clobber), so committed
static files survive the overlay and runtime uploads are never overwritten
(`pdf` is mounted but not seeded — it is runtime-write-only).
Reclaim policy is `Retain`: deleting the PVC/PV leaves the share intact.

> **Report PDFs are migrating off this Files share to Blob Storage** — see the
> next section. Once cut over, the two `pdf` volumeMounts in
> `frontend/deployment.yaml` can be removed.

## Report PDFs — Azure Blob Storage

Report PDFs (`audit_reports.fileUrl`) are stored in a private Azure **Blob**
container rather than baked into the container image (~2.6 GB raw, ~7.5 GB after
Nitro pre-compression) or kept on the gas-public **Files** share. The app uploads
to and streams from Blob through the existing `/api/downloads/**` indirection, so
no client-facing URLs change.

**This is feature-flagged by env vars** (see `server/utils/blobStorage.ts`):

- **Both unset** → the app falls back to on-disk `public/pdf` (the Files mount).
  This is the current/default behaviour, so deploying the code is a no-op until
  the vars are set.
- **Both set** → uploads write to Blob and downloads stream from Blob, falling
  back to disk per-file for anything not yet migrated.

### One-time cutover

```bash
# 1. Create a private container in a storage account (may reuse gas-public's).
az storage container create \
  --account-name <storageaccount> \
  --name reports \
  --auth-mode login

# 2. Build the connection string and set it as GitHub Actions secrets:
#    AZURE_STORAGE_CONNECTION_STRING, AZURE_BLOB_CONTAINER=reports
az storage account show-connection-string \
  --resource-group <rg> \
  --name <storageaccount> \
  --query connectionString -o tsv

# 3. Wire both into gas-secrets (config/secrets.yaml -> envFrom on the frontend
#    Deployment), then redeploy so the app picks up the env vars.

# 4. Upload the existing PDFs (idempotent — skips blobs already present).
#    Run from ghana-audit-service/ with the same env vars exported, or as a
#    one-off Job built on the migrator image:
npm run pdf:migrate-blob

# 5. Verify a few downloads stream from Blob:
#    GET /api/downloads/reports/<id>           (attachment)
#    GET /api/downloads/reports/<id>?view=1    (inline)

# 6. Drop the baked PDFs from the image: `git rm -r ghana-audit-service/public/pdf`
#    and add `public/pdf/` to ghana-audit-service/.dockerignore. Remove the two
#    `pdf` volumeMounts from frontend/deployment.yaml. Rebuild — image content
#    drops to ~1 GB.
```

> Do **not** do step 6 before steps 1–5 verify in production: until the blobs
> exist and the env vars are set, the on-disk `public/pdf` (image or Files mount)
> is the only source, and removing it would 404 every report download.
