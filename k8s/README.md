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

Configure these in the GitHub repository settings under Settings > Secrets and variables > Actions:

| Secret | Description |
|--------|-------------|
| `AZURE_CREDENTIALS` | Service principal JSON (`az ad sp create-for-rbac --sdk-auth`) |
| `ACR_NAME` | ACR name (e.g., `gasacr`) |
| `AKS_CLUSTER_NAME` | AKS cluster name |
| `AKS_RESOURCE_GROUP` | Azure resource group |
| `DB_USER` | MySQL user (e.g., `gas_user`) |
| `DB_PASSWORD` | MySQL user password |
| `MYSQL_ROOT_PASSWORD` | MySQL root password |
| `JWT_SECRET` | JWT signing secret (generate with `openssl rand -hex 32`) |
| `NUXT_API_SECRET` | Nuxt API secret (generate with `openssl rand -hex 32`) |
| `ANALYTICS_IP_SALT` | Analytics IP hashing salt (generate with `openssl rand -hex 32`) |

## Manual Deploy

If you need to deploy manually (not via GitHub Actions):

```bash
# 1. Get cluster credentials
az aks get-credentials --name <CLUSTER> --resource-group <RG>

# 2. Apply namespace and config
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/config/configmap.yaml

# 3. Apply secrets (set env vars first)
export DB_USER=gas_user DB_PASSWORD=... JWT_SECRET=... NUXT_API_SECRET=... ANALYTICS_IP_SALT=... MYSQL_ROOT_PASSWORD=...
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

# 6. Deploy frontend (replace image tag)
sed "s|gasacr.azurecr.io/gas-frontend:latest|gasacr.azurecr.io/gas-frontend:<TAG>|g" \
  k8s/frontend/deployment.yaml | kubectl apply -f -
kubectl apply -f k8s/frontend/service.yaml
kubectl apply -f k8s/frontend/ingress.yaml
kubectl apply -f k8s/frontend/hpa.yaml

# 7. Apply policies and backup
kubectl apply -f k8s/network/network-policies.yaml
kubectl apply -f k8s/jobs/mysql-backup-cronjob.yaml

# 8. Verify
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
```
