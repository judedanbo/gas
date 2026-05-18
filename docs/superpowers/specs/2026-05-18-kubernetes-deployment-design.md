# Kubernetes Deployment Design

**Date:** 2026-05-18
**Status:** Approved
**Scope:** Production K8s deployment for the Ghana Audit Service website on Azure AKS

## Decision Summary

| Decision | Choice |
|----------|--------|
| Cloud provider | Azure (AKS) |
| Database hosting | MySQL in-cluster (StatefulSet) |
| Manifest tooling | Raw YAML manifests |
| CI/CD | GitHub Actions |
| Environments | Production only (single `gas` namespace) |
| TLS | NGINX Ingress + cert-manager (Let's Encrypt) |
| Architecture | Flat manifests, single namespace (Approach A) |

## Directory Layout

```
k8s/
  namespace.yaml
  frontend/
    deployment.yaml
    service.yaml
    ingress.yaml
    hpa.yaml
  mysql/
    statefulset.yaml
    service.yaml
  redis/
    deployment.yaml
    service.yaml
  jobs/
    migrate-job.yaml
    mysql-backup-cronjob.yaml
  config/
    configmap.yaml
    secrets.yaml
  tls/
    cluster-issuer.yaml
  network/
    network-policies.yaml
```

All resources live in the `gas` namespace.

## Network Topology

```
                        +----------------------------------+
  Internet              |          AKS Cluster             |
     |                  |                                  |
     v                  |   +-----------+                  |
  NGINX Ingress --------+-> | frontend  | (port 3000)      |
  (TLS termination)     |   | Deployment|                  |
                        |   +-----+--+--+                  |
                        |         |  |                     |
                        |         v  v                     |
                        |   +--------+  +--------+         |
                        |   | mysql  |  | redis  |         |
                        |   | SS     |  | Deploy |         |
                        |   | :3306  |  | :6379  |         |
                        |   +--------+  +--------+         |
                        +----------------------------------+
```

Traffic flow:
- Internet -> NGINX Ingress (TLS) -> frontend Service -> frontend Pods
- frontend Pods -> mysql Service (ClusterIP, headless) -> mysql-0 Pod
- frontend Pods -> redis Service (ClusterIP) -> redis Pod
- No direct internet access to MySQL or Redis

## Component Specifications

### 1. Frontend Deployment

| Property | Value |
|----------|-------|
| Kind | Deployment |
| Replicas | 2 (min via HPA) |
| Image | `gasacr.azurecr.io/gas-frontend:<git-sha>` |
| Port | 3000 |
| CPU requests/limits | 100m / 500m |
| Memory requests/limits | 256Mi / 512Mi |
| Update strategy | RollingUpdate, maxUnavailable=0, maxSurge=1 |

**Probes:**
- Startup: HTTP GET `/` port 3000, failureThreshold=30, periodSeconds=2 (allows up to 60s startup)
- Readiness: HTTP GET `/` port 3000, periodSeconds=10, failureThreshold=3
- Liveness: HTTP GET `/` port 3000, periodSeconds=30, failureThreshold=5

**HPA:**
- Min replicas: 2
- Max replicas: 5
- Target CPU utilization: 70%

**Environment:**
- Non-sensitive values from ConfigMap `gas-config`
- Sensitive values from Secret `gas-secrets`

### 2. MySQL StatefulSet

| Property | Value |
|----------|-------|
| Kind | StatefulSet |
| Replicas | 1 |
| Image | `mysql:8.0` |
| Port | 3306 |
| CPU requests/limits | 250m / 1000m |
| Memory requests/limits | 512Mi / 1Gi |
| Storage | 20Gi PVC (Azure Managed Disk, `managed-csi` StorageClass) |

**Service:** Headless (`clusterIP: None`), name `mysql`.

**Command args:** `--character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci --default-authentication-plugin=mysql_native_password`

**Probes:**
- Readiness: exec `mysqladmin ping -h localhost`, periodSeconds=10
- Liveness: exec `mysqladmin ping -h localhost`, periodSeconds=30, failureThreshold=5

**Credentials:** From Secret `gas-db-credentials` (MYSQL_ROOT_PASSWORD, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE).

**Backup CronJob:**
- Schedule: daily at 02:00 UTC (`0 2 * * *`)
- Runs `mysqldump` of the `ghana_audit_service` database
- Stores dumps in a PVC backed by Azure Files (or uploads to Azure Blob via `azcopy`)
- Retention: 7 daily backups (older are deleted by the CronJob script)
- Uses the same `gas-db-credentials` Secret

### 3. Redis Deployment

| Property | Value |
|----------|-------|
| Kind | Deployment |
| Replicas | 1 |
| Image | `redis:7-alpine` |
| Port | 6379 |
| CPU requests/limits | 50m / 100m |
| Memory requests/limits | 64Mi / 256Mi |
| Storage | 1Gi PVC (optional, for AOF persistence) |

**Command:** `redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru`

**Probes:**
- Readiness: exec `redis-cli ping`, periodSeconds=10
- Liveness: exec `redis-cli ping`, periodSeconds=30

Redis is non-critical. The app degrades gracefully to in-process fallbacks if Redis is unavailable.

### 4. Migration Job

| Property | Value |
|----------|-------|
| Kind | Job |
| Image | `gasacr.azurecr.io/gas-migrate:<git-sha>` |
| CPU requests/limits | 50m / 500m |
| Memory requests/limits | 128Mi / 512Mi |
| backoffLimit | 2 |
| ttlSecondsAfterFinished | 600 |
| restartPolicy | Never |

Built from the `migrator` stage of the existing multi-stage Dockerfile. Runs `npm run db:apply` which executes Drizzle migrations (idempotent — tracked in `__drizzle_migrations` table).

Job name includes the git SHA for uniqueness: `gas-migrate-<short-sha>`.

## ConfigMap & Secrets

### ConfigMap (`gas-config`)

```yaml
DB_HOST: mysql.gas.svc.cluster.local
DB_PORT: "3306"
DB_NAME: ghana_audit_service
NUXT_PUBLIC_SITE_URL: https://audit.gov.gh
NUXT_PUBLIC_SITE_NAME: Ghana Audit Service
NUXT_PUBLIC_CONTACT_EMAIL: info@audit.gov.gh
NUXT_PUBLIC_CONTACT_PHONE: "+233 (302) 664929"
REDIS_URL: redis://redis.gas.svc.cluster.local:6379/0
SESSION_IDLE_TIMEOUT: "30m"
SESSION_ABSOLUTE_TIMEOUT: "8h"
SESSION_WARNING_BEFORE: "2m"
ANALYTICS_RETENTION_DAYS: "30"
NODE_ENV: production
HOST: "0.0.0.0"
PORT: "3000"
```

### Secret (`gas-secrets`)

```yaml
DB_USER: <from GitHub Secrets>
DB_PASSWORD: <from GitHub Secrets>
JWT_SECRET: <from GitHub Secrets>
NUXT_API_SECRET: <from GitHub Secrets>
ANALYTICS_IP_SALT: <from GitHub Secrets>
```

### Secret (`gas-db-credentials`)

```yaml
MYSQL_ROOT_PASSWORD: <from GitHub Secrets>
MYSQL_USER: <from GitHub Secrets>
MYSQL_PASSWORD: <from GitHub Secrets>
MYSQL_DATABASE: ghana_audit_service
```

## TLS & Ingress

### Cluster Prerequisites (installed once, not in app manifests)

1. **NGINX Ingress Controller** — install via AKS addon (`az aks enable-addons --addons http_application_routing`) or via Helm (`ingress-nginx/ingress-nginx`). The Helm approach is recommended for production.
2. **cert-manager** — install via Helm (`jetstack/cert-manager`) with CRDs.

### ClusterIssuer

Let's Encrypt production ACME issuer using HTTP-01 challenge via the NGINX Ingress.

### Ingress Resource

- Host: `audit.gov.gh`
- TLS secret: `gas-tls` (auto-provisioned by cert-manager)
- Ingress class: `nginx`
- Annotations:
  - `cert-manager.io/cluster-issuer: letsencrypt-prod`
  - `nginx.ingress.kubernetes.io/proxy-body-size: "10m"` (file uploads)
  - `nginx.ingress.kubernetes.io/proxy-read-timeout: "60"`
  - `nginx.ingress.kubernetes.io/ssl-redirect: "true"`

## GitHub Actions CI/CD Workflow

**Trigger:** push to `main` branch

**GitHub Secrets required:**
- `AZURE_CREDENTIALS` — service principal JSON for AKS + ACR access
- `ACR_NAME` — Azure Container Registry name (e.g., `gasacr`)
- `AKS_CLUSTER_NAME` — AKS cluster name
- `AKS_RESOURCE_GROUP` — Azure resource group
- `DB_PASSWORD` — MySQL user password
- `MYSQL_ROOT_PASSWORD` — MySQL root password
- `JWT_SECRET` — JWT signing secret
- `NUXT_API_SECRET` — Nuxt API secret
- `ANALYTICS_IP_SALT` — analytics IP hashing salt
- `DB_USER` — MySQL user (default: `gas_user`)

**Workflow steps:**

```
1. Checkout code
2. Login to Azure (az login with service principal)
3. Login to ACR (az acr login)
4. Build & push frontend image (--target runner)     } parallel
5. Build & push migrate image (--target migrator)     }
6. Set up kubectl (az aks get-credentials)
7. Apply namespace (kubectl apply -f k8s/namespace.yaml)
8. Apply ConfigMap & Secrets (envsubst from GitHub Secrets)
9. Apply MySQL StatefulSet (kubectl apply -f k8s/mysql/)
10. Wait for MySQL ready (kubectl rollout status)
11. Apply Redis Deployment (kubectl apply -f k8s/redis/)
12. Run migration Job (kubectl create with unique name, wait for completion)
13. Apply frontend Deployment, Service, Ingress, HPA (kubectl apply -f k8s/frontend/)
14. Apply Network Policies (kubectl apply -f k8s/network/)
15. Verify rollout (kubectl rollout status deployment/gas-frontend -n gas)
```

## Security

### Network Policies

Three policies in the `gas` namespace:

1. **frontend-policy:** Allow ingress from NGINX Ingress Controller namespace. Allow egress to `mysql` on 3306 and `redis` on 6379.
2. **mysql-policy:** Allow ingress only from pods with label `app: gas-frontend` on port 3306. Deny all other ingress.
3. **redis-policy:** Allow ingress only from pods with label `app: gas-frontend` on port 6379. Deny all other ingress.

### Pod Security

- Apply `restricted` Pod Security Standard to the `gas` namespace via labels
- All containers run as non-root (frontend already does; MySQL and Redis defaults are acceptable)
- No privileged containers, no host networking

### RBAC

- GitHub Actions service principal scoped to the `gas` namespace only
- Uses a custom ClusterRole/RoleBinding with permissions limited to: deployments, services, configmaps, secrets, jobs, statefulsets, ingresses, networkpolicies, HPAs

### Future Enhancement

- Azure Key Vault CSI Driver for secret management (mounts AKV secrets as K8s Secrets)
- This is recommended for a government site but not included in the initial deployment

## Deployment Verification

After each deployment, the workflow verifies:
1. Migration Job completed successfully (exit code 0)
2. Frontend Deployment rolled out (`kubectl rollout status`)
3. Frontend pods are ready (readiness probe passing)
4. Ingress has an external IP assigned

## Existing Manifest Migration

The existing `k8s/migrate-job.yaml` will be replaced by the new `k8s/jobs/migrate-job.yaml`. The structure is preserved but updated with:
- Correct ACR image reference (replacing `registry.example.com`)
- Unique Job naming per deployment
- Consistent labels and namespace references
