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
az acr create --name gasacr --resource-group <RG> --sku Basic
az aks update --name <CLUSTER> --resource-group <RG> --attach-acr gasacr
```

## GitHub Secrets

Configure these as **environment** secrets on the `production` environment
(Settings > Environments > production > Secrets), **not** repository-level
secrets. Both the `build-and-push` and `deploy` jobs declare
`environment: production`, so an environment-scoped secret that the build job
cannot see will make `azure/login` fail with empty credentials.

| Secret                       | Description                                                      |
| ---------------------------- | ---------------------------------------------------------------- |
| `AZURE_CLIENT_ID`            | App registration Application (client) ID — used for OIDC login   |
| `AZURE_TENANT_ID`            | Microsoft Entra Directory (tenant) ID                            |
| `AZURE_SUBSCRIPTION_ID`      | Azure subscription ID (`az account show --query id -o tsv`)      |
| `ACR_NAME`                   | ACR name (e.g., `gasacr`)                                        |
| `AKS_CLUSTER_NAME`           | AKS cluster name                                                 |
| `AKS_RESOURCE_GROUP`         | Azure resource group                                             |
| `DB_USER`                    | MySQL user (e.g., `gas_user`)                                    |
| `DB_PASSWORD`                | MySQL user password                                              |
| `MYSQL_ROOT_PASSWORD`        | MySQL root password                                              |
| `JWT_SECRET`                 | JWT signing secret (generate with `openssl rand -hex 32`)        |
| `NUXT_API_SECRET`            | Nuxt API secret (generate with `openssl rand -hex 32`)           |
| `ANALYTICS_IP_SALT`          | Analytics IP hashing salt (generate with `openssl rand -hex 32`) |
| `AZURE_STORAGE_ACCOUNT_NAME` | Azure Storage account name backing the gas-public file share     |
| `AZURE_STORAGE_ACCOUNT_KEY`  | Azure Storage account access key for the gas-public file share   |

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

## Manual Deploy

If you need to deploy manually (not via GitHub Actions):

```bash
# 1. Get cluster credentials
az aks get-credentials --name <CLUSTER> --resource-group <RG>

# 2. Apply namespace and config
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/config/configmap.yaml

# 3. Apply secrets (set env vars first)
export DB_USER=gas_user DB_PASSWORD=... JWT_SECRET=... NUXT_API_SECRET=... ANALYTICS_IP_SALT=... MYSQL_ROOT_PASSWORD=... AZURE_STORAGE_ACCOUNT_NAME=... AZURE_STORAGE_ACCOUNT_KEY=...
envsubst < k8s/config/secrets.yaml | kubectl apply -f -

# 4. Apply infrastructure
kubectl apply -f k8s/tls/cluster-issuer.yaml
kubectl apply -f k8s/mysql/
kubectl rollout status statefulset/mysql -n gas --timeout=120s
kubectl apply -f k8s/redis/

# 5. Run migration
export JOB_SUFFIX=$(date +%s)
envsubst < k8s/jobs/migrate-job.yaml | kubectl apply -f -
kubectl wait --for=condition=complete job/gas-migrate-${JOB_SUFFIX} -n gas --timeout=120s

# 6. Apply persistent storage
kubectl apply -f k8s/storage/public-files.yaml
kubectl wait --for=jsonpath='{.status.phase}'=Bound pvc/gas-public-pvc -n gas --timeout=60s

# 7. Deploy frontend (replace image tag)
sed "s|gasacr.azurecr.io/gas-frontend:latest|gasacr.azurecr.io/gas-frontend:<TAG>|g" \
  k8s/frontend/deployment.yaml | kubectl apply -f -
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
    mysql-backup-cronjob.yaml # Daily mysqldump (02:00 UTC, 7-day retention)
  tls/
    cluster-issuer.yaml       # Let's Encrypt ClusterIssuer
  network/
    network-policies.yaml     # Default-deny + per-service allow rules
  storage/
    public-files.yaml         # Static PV/PVC for Azure Files (gas-public share)
```

## Persistent storage for public files

`public/{img,images,uploads,pdf}` are backed by a single static Azure File
share (`gas-public`) via `k8s/storage/public-files.yaml`. Provision it before
the first deploy:

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
