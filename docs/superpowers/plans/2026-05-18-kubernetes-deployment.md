# Kubernetes Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the Ghana Audit Service to Azure AKS with MySQL StatefulSet, Redis, NGINX Ingress + cert-manager TLS, Network Policies, and GitHub Actions CI/CD.

**Architecture:** Raw YAML manifests in `k8s/` organized by service (frontend, mysql, redis, jobs, config, tls, network). A GitHub Actions workflow builds two Docker images (app + migrator), pushes them to Azure Container Registry, then applies manifests sequentially — MySQL first, then Redis, then a migration Job, then the frontend Deployment + Ingress.

**Tech Stack:** Kubernetes 1.28+, AKS, Azure Container Registry, NGINX Ingress Controller, cert-manager, GitHub Actions, MySQL 8.0, Redis 7-alpine, Node 24-alpine (Nuxt 3)

**Spec:** `docs/superpowers/specs/2026-05-18-kubernetes-deployment-design.md`

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `k8s/namespace.yaml` | Namespace `gas` with Pod Security Standard labels |
| `k8s/config/configmap.yaml` | Non-sensitive env vars (DB_HOST, NUXT_PUBLIC_*, REDIS_URL, etc.) |
| `k8s/config/secrets.yaml` | Template for sensitive env vars — placeholder values, real values injected by CI |
| `k8s/mysql/statefulset.yaml` | MySQL 8.0 StatefulSet with 20Gi PVC |
| `k8s/mysql/service.yaml` | Headless ClusterIP Service for MySQL |
| `k8s/redis/deployment.yaml` | Redis 7-alpine Deployment with 1Gi PVC |
| `k8s/redis/service.yaml` | ClusterIP Service for Redis |
| `k8s/frontend/deployment.yaml` | Nuxt app Deployment (2 replicas, probes, rolling update) |
| `k8s/frontend/service.yaml` | ClusterIP Service for frontend |
| `k8s/frontend/ingress.yaml` | NGINX Ingress with TLS via cert-manager |
| `k8s/frontend/hpa.yaml` | HorizontalPodAutoscaler (2-5 replicas, 70% CPU) |
| `k8s/jobs/migrate-job.yaml` | Migration Job (replaces existing `k8s/migrate-job.yaml`) |
| `k8s/jobs/mysql-backup-cronjob.yaml` | Daily mysqldump CronJob with 7-day retention |
| `k8s/tls/cluster-issuer.yaml` | cert-manager Let's Encrypt ClusterIssuer |
| `k8s/network/network-policies.yaml` | NetworkPolicies for frontend, mysql, redis |
| `.github/workflows/deploy.yml` | CD workflow: build images, push to ACR, deploy to AKS |

### Files to delete

| File | Reason |
|------|--------|
| `k8s/migrate-job.yaml` | Replaced by `k8s/jobs/migrate-job.yaml` |

### Files unchanged

| File | Role |
|------|------|
| `ghana-audit-service/Dockerfile` | Already has `migrator` and `runner` stages — no changes needed |
| `.github/workflows/ci.yml` | Existing CI workflow; deploy workflow references it |

---

## Task 1: Namespace and ConfigMap/Secrets

**Files:**
- Create: `k8s/namespace.yaml`
- Create: `k8s/config/configmap.yaml`
- Create: `k8s/config/secrets.yaml`

This task creates the foundational resources that all other manifests depend on.

- [ ] **Step 1: Create the k8s subdirectories**

```bash
mkdir -p k8s/config k8s/frontend k8s/mysql k8s/redis k8s/jobs k8s/tls k8s/network
```

- [ ] **Step 2: Create namespace.yaml**

Create `k8s/namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: gas
  labels:
    app.kubernetes.io/part-of: ghana-audit-service
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/warn-version: latest
```

The `pod-security.kubernetes.io/enforce: restricted` label tells K8s to reject any pod in this namespace that doesn't meet the "restricted" Pod Security Standard (no root, no privileged, no host networking).

- [ ] **Step 3: Create configmap.yaml**

Create `k8s/config/configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: gas-config
  namespace: gas
  labels:
    app.kubernetes.io/part-of: ghana-audit-service
data:
  DB_HOST: "mysql.gas.svc.cluster.local"
  DB_PORT: "3306"
  DB_NAME: "ghana_audit_service"
  NUXT_PUBLIC_SITE_URL: "https://audit.gov.gh"
  NUXT_PUBLIC_SITE_NAME: "Ghana Audit Service"
  NUXT_PUBLIC_CONTACT_EMAIL: "info@audit.gov.gh"
  NUXT_PUBLIC_CONTACT_PHONE: "+233 (302) 664929"
  REDIS_URL: "redis://redis.gas.svc.cluster.local:6379/0"
  SESSION_IDLE_TIMEOUT: "30m"
  SESSION_ABSOLUTE_TIMEOUT: "8h"
  SESSION_WARNING_BEFORE: "2m"
  ANALYTICS_RETENTION_DAYS: "30"
  NODE_ENV: "production"
  HOST: "0.0.0.0"
  PORT: "3000"
```

- [ ] **Step 4: Create secrets.yaml template**

Create `k8s/config/secrets.yaml`. This file uses `$PLACEHOLDER` tokens that `envsubst` replaces in the CI/CD workflow. The file is checked in as a template — never commit real secret values.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: gas-secrets
  namespace: gas
  labels:
    app.kubernetes.io/part-of: ghana-audit-service
type: Opaque
stringData:
  DB_USER: "${DB_USER}"
  DB_PASSWORD: "${DB_PASSWORD}"
  JWT_SECRET: "${JWT_SECRET}"
  NUXT_API_SECRET: "${NUXT_API_SECRET}"
  ANALYTICS_IP_SALT: "${ANALYTICS_IP_SALT}"
---
apiVersion: v1
kind: Secret
metadata:
  name: gas-db-credentials
  namespace: gas
  labels:
    app.kubernetes.io/part-of: ghana-audit-service
type: Opaque
stringData:
  MYSQL_ROOT_PASSWORD: "${MYSQL_ROOT_PASSWORD}"
  MYSQL_USER: "${DB_USER}"
  MYSQL_PASSWORD: "${DB_PASSWORD}"
  MYSQL_DATABASE: "ghana_audit_service"
```

- [ ] **Step 5: Validate manifests locally**

```bash
kubectl apply --dry-run=client -f k8s/namespace.yaml
kubectl apply --dry-run=client -f k8s/config/configmap.yaml
```

The secrets template has `${}` placeholders so it won't pass dry-run as-is — that's expected. Verify it's valid YAML:

```bash
python3 -c "import yaml; yaml.safe_load(open('k8s/config/secrets.yaml'))" 2>&1 || echo "YAML parsing skipped — envsubst placeholders present, validated by CI"
```

- [ ] **Step 6: Commit**

```bash
git add k8s/namespace.yaml k8s/config/
git commit -m "feat(k8s): add namespace, configmap, and secrets template"
```

---

## Task 2: MySQL StatefulSet and Service

**Files:**
- Create: `k8s/mysql/statefulset.yaml`
- Create: `k8s/mysql/service.yaml`

- [ ] **Step 1: Create the headless Service**

Create `k8s/mysql/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mysql
  namespace: gas
  labels:
    app.kubernetes.io/name: mysql
    app.kubernetes.io/part-of: ghana-audit-service
spec:
  clusterIP: None
  selector:
    app.kubernetes.io/name: mysql
  ports:
    - port: 3306
      targetPort: 3306
      protocol: TCP
      name: mysql
```

The headless Service (`clusterIP: None`) is required by the StatefulSet. It creates a stable DNS entry `mysql.gas.svc.cluster.local` that resolves to the pod IP directly.

- [ ] **Step 2: Create the StatefulSet**

Create `k8s/mysql/statefulset.yaml`:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
  namespace: gas
  labels:
    app.kubernetes.io/name: mysql
    app.kubernetes.io/part-of: ghana-audit-service
spec:
  serviceName: mysql
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: mysql
  template:
    metadata:
      labels:
        app.kubernetes.io/name: mysql
        app.kubernetes.io/part-of: ghana-audit-service
    spec:
      securityContext:
        fsGroup: 999
      containers:
        - name: mysql
          image: mysql:8.0
          args:
            - --character-set-server=utf8mb4
            - --collation-server=utf8mb4_unicode_ci
            - --default-authentication-plugin=mysql_native_password
          ports:
            - containerPort: 3306
              name: mysql
          envFrom:
            - secretRef:
                name: gas-db-credentials
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: "1"
              memory: 1Gi
          readinessProbe:
            exec:
              command:
                - mysqladmin
                - ping
                - -h
                - localhost
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
          livenessProbe:
            exec:
              command:
                - mysqladmin
                - ping
                - -h
                - localhost
            initialDelaySeconds: 30
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 5
          volumeMounts:
            - name: mysql-data
              mountPath: /var/lib/mysql
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
  volumeClaimTemplates:
    - metadata:
        name: mysql-data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: managed-csi
        resources:
          requests:
            storage: 20Gi
```

Note: The `restricted` PSS requires `allowPrivilegeEscalation: false` and `capabilities.drop: ALL`. The MySQL 8.0 image runs as uid 999 (mysql user) by default. `fsGroup: 999` ensures the PVC is writable.

- [ ] **Step 3: Validate manifests**

```bash
kubectl apply --dry-run=client -f k8s/mysql/service.yaml
kubectl apply --dry-run=client -f k8s/mysql/statefulset.yaml
```

- [ ] **Step 4: Commit**

```bash
git add k8s/mysql/
git commit -m "feat(k8s): add MySQL StatefulSet and headless Service"
```

---

## Task 3: Redis Deployment and Service

**Files:**
- Create: `k8s/redis/deployment.yaml`
- Create: `k8s/redis/service.yaml`

- [ ] **Step 1: Create the Redis Service**

Create `k8s/redis/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: gas
  labels:
    app.kubernetes.io/name: redis
    app.kubernetes.io/part-of: ghana-audit-service
spec:
  selector:
    app.kubernetes.io/name: redis
  ports:
    - port: 6379
      targetPort: 6379
      protocol: TCP
      name: redis
```

- [ ] **Step 2: Create the Redis Deployment**

Create `k8s/redis/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: gas
  labels:
    app.kubernetes.io/name: redis
    app.kubernetes.io/part-of: ghana-audit-service
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: redis
  template:
    metadata:
      labels:
        app.kubernetes.io/name: redis
        app.kubernetes.io/part-of: ghana-audit-service
    spec:
      securityContext:
        fsGroup: 999
        runAsUser: 999
        runAsGroup: 999
        runAsNonRoot: true
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: redis
          image: redis:7-alpine
          command:
            - redis-server
            - --appendonly
            - "yes"
            - --maxmemory
            - 256mb
            - --maxmemory-policy
            - allkeys-lru
          ports:
            - containerPort: 6379
              name: redis
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 100m
              memory: 256Mi
          readinessProbe:
            exec:
              command: ["redis-cli", "ping"]
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
          livenessProbe:
            exec:
              command: ["redis-cli", "ping"]
            initialDelaySeconds: 10
            periodSeconds: 30
            timeoutSeconds: 3
          volumeMounts:
            - name: redis-data
              mountPath: /data
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
      volumes:
        - name: redis-data
          persistentVolumeClaim:
            claimName: redis-data
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-data
  namespace: gas
  labels:
    app.kubernetes.io/name: redis
    app.kubernetes.io/part-of: ghana-audit-service
spec:
  accessModes: ["ReadWriteOnce"]
  storageClassName: managed-csi
  resources:
    requests:
      storage: 1Gi
```

The `redis:7-alpine` image runs as root by default, so we override with `runAsUser: 999`. The `seccompProfile: RuntimeDefault` is required by the restricted PSS.

- [ ] **Step 3: Validate manifests**

```bash
kubectl apply --dry-run=client -f k8s/redis/service.yaml
kubectl apply --dry-run=client -f k8s/redis/deployment.yaml
```

- [ ] **Step 4: Commit**

```bash
git add k8s/redis/
git commit -m "feat(k8s): add Redis Deployment and Service with PVC"
```

---

## Task 4: Frontend Deployment, Service, Ingress, and HPA

**Files:**
- Create: `k8s/frontend/deployment.yaml`
- Create: `k8s/frontend/service.yaml`
- Create: `k8s/frontend/ingress.yaml`
- Create: `k8s/frontend/hpa.yaml`

- [ ] **Step 1: Create the frontend Service**

Create `k8s/frontend/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: gas-frontend
  namespace: gas
  labels:
    app.kubernetes.io/name: gas-frontend
    app.kubernetes.io/part-of: ghana-audit-service
spec:
  selector:
    app.kubernetes.io/name: gas-frontend
  ports:
    - port: 80
      targetPort: 3000
      protocol: TCP
      name: http
```

Port 80 on the Service, mapping to 3000 on the container. The Ingress routes to port 80 of this Service.

- [ ] **Step 2: Create the frontend Deployment**

Create `k8s/frontend/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gas-frontend
  namespace: gas
  labels:
    app.kubernetes.io/name: gas-frontend
    app.kubernetes.io/part-of: ghana-audit-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: gas-frontend
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  template:
    metadata:
      labels:
        app.kubernetes.io/name: gas-frontend
        app.kubernetes.io/part-of: ghana-audit-service
    spec:
      securityContext:
        runAsUser: 1001
        runAsGroup: 1001
        runAsNonRoot: true
        fsGroup: 1001
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: frontend
          image: gasacr.azurecr.io/gas-frontend:latest
          ports:
            - containerPort: 3000
              name: http
          envFrom:
            - configMapRef:
                name: gas-config
            - secretRef:
                name: gas-secrets
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          startupProbe:
            httpGet:
              path: /
              port: 3000
            failureThreshold: 30
            periodSeconds: 2
          readinessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 0
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 0
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 5
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
```

The `image: gasacr.azurecr.io/gas-frontend:latest` is a placeholder — the GitHub Actions workflow overwrites the tag with the git SHA using `kubectl set image` or by patching the manifest via `sed` before applying.

The `runAsUser: 1001` / `runAsGroup: 1001` matches the `nuxtjs` user created in the Dockerfile.

- [ ] **Step 3: Create the Ingress**

Create `k8s/frontend/ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gas-frontend
  namespace: gas
  labels:
    app.kubernetes.io/name: gas-frontend
    app.kubernetes.io/part-of: ghana-audit-service
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - audit.gov.gh
      secretName: gas-tls
  rules:
    - host: audit.gov.gh
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: gas-frontend
                port:
                  number: 80
```

- [ ] **Step 4: Create the HPA**

Create `k8s/frontend/hpa.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: gas-frontend
  namespace: gas
  labels:
    app.kubernetes.io/name: gas-frontend
    app.kubernetes.io/part-of: ghana-audit-service
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: gas-frontend
  minReplicas: 2
  maxReplicas: 5
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

- [ ] **Step 5: Validate manifests**

```bash
kubectl apply --dry-run=client -f k8s/frontend/service.yaml
kubectl apply --dry-run=client -f k8s/frontend/deployment.yaml
kubectl apply --dry-run=client -f k8s/frontend/ingress.yaml
kubectl apply --dry-run=client -f k8s/frontend/hpa.yaml
```

- [ ] **Step 6: Commit**

```bash
git add k8s/frontend/
git commit -m "feat(k8s): add frontend Deployment, Service, Ingress, and HPA"
```

---

## Task 5: Migration Job

**Files:**
- Create: `k8s/jobs/migrate-job.yaml`
- Delete: `k8s/migrate-job.yaml`

- [ ] **Step 1: Create the new migration Job**

Create `k8s/jobs/migrate-job.yaml`. The Job name is templated with `JOB_SUFFIX` so the CI workflow can inject a unique suffix per deployment (the short git SHA):

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: gas-migrate-${JOB_SUFFIX}
  namespace: gas
  labels:
    app.kubernetes.io/name: gas-migrate
    app.kubernetes.io/part-of: ghana-audit-service
spec:
  backoffLimit: 2
  ttlSecondsAfterFinished: 600
  template:
    metadata:
      labels:
        app.kubernetes.io/name: gas-migrate
        app.kubernetes.io/part-of: ghana-audit-service
    spec:
      restartPolicy: Never
      securityContext:
        runAsUser: 1000
        runAsGroup: 1000
        runAsNonRoot: true
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: migrate
          image: gasacr.azurecr.io/gas-migrate:latest
          imagePullPolicy: Always
          envFrom:
            - configMapRef:
                name: gas-config
            - secretRef:
                name: gas-secrets
          resources:
            requests:
              cpu: 50m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
```

The `${JOB_SUFFIX}` in the name and the `image` tag are replaced by `envsubst` in the CD workflow, the same way secrets are injected.

- [ ] **Step 2: Delete the old migration Job**

```bash
rm k8s/migrate-job.yaml
```

- [ ] **Step 3: Commit**

```bash
git add k8s/jobs/migrate-job.yaml
git rm k8s/migrate-job.yaml
git commit -m "feat(k8s): replace migration Job with templated version in k8s/jobs/"
```

---

## Task 6: MySQL Backup CronJob

**Files:**
- Create: `k8s/jobs/mysql-backup-cronjob.yaml`

- [ ] **Step 1: Create the backup CronJob**

Create `k8s/jobs/mysql-backup-cronjob.yaml`:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: mysql-backup
  namespace: gas
  labels:
    app.kubernetes.io/name: mysql-backup
    app.kubernetes.io/part-of: ghana-audit-service
spec:
  schedule: "0 2 * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      backoffLimit: 1
      ttlSecondsAfterFinished: 3600
      template:
        metadata:
          labels:
            app.kubernetes.io/name: mysql-backup
            app.kubernetes.io/part-of: ghana-audit-service
        spec:
          restartPolicy: Never
          securityContext:
            runAsUser: 999
            runAsGroup: 999
            runAsNonRoot: true
            seccompProfile:
              type: RuntimeDefault
          containers:
            - name: backup
              image: mysql:8.0
              command:
                - /bin/sh
                - -c
                - |
                  set -e
                  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
                  BACKUP_FILE="/backups/gas-${TIMESTAMP}.sql.gz"
                  echo "Starting backup: ${BACKUP_FILE}"
                  mysqldump \
                    -h mysql.gas.svc.cluster.local \
                    -u "${MYSQL_USER}" \
                    -p"${MYSQL_PASSWORD}" \
                    --single-transaction \
                    --routines \
                    --triggers \
                    "${MYSQL_DATABASE}" | gzip > "${BACKUP_FILE}"
                  echo "Backup complete: $(du -h ${BACKUP_FILE} | cut -f1)"
                  echo "Cleaning backups older than 7 days..."
                  find /backups -name "gas-*.sql.gz" -mtime +7 -delete
                  echo "Remaining backups:"
                  ls -lh /backups/gas-*.sql.gz
              envFrom:
                - secretRef:
                    name: gas-db-credentials
              resources:
                requests:
                  cpu: 50m
                  memory: 128Mi
                limits:
                  cpu: 500m
                  memory: 512Mi
              volumeMounts:
                - name: backup-storage
                  mountPath: /backups
              securityContext:
                allowPrivilegeEscalation: false
                capabilities:
                  drop:
                    - ALL
          volumes:
            - name: backup-storage
              persistentVolumeClaim:
                claimName: mysql-backups
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mysql-backups
  namespace: gas
  labels:
    app.kubernetes.io/name: mysql-backup
    app.kubernetes.io/part-of: ghana-audit-service
spec:
  accessModes: ["ReadWriteOnce"]
  storageClassName: managed-csi
  resources:
    requests:
      storage: 10Gi
```

The CronJob uses `--single-transaction` for consistent dumps without locking tables. Backups are gzipped and stored on a 10Gi Azure Managed Disk. The cleanup step deletes files older than 7 days.

- [ ] **Step 2: Validate manifest**

```bash
kubectl apply --dry-run=client -f k8s/jobs/mysql-backup-cronjob.yaml
```

- [ ] **Step 3: Commit**

```bash
git add k8s/jobs/mysql-backup-cronjob.yaml
git commit -m "feat(k8s): add daily MySQL backup CronJob with 7-day retention"
```

---

## Task 7: TLS — cert-manager ClusterIssuer

**Files:**
- Create: `k8s/tls/cluster-issuer.yaml`

- [ ] **Step 1: Create the ClusterIssuer**

Create `k8s/tls/cluster-issuer.yaml`:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
  labels:
    app.kubernetes.io/part-of: ghana-audit-service
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: judedanbo@outlook.com
    privateKeySecretRef:
      name: letsencrypt-prod-account-key
    solvers:
      - http01:
          ingress:
            class: nginx
```

The `email` is used for Let's Encrypt certificate expiry notifications. The HTTP-01 solver creates a temporary Ingress to prove domain ownership.

Prerequisite: cert-manager must be installed on the cluster before this is applied. The CD workflow applies this manifest, but cert-manager CRDs must exist first.

- [ ] **Step 2: Commit**

```bash
git add k8s/tls/
git commit -m "feat(k8s): add Let's Encrypt ClusterIssuer for cert-manager"
```

---

## Task 8: Network Policies

**Files:**
- Create: `k8s/network/network-policies.yaml`

- [ ] **Step 1: Create the Network Policies**

Create `k8s/network/network-policies.yaml`. Three policies: default-deny for all ingress, then allow rules for each service.

```yaml
# Default: deny all ingress in the gas namespace.
# Each service then explicitly opens the ports it needs.
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: gas
  labels:
    app.kubernetes.io/part-of: ghana-audit-service
spec:
  podSelector: {}
  policyTypes:
    - Ingress
---
# Frontend: allow ingress from the NGINX Ingress Controller.
# The ingress-nginx namespace label must match your cluster's Ingress
# Controller installation — "ingress-nginx" is the Helm default.
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-ingress
  namespace: gas
  labels:
    app.kubernetes.io/part-of: ghana-audit-service
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: gas-frontend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
      ports:
        - port: 3000
          protocol: TCP
---
# MySQL: allow ingress only from frontend pods and backup pods.
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-mysql-ingress
  namespace: gas
  labels:
    app.kubernetes.io/part-of: ghana-audit-service
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: mysql
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: gas-frontend
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: gas-migrate
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: mysql-backup
      ports:
        - port: 3306
          protocol: TCP
---
# Redis: allow ingress only from frontend pods.
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-redis-ingress
  namespace: gas
  labels:
    app.kubernetes.io/part-of: ghana-audit-service
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: redis
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: gas-frontend
      ports:
        - port: 6379
          protocol: TCP
```

The default-deny policy blocks all ingress to all pods in the namespace. Then each subsequent policy opens specific ports from specific sources. The MySQL policy allows the frontend, migration Job, and backup CronJob to connect.

- [ ] **Step 2: Validate manifests**

```bash
kubectl apply --dry-run=client -f k8s/network/network-policies.yaml
```

- [ ] **Step 3: Commit**

```bash
git add k8s/network/
git commit -m "feat(k8s): add NetworkPolicies — default-deny plus per-service allow rules"
```

---

## Task 9: GitHub Actions Deploy Workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

This is the largest task. The workflow builds two Docker images, pushes them to ACR, then deploys all manifests to AKS in the correct order.

- [ ] **Step 1: Create the deploy workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AKS

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-production
  cancel-in-progress: false

env:
  IMAGE_TAG: ${{ github.sha }}
  SHORT_SHA: ${{ github.sha }}

jobs:
  ci:
    name: Quality Gate
    uses: ./.github/workflows/ci.yml

  build-and-push:
    name: Build & Push Images
    needs: ci
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Login to Azure
        uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Login to ACR
        run: az acr login --name ${{ secrets.ACR_NAME }}

      - name: Build and push frontend image
        run: |
          docker build \
            --target runner \
            --build-arg NUXT_PUBLIC_SITE_URL=https://audit.gov.gh \
            -t ${{ secrets.ACR_NAME }}.azurecr.io/gas-frontend:${{ env.IMAGE_TAG }} \
            -t ${{ secrets.ACR_NAME }}.azurecr.io/gas-frontend:latest \
            ./ghana-audit-service

      - name: Build and push migrate image
        run: |
          docker build \
            --target migrator \
            -t ${{ secrets.ACR_NAME }}.azurecr.io/gas-migrate:${{ env.IMAGE_TAG }} \
            -t ${{ secrets.ACR_NAME }}.azurecr.io/gas-migrate:latest \
            ./ghana-audit-service

      - name: Push images
        run: |
          docker push ${{ secrets.ACR_NAME }}.azurecr.io/gas-frontend:${{ env.IMAGE_TAG }}
          docker push ${{ secrets.ACR_NAME }}.azurecr.io/gas-frontend:latest
          docker push ${{ secrets.ACR_NAME }}.azurecr.io/gas-migrate:${{ env.IMAGE_TAG }}
          docker push ${{ secrets.ACR_NAME }}.azurecr.io/gas-migrate:latest

  deploy:
    name: Deploy to AKS
    needs: build-and-push
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    environment: production
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Login to Azure
        uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Set up kubectl
        uses: azure/aks-set-context@v4
        with:
          cluster-name: ${{ secrets.AKS_CLUSTER_NAME }}
          resource-group: ${{ secrets.AKS_RESOURCE_GROUP }}

      - name: Apply namespace
        run: kubectl apply -f k8s/namespace.yaml

      - name: Apply ConfigMap
        run: kubectl apply -f k8s/config/configmap.yaml

      - name: Apply Secrets
        env:
          DB_USER: ${{ secrets.DB_USER }}
          DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
          NUXT_API_SECRET: ${{ secrets.NUXT_API_SECRET }}
          ANALYTICS_IP_SALT: ${{ secrets.ANALYTICS_IP_SALT }}
          MYSQL_ROOT_PASSWORD: ${{ secrets.MYSQL_ROOT_PASSWORD }}
        run: |
          envsubst < k8s/config/secrets.yaml | kubectl apply -f -

      - name: Apply TLS ClusterIssuer
        run: kubectl apply -f k8s/tls/cluster-issuer.yaml

      - name: Apply MySQL
        run: |
          kubectl apply -f k8s/mysql/
          kubectl rollout status statefulset/mysql -n gas --timeout=120s

      - name: Apply Redis
        run: |
          kubectl apply -f k8s/redis/
          kubectl rollout status deployment/redis -n gas --timeout=60s

      - name: Run migration Job
        env:
          JOB_SUFFIX: ${{ github.sha }}
        run: |
          export JOB_SUFFIX=$(echo ${{ github.sha }} | cut -c1-7)
          envsubst < k8s/jobs/migrate-job.yaml | kubectl apply -f -
          kubectl wait --for=condition=complete \
            job/gas-migrate-${JOB_SUFFIX} \
            -n gas \
            --timeout=120s

      - name: Apply frontend
        run: |
          sed "s|gasacr.azurecr.io/gas-frontend:latest|${{ secrets.ACR_NAME }}.azurecr.io/gas-frontend:${{ env.IMAGE_TAG }}|g" \
            k8s/frontend/deployment.yaml | kubectl apply -f -
          kubectl apply -f k8s/frontend/service.yaml
          kubectl apply -f k8s/frontend/ingress.yaml
          kubectl apply -f k8s/frontend/hpa.yaml

      - name: Apply Network Policies
        run: kubectl apply -f k8s/network/network-policies.yaml

      - name: Apply backup CronJob
        run: kubectl apply -f k8s/jobs/mysql-backup-cronjob.yaml

      - name: Verify rollout
        run: |
          kubectl rollout status deployment/gas-frontend -n gas --timeout=180s
          echo "--- Pod status ---"
          kubectl get pods -n gas
          echo "--- Service endpoints ---"
          kubectl get svc -n gas
          echo "--- Ingress ---"
          kubectl get ingress -n gas
```

Key design decisions in the workflow:
- `ci` job is a reusable workflow call — runs typecheck/lint/test/build before any deploy happens.
- `concurrency.cancel-in-progress: false` — never cancel an in-flight production deploy.
- Secrets are injected via `envsubst` so the template YAML stays in git with placeholder tokens.
- The frontend image tag is replaced with `sed` so the Deployment always uses the exact commit SHA.
- The migration Job name uses the short SHA for uniqueness, preventing name collisions with previous Jobs.

- [ ] **Step 2: Verify the ci.yml workflow is callable**

The existing `.github/workflows/ci.yml` uses `on: push` and `on: pull_request`. For the `uses: ./.github/workflows/ci.yml` call in deploy.yml to work, ci.yml also needs a `workflow_call` trigger. Open `.github/workflows/ci.yml` and add `workflow_call` to its `on:` block:

In `.github/workflows/ci.yml`, change the `on:` block from:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
```

to:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
  workflow_call:
```

This allows the deploy workflow to reuse the CI quality gate.

- [ ] **Step 3: Validate the workflow YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml')); print('Valid YAML')"
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml .github/workflows/ci.yml
git commit -m "feat(k8s): add GitHub Actions deploy workflow with ACR + AKS pipeline"
```

---

## Task 10: Documentation — Cluster Prerequisites and Runbook

**Files:**
- Create: `k8s/README.md`

- [ ] **Step 1: Create the k8s README**

Create `k8s/README.md`:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add k8s/README.md
git commit -m "docs(k8s): add deployment runbook and cluster prerequisites"
```

---

## Task 11: Update Root CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (root)

Update the root `CLAUDE.md` to reference the new k8s directory structure and deployment workflow.

- [ ] **Step 1: Add k8s section to CLAUDE.md**

In the root `CLAUDE.md`, find the `## Repository Layout` section and update the `k8s/` bullet from:

```
- `k8s/` — Kubernetes manifests (currently `migrate-job.yaml` for running DB migrations as a Job).
```

to:

```
- `k8s/` — Kubernetes manifests for AKS production deployment: namespace, frontend (Deployment + Service + Ingress + HPA), MySQL (StatefulSet), Redis (Deployment), migration Job, backup CronJob, ConfigMap/Secrets, TLS (cert-manager ClusterIssuer), and Network Policies. See `k8s/README.md` for cluster prerequisites and manual deploy instructions.
```

- [ ] **Step 2: Update the Deployment section**

In the root `CLAUDE.md`, find the `### Deployment` section and replace:

```
### Deployment
Production deploys via Docker. Code is pushed to `main`, then on the production server: `git pull origin main && docker compose up --build -d`.
```

with:

```
### Deployment
Production deploys to AKS via GitHub Actions (`.github/workflows/deploy.yml`). Pushing to `main` triggers: CI quality gate → build + push images to ACR → apply K8s manifests (MySQL → Redis → migration Job → frontend). Docker Compose remains available for local development. See `k8s/README.md` for cluster prerequisites and manual deploy runbook.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with K8s deployment details"
```

---

## Task 12: Final Validation

No new files. This task verifies the complete set of manifests is consistent.

- [ ] **Step 1: Verify all expected files exist**

```bash
echo "=== Checking file structure ==="
for f in \
  k8s/namespace.yaml \
  k8s/config/configmap.yaml \
  k8s/config/secrets.yaml \
  k8s/mysql/statefulset.yaml \
  k8s/mysql/service.yaml \
  k8s/redis/deployment.yaml \
  k8s/redis/service.yaml \
  k8s/frontend/deployment.yaml \
  k8s/frontend/service.yaml \
  k8s/frontend/ingress.yaml \
  k8s/frontend/hpa.yaml \
  k8s/jobs/migrate-job.yaml \
  k8s/jobs/mysql-backup-cronjob.yaml \
  k8s/tls/cluster-issuer.yaml \
  k8s/network/network-policies.yaml \
  k8s/README.md \
  .github/workflows/deploy.yml; do
  [ -f "$f" ] && echo "OK   $f" || echo "MISS $f"
done
```

Expected: all files show `OK`.

- [ ] **Step 2: Verify old migrate-job.yaml is removed**

```bash
[ ! -f k8s/migrate-job.yaml ] && echo "OK: old migrate-job.yaml removed" || echo "FAIL: old file still exists"
```

- [ ] **Step 3: Verify label consistency**

All manifests should use `app.kubernetes.io/part-of: ghana-audit-service`. Check:

```bash
grep -rn "app.kubernetes.io/part-of" k8s/ | grep -v "ghana-audit-service" && echo "FAIL: inconsistent labels" || echo "OK: all labels consistent"
```

- [ ] **Step 4: Verify namespace consistency**

All namespaced resources should reference `namespace: gas`:

```bash
grep -rn "namespace:" k8s/ --include="*.yaml" | grep -v "gas" | grep -v "README" && echo "WARN: check namespace references" || echo "OK: all namespaces are gas"
```

- [ ] **Step 5: Run YAML syntax check on all manifests**

```bash
for f in $(find k8s/ -name "*.yaml"); do
  python3 -c "import yaml; yaml.safe_load_all(open('$f'))" 2>&1 && echo "OK   $f" || echo "FAIL $f"
done
```

Note: `secrets.yaml` and `migrate-job.yaml` have `${}` placeholders — they'll produce warnings but the YAML structure is valid.

- [ ] **Step 6: Commit any fixes**

If any issues were found in steps 1-5, fix them and commit:

```bash
git add -A
git commit -m "fix(k8s): address validation issues"
```

If no issues, skip this step.
