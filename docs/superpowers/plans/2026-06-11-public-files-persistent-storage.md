# Public Files Persistent Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Back `public/{img,images,uploads,pdf}` with a single static Azure Files PV/PVC (ReadWriteMany) so uploaded/served files are shared across all frontend replicas and survive restarts, with baked static assets seeded on first run.

**Architecture:** One Azure File share (`gas-public`) bound by a static PV + PVC. The frontend Deployment mounts the share via `subPath` into both the write path (`/app/public/<dir>`) and the static-serve path (`/app/.output/public/<dir>`) for each of the four dirs. An initContainer seeds baked `img`/`images`/`uploads` assets into the share with no-clobber `cp`. No application code changes.

**Tech Stack:** Kubernetes (AKS), Azure Files CSI (`file.csi.azure.com`), kubectl v1.34, Docker (for testing the seed script), GitHub Actions (`deploy.yml`).

---

## Reference design

Spec: `docs/superpowers/specs/2026-06-11-public-files-persistent-storage-design.md`

## Key facts (verified against the codebase)

- Frontend runs as `runAsUser: 1001`, `runAsGroup: 1001` (`k8s/frontend/deployment.yaml:25-29`).
- Runner image copies only `/app/.output` (`ghana-audit-service/Dockerfile:93`); there is **no** `/app/public` in the image. Baked static assets live at `/app/.output/public/{img,images}`.
- App writes to cwd `public/` (`fileUpload.ts` relative `public/pdf`/`getUploadBaseDir()`; `generateThumbnail.ts` `process.cwd()/public`). Nitro serves static from `.output/public`. `resolvePublicAsset()` checks both.
- Existing secrets pattern: `k8s/config/secrets.yaml` is templated by `envsubst` in the `deploy.yml` "Apply Secrets" step.

## File structure

| File | Responsibility |
|---|---|
| `k8s/config/secrets.yaml` | **Modify** — add `azure-storage-secret` (account name + key) as a second/third Secret document |
| `k8s/storage/public-files.yaml` | **Create** — static `PersistentVolume` + `PersistentVolumeClaim` |
| `k8s/frontend/deployment.yaml` | **Modify** — add volume, `seed-public` initContainer, 8 `subPath` volumeMounts |
| `.github/workflows/deploy.yml` | **Modify** — pass storage secret env to Apply Secrets; add "Apply storage" step before "Apply frontend" |
| `k8s/.env.example` | **Modify** — document `AZURE_STORAGE_ACCOUNT_NAME` / `AZURE_STORAGE_ACCOUNT_KEY` |
| `k8s/README.md` | **Modify** — provisioning runbook for the share + secret |

## Validation approach

- **Manifest schema (local, offline):** `kubectl create --dry-run=client -o yaml -f <file> >/dev/null && echo OK`. This is purely client-side (no cluster contact) and validates YAML + built-in resource structure.
- **Manifest schema (server, at deploy):** CI/operator runs `kubectl apply --dry-run=server -f <file>` once a cluster context exists. Noted where relevant; not runnable locally.
- **Seed logic:** unit-tested in a `node:24-alpine` container (same busybox as the runner image) to confirm `cp` no-clobber semantics.

---

### Task 1: Add the Azure storage Secret

**Files:**
- Modify: `k8s/config/secrets.yaml` (append a new Secret document)

- [ ] **Step 1: Append the `azure-storage-secret` document**

Append to the end of `k8s/config/secrets.yaml` (after line 29, the `gas-db-credentials` block):

```yaml
---
apiVersion: v1
kind: Secret
metadata:
  name: azure-storage-secret
  namespace: gas
  labels:
    app.kubernetes.io/part-of: ghana-audit-service
type: Opaque
stringData:
  # Exact keys required by the Azure File CSI driver (nodeStageSecretRef).
  azurestorageaccountname: "${AZURE_STORAGE_ACCOUNT_NAME}"
  azurestorageaccountkey: "${AZURE_STORAGE_ACCOUNT_KEY}"
```

- [ ] **Step 2: Validate the file parses and is structurally valid**

Run:
```bash
kubectl create --dry-run=client -o yaml -f k8s/config/secrets.yaml >/dev/null && echo OK
```
Expected: `OK` (no YAML or schema errors). The `${...}` placeholders are valid quoted strings at this stage.

- [ ] **Step 3: Commit**

```bash
git add k8s/config/secrets.yaml
git commit -m "feat(k8s): add azure-storage-secret for Azure Files PV"
```

---

### Task 2: Create the PV + PVC manifest

**Files:**
- Create: `k8s/storage/public-files.yaml`

- [ ] **Step 1: Create `k8s/storage/public-files.yaml`**

```yaml
# Static Azure Files volume backing public/{img,images,uploads,pdf}.
# Provisioned out-of-band: an Azure Storage account + File share named
# "gas-public" must exist, and azure-storage-secret must hold its
# account name/key. See k8s/README.md.
apiVersion: v1
kind: PersistentVolume
metadata:
  name: gas-public-pv
  labels:
    app.kubernetes.io/name: gas-public
    app.kubernetes.io/part-of: ghana-audit-service
spec:
  capacity:
    storage: 50Gi
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  storageClassName: ""
  mountOptions:
    - dir_mode=0755
    - file_mode=0644
    - uid=1001
    - gid=1001
    - mfsymlinks
    - cache=strict
    - actimeo=30
  csi:
    driver: file.csi.azure.com
    # Cluster-unique, stable handle. Format is conventional, not parsed by name.
    volumeHandle: gas-public-share
    volumeAttributes:
      shareName: gas-public
    nodeStageSecretRef:
      name: azure-storage-secret
      namespace: gas
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: gas-public-pvc
  namespace: gas
  labels:
    app.kubernetes.io/name: gas-public
    app.kubernetes.io/part-of: ghana-audit-service
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: ""
  volumeName: gas-public-pv
  resources:
    requests:
      storage: 50Gi
```

- [ ] **Step 2: Validate the manifest**

Run:
```bash
kubectl create --dry-run=client -o yaml -f k8s/storage/public-files.yaml >/dev/null && echo OK
```
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add k8s/storage/public-files.yaml
git commit -m "feat(k8s): add static Azure Files PV/PVC for public files"
```

---

### Task 3: Test the initContainer seed script (test-first)

The only custom *logic* in this change is the no-clobber seed. busybox `cp` (alpine) must preserve pre-existing files (both runtime-written and already-seeded) while copying in missing baked assets. Verify the exact command in the runner's base image before embedding it.

**Files:**
- Test: ad-hoc Docker command (no file committed)

- [ ] **Step 1: Run the seed-logic test in `node:24-alpine`**

Run:
```bash
docker run --rm node:24-alpine sh -c '
  set -e
  # Baked assets (what the image ships at .output/public)
  mkdir -p /app/.output/public/img /app/.output/public/images /app/.output/public/uploads
  echo baked-img    > /app/.output/public/img/logo.png
  echo baked-image  > /app/.output/public/images/hero.jpg
  echo baked-seed   > /app/.output/public/uploads/seed.txt

  # The mounted share (subPath targets), with some pre-existing content
  mkdir -p /seed/img /seed/images /seed/uploads /seed/pdf
  echo keep-runtime > /seed/uploads/existing.txt   # runtime file: must survive
  echo keep-old     > /seed/img/logo.png           # already seeded: must NOT be clobbered

  mkdir -p /app/.output/public/uploads/images
  echo nested > /app/.output/public/uploads/images/nested.png

  # --- the seed command (as it will appear in the initContainer) ---
  # NOTE: busybox `cp -rn /src/. /dst/` is BROKEN — it copies nothing (verified
  # in node:24-alpine, BusyBox 1.37). Use the find + per-file no-clobber form,
  # which is dotfile-safe, recurses into subdirs, and never overwrites.
  for d in img images uploads; do
    ( cd /app/.output/public/$d 2>/dev/null && find . -type f | while read f; do
        [ -e "/seed/$d/$f" ] || { mkdir -p "/seed/$d/$(dirname "$f")"; cp "/app/.output/public/$d/$f" "/seed/$d/$f"; }
      done )
  done

  # --- assertions ---
  [ "$(cat /seed/img/logo.png)" = "keep-old" ]            || { echo "FAIL: clobbered already-seeded file"; exit 1; }
  [ "$(cat /seed/images/hero.jpg)" = "baked-image" ]      || { echo "FAIL: did not seed images"; exit 1; }
  [ "$(cat /seed/uploads/existing.txt)" = "keep-runtime" ] || { echo "FAIL: clobbered runtime file"; exit 1; }
  [ "$(cat /seed/uploads/seed.txt)" = "baked-seed" ]      || { echo "FAIL: did not seed uploads"; exit 1; }
  [ "$(cat /seed/uploads/images/nested.png)" = "nested" ] || { echo "FAIL: did not seed nested subdir"; exit 1; }
  echo "ALL SEED ASSERTIONS PASS"
'
```
Expected: final line `ALL SEED ASSERTIONS PASS`. (Verified passing during plan authoring.)

- [ ] **Step 2: No commit** (test only — nothing changed on disk).

---

### Task 4: Wire storage into the frontend Deployment

**Files:**
- Modify: `k8s/frontend/deployment.yaml`

- [ ] **Step 1: Add the initContainer, volumeMounts, and volume**

Replace the container/spec block. The current file ends the pod spec at the `containers:` block (lines 32-77, ending with the `securityContext` drop-ALL). Make three edits:

**(a)** Insert an `initContainers:` block immediately before `containers:` (between line 31 `type: RuntimeDefault` and line 32 `containers:`), at the same indentation as `containers:`:

```yaml
      initContainers:
        - name: seed-public
          image: gasacr.azurecr.io/gas-frontend:latest
          command:
            - sh
            - -c
            - |
              # busybox `cp -rn /src/. /dst/` is broken (copies nothing); use
              # find + per-file no-clobber. Verified in Task 3.
              for d in img images uploads; do
                ( cd /app/.output/public/$d 2>/dev/null && find . -type f | while read f; do
                    [ -e "/seed/$d/$f" ] || { mkdir -p "/seed/$d/$(dirname "$f")"; cp "/app/.output/public/$d/$f" "/seed/$d/$f"; }
                  done )
              done
          volumeMounts:
            - { name: public-files, mountPath: /seed/img, subPath: img }
            - { name: public-files, mountPath: /seed/images, subPath: images }
            - { name: public-files, mountPath: /seed/uploads, subPath: uploads }
            - { name: public-files, mountPath: /seed/pdf, subPath: pdf }
          resources:
            requests:
              cpu: 25m
              memory: 64Mi
            limits:
              cpu: 250m
              memory: 128Mi
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
```

**(b)** Add `volumeMounts:` to the `frontend` container. Insert immediately after line 42 (`                name: gas-secrets`) and before `resources:` (line 43), at the container-field indentation (10 spaces):

```yaml
          volumeMounts:
            - { name: public-files, mountPath: /app/public/img, subPath: img }
            - { name: public-files, mountPath: /app/.output/public/img, subPath: img }
            - { name: public-files, mountPath: /app/public/images, subPath: images }
            - { name: public-files, mountPath: /app/.output/public/images, subPath: images }
            - { name: public-files, mountPath: /app/public/uploads, subPath: uploads }
            - { name: public-files, mountPath: /app/.output/public/uploads, subPath: uploads }
            - { name: public-files, mountPath: /app/public/pdf, subPath: pdf }
            - { name: public-files, mountPath: /app/.output/public/pdf, subPath: pdf }
```

**(c)** Add a `volumes:` block at the end of the pod `spec`, after the container's `securityContext` (after line 77), at the same indentation as `containers:` (6 spaces):

```yaml
      volumes:
        - name: public-files
          persistentVolumeClaim:
            claimName: gas-public-pvc
```

- [ ] **Step 2: Validate the modified Deployment**

Run:
```bash
kubectl create --dry-run=client -o yaml -f k8s/frontend/deployment.yaml >/dev/null && echo OK
```
Expected: `OK`.

- [ ] **Step 3: Confirm the mount wiring with a quick structural check**

Run:
```bash
grep -c "public-files" k8s/frontend/deployment.yaml
```
Expected: `13` (1 volume + 4 init mounts + 8 container mounts).

- [ ] **Step 4: Commit**

```bash
git add k8s/frontend/deployment.yaml
git commit -m "feat(k8s): mount public files share + seed initContainer on frontend"
```

---

### Task 5: Wire provisioning into the deploy workflow

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Pass storage account secrets to the Apply Secrets step**

In the `Apply Secrets` step's `env:` block, add two lines after `MYSQL_ROOT_PASSWORD: ${{ secrets.MYSQL_ROOT_PASSWORD }}`:

```yaml
          AZURE_STORAGE_ACCOUNT_NAME: ${{ secrets.AZURE_STORAGE_ACCOUNT_NAME }}
          AZURE_STORAGE_ACCOUNT_KEY: ${{ secrets.AZURE_STORAGE_ACCOUNT_KEY }}
```

(No change to the `run:` line — `envsubst < k8s/config/secrets.yaml` now also fills the new Secret.)

- [ ] **Step 2: Add an "Apply storage (PV/PVC)" step before "Apply frontend"**

Insert this step immediately before the existing `- name: Apply frontend` step:

```yaml
      - name: Apply storage (PV/PVC)
        run: |
          kubectl apply -f k8s/storage/public-files.yaml
          kubectl wait --for=jsonpath='{.status.phase}'=Bound \
            pvc/gas-public-pvc -n gas --timeout=60s
```

- [ ] **Step 3: Validate the workflow YAML parses**

Run:
```bash
python3 -c "import yaml,sys; list(yaml.safe_load_all(open('.github/workflows/deploy.yml'))); print('OK')"
```
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci(k8s): provision public files secret + PV/PVC in deploy pipeline"
```

---

### Task 6: Documentation

**Files:**
- Modify: `k8s/.env.example`
- Modify: `k8s/README.md`

- [ ] **Step 1: Document the storage env vars in `k8s/.env.example`**

Append:

```bash
# --- Persistent storage (Azure Files share for public/ served files) ---
# Storage account + access key backing the gas-public file share.
# Used to template azure-storage-secret in k8s/config/secrets.yaml.
AZURE_STORAGE_ACCOUNT_NAME=
AZURE_STORAGE_ACCOUNT_KEY=
```

- [ ] **Step 2: Add a provisioning runbook section to `k8s/README.md`**

Add a section titled `## Persistent storage for public files` containing:

````markdown
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
`uploads` assets into the share on first run (`cp` no-clobber), so committed
static files survive the overlay and runtime uploads are never overwritten.
Reclaim policy is `Retain`: deleting the PVC/PV leaves the share intact.
````

- [ ] **Step 3: Commit**

```bash
git add k8s/.env.example k8s/README.md
git commit -m "docs(k8s): document Azure Files provisioning for public storage"
```

---

### Task 7: Post-deploy verification (operator, against the cluster)

These run after the change is deployed to a cluster (not locally). They map 1:1 to the spec's acceptance criteria. Record results.

- [ ] **Step 1: PVC binds and pods start**

```bash
kubectl get pvc gas-public-pvc -n gas          # STATUS Bound
kubectl get pods -n gas -l app.kubernetes.io/name=gas-frontend   # Running, all replicas Ready
kubectl logs -n gas <a-frontend-pod> -c seed-public              # no errors
```
Expected: PVC `Bound`; pods `Running`; init logs clean.

- [ ] **Step 2: Static baked assets still render (seeding worked)**

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' https://audit.gov.gh/img/<a-known-img-file>
```
Expected: `200`.

- [ ] **Step 3: Cross-replica consistency (upload on one pod, read via another)**

Upload a file through the admin UI (or API), then with the frontend scaled to ≥2 replicas, fetch its URL repeatedly so different pods serve it:

```bash
for i in $(seq 1 10); do curl -fsS -o /dev/null -w '%{http_code} ' https://audit.gov.gh/<uploaded-file-url>; done; echo
```
Expected: all `200` (no `404` from a replica that didn't handle the upload).

- [ ] **Step 4: Report PDF round-trip**

Upload a report PDF, then download it via `/api/downloads/reports/<id>`.
Expected: `200` and correct bytes.

- [ ] **Step 5: Persistence across restart**

```bash
kubectl rollout restart deployment/gas-frontend -n gas
kubectl rollout status deployment/gas-frontend -n gas
# re-fetch the uploaded file URL from Step 3
```
Expected: file still served `200` after restart.

- [ ] **Step 6: Confirm no application source changed**

```bash
git diff --stat main HEAD -- ghana-audit-service/ | tail -1
```
Expected: empty (this work touches only `k8s/`, `.github/`, and `docs/`).

---

## Self-review notes

- **Spec coverage:** secret (Task 1), PV+PVC (Task 2), seed logic (Task 3), 8 mounts + initContainer + volume (Task 4), deploy ordering (Task 5), docs (Task 6), all 6 acceptance criteria (Task 7). No NetworkPolicy change required (per spec rationale). Covered.
- **No placeholders:** every manifest/script is shown in full; the only `<...>` tokens are operator-supplied Azure identifiers in the runbook, which are inherently per-environment.
- **Naming consistency:** `gas-public-pv`, `gas-public-pvc`, `azure-storage-secret`, volume name `public-files`, share `gas-public`, subPaths `img/images/uploads/pdf` are used identically across Tasks 1–7.
