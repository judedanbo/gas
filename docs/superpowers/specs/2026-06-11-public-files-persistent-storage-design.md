# Persistent Storage for `public/` Served Files — Design

**Date:** 2026-06-11
**Status:** Approved (design)
**Scope:** Kubernetes / AKS deployment only. No application logic changes.

## Problem

The frontend Deployment runs 2–5 replicas (HPA) with **no persistent storage**. Four
directories under `public/` hold files that are either runtime-mutable or that the
operator wants to manage at runtime without redeploying:

| Directory | Git-tracked | Nature today |
|---|---|---|
| `public/img` | 630 files | Static site assets, baked into the image at build |
| `public/images` | 21 files | Static site assets, baked into the image at build |
| `public/uploads` | 49 seed files | Runtime-written by `fileUpload.ts` (`publications/`, `images/`, `thumbnails/` subdirs) |
| `public/pdf` | runtime | Runtime-written — report PDFs land in `public/pdf/reports/` |

Consequences on the current (ephemeral) setup:

1. Admin-uploaded files and generated report PDFs live on a single pod's ephemeral
   disk — invisible to the other replicas and lost on restart/reschedule.
2. There is a latent path mismatch: the app **writes** to cwd `/app/public/...`
   (`fileUpload.ts`, `generateThumbnail.ts` both resolve against `process.cwd()`),
   but Nitro **serves static** files from `/app/.output/public/...`. Runtime-written
   images served by static URL (e.g. `/uploads/images/x.jpg`) are therefore not
   reliably served in production.

**Goal:** all four directories are backed by shared persistent storage, writable by
every replica, served correctly in production, and managed at runtime — with the
651 committed static files preserved.

## Decisions (from brainstorming)

- **Manage all four at runtime** on persistent storage (not just `uploads`/`pdf`).
- **Static PV + PVC** backed by **Azure Files** (not dynamic provisioning), per the
  operator's explicit "PV and PVC" request and to allow pre-loading via Azure tooling.
- **One Azure File share** (`gas-public`) with four subdirectories, mounted via
  `subPath` (not four separate shares).
- **Approach A**: mount the share at **both** the write path and the static-serve
  path; seed baked static assets via an initContainer. **No application code changes.**

## Constraints that drove the design

- **Multi-replica → ReadWriteMany.** Azure Disk (`managed-csi`, the existing storage
  class) is `ReadWriteOnce` and cannot attach to multiple nodes. Sharing files across
  2–5 frontend replicas requires `ReadWriteMany`, i.e. **Azure Files** (`file.csi.azure.com`).
- **Container runs as uid/gid 1001** (`nuxtjs:nodejs`, non-root). Azure Files SMB does
  not honour `fsGroup`; the mount must set `uid=1001,gid=1001` (plus `file_mode`/`dir_mode`)
  via `mountOptions` or the process cannot write.
- **Overlay hides baked files.** A volume mounted over a path hides whatever the image
  baked there. The runner image contains `/app/.output/public/{img,images}` (the 651
  files) but has **no `/app/public`** (only `.output` is copied in). Seeding must read
  the baked copy from a path that is *not* overlaid.
- **Cannot mount over `.output/public` wholesale.** `/app/.output/public` also contains
  `_nuxt/` build chunks and favicons; overlaying the whole directory breaks the site.
  Mounts must be per-subdirectory via `subPath`.
- **Serving split is intentional.** PDFs under `/uploads/{reports,publications}/*.pdf`
  are blocked from direct static access (`BLOCKED_DIRECT_PATHS` in `staticAssets.ts`)
  and served via `/api/downloads/{type}/{id}`, which streams from disk using
  `resolvePublicAsset()` (checks both `/app/public/` and `/app/.output/public/`).
  Images/thumbnails are served as plain static files from `.output/public`.

## Architecture

### Azure resources (operator-provisioned prerequisites)

- Storage account (Standard, LRS), one File share **`gas-public`** with an initial
  quota (default **50Gi**).
- Kubernetes Secret **`azure-storage-secret`** in namespace `gas`:
  - `azurestorageaccountname`
  - `azurestorageaccountkey`

  Defined as a second `Secret` document in `k8s/config/secrets.yaml` (alongside
  `gas-secrets`), with values templated through `deploy.yml` via `envsubst` from
  GitHub Actions secrets — consistent with the existing secret-handling pattern.
  The CSI `nodeStageSecretRef` keys must be exactly `azurestorageaccountname` /
  `azurestorageaccountkey` (required names for the Azure File CSI driver).

### Storage objects (authored: `k8s/storage/public-files.yaml`)

**PersistentVolume `gas-public-pv`**
- `capacity.storage: 50Gi`
- `accessModes: [ReadWriteMany]`
- `storageClassName: ""` (static binding; no dynamic provisioner)
- `persistentVolumeReclaimPolicy: Retain`
- `csi:`
  - `driver: file.csi.azure.com`
  - `volumeHandle: gas-public-share` (cluster-unique, stable)
  - `volumeAttributes: { shareName: gas-public }`
  - `nodeStageSecretRef: { name: azure-storage-secret, namespace: gas }`
- `mountOptions: [dir_mode=0755, file_mode=0644, uid=1001, gid=1001, mfsymlinks, cache=strict, actimeo=30]`

**PersistentVolumeClaim `gas-public-pvc`** (namespace `gas`)
- `accessModes: [ReadWriteMany]`
- `storageClassName: ""`
- `volumeName: gas-public-pv` (binds to the static PV)
- `resources.requests.storage: 50Gi`

### Frontend Deployment changes (`k8s/frontend/deployment.yaml`)

**Volume** — one entry referencing the PVC:
```yaml
volumes:
  - name: public-files
    persistentVolumeClaim:
      claimName: gas-public-pvc
```

**initContainer `seed-public`** — reuses the frontend image. Mounts the PVC subPaths
at `/seed/<dir>` only (deliberately NOT over `.output/public`, so the baked source
remains readable), then no-clobber-copies baked assets into the share:
```sh
for d in img images uploads; do
  cp -rn /app/.output/public/$d/. /seed/$d/ 2>/dev/null || true
done
```
- `cp -rn` = recursive, never overwrite → runtime files survive; only missing baked
  files are added. Idempotent across restarts.
- `pdf` has no baked content, so it is not seeded.
- Runs as uid/gid 1001 (inherits pod `securityContext`).

**volumeMounts on the main container** — each of the four dirs mounted at both
locations via `subPath` (8 mounts total):
```yaml
volumeMounts:
  - { name: public-files, mountPath: /app/public/img,            subPath: img }
  - { name: public-files, mountPath: /app/.output/public/img,    subPath: img }
  - { name: public-files, mountPath: /app/public/images,         subPath: images }
  - { name: public-files, mountPath: /app/.output/public/images, subPath: images }
  - { name: public-files, mountPath: /app/public/uploads,        subPath: uploads }
  - { name: public-files, mountPath: /app/.output/public/uploads,subPath: uploads }
  - { name: public-files, mountPath: /app/public/pdf,            subPath: pdf }
  - { name: public-files, mountPath: /app/.output/public/pdf,    subPath: pdf }
```

### Data flow after deploy

| Operation | Path used | Resolves to |
|---|---|---|
| Admin upload / thumbnail / report PDF write | cwd `/app/public/<dir>` | share |
| Static serve (`/img/*`, `/uploads/images/*`) | Nitro reads `/app/.output/public/<dir>` | share |
| PDF download (`/api/downloads/...`) | `resolvePublicAsset` → `/app/public/<dir>` (first candidate) | share |

All replicas mount the same RWX share, so reads and writes are consistent across pods
and survive restarts/reschedules.

### Deploy ordering (`.github/workflows/deploy.yml`)

Insert before the "Apply frontend" step, after Secrets:
1. Apply `azure-storage-secret` (templated with `envsubst`).
2. Apply `k8s/storage/public-files.yaml` (PV + PVC).
3. Apply frontend (initContainer seeds, then pods become Ready).

## Why no NetworkPolicy change

The CIFS/SMB mount to Azure Files (port 445) is established by the node's kubelet /
CSI node plugin, not from within the pod's network namespace. Pod-scoped
NetworkPolicies (the existing default-deny set) do not govern it, so no egress rule is
required.

## Risks & trade-offs

- **Seeding runs every pod start.** `cp -rn` over ~651 files is an SMB stat sweep on
  each start (fast after the first fill, but non-zero). Acceptable; can later be
  guarded with a sentinel marker file if start latency matters.
- **Azure Files Standard (SMB) latency** is higher than local disk. Fine for
  documents/images; not suitable for hot/low-latency paths (none here).
- **8 subPath mounts** are verbose but mechanical; they exist because the write path
  (cwd `public`) and static-serve path (`.output/public`) differ and neither parent
  can be overlaid wholesale.
- **Secret management.** The storage account key is a long-lived credential in a
  Secret. Rotating it requires updating `azure-storage-secret` and restarting pods.
- **Reclaim policy `Retain`** means deleting the PVC/PV leaves the share intact
  (intentional — files must not be auto-deleted).

## Out of scope

- Migrating to Azure Blob object storage (Approach C) — larger app rewrite.
- Changing application write paths (Approach B).
- Backup of the `gas-public` share (separate concern; Azure Files snapshots can be
  enabled independently).

## Acceptance criteria

1. After deploy, a previously-uploaded image is served by a freshly-scaled replica
   that never handled the upload.
2. A file uploaded via one replica is downloadable through another replica.
3. `public/img` and `public/images` assets still render after the overlay (seeding
   succeeded).
4. Report PDFs upload and download correctly via `/api/downloads/...`.
5. Uploaded files persist across a full Deployment restart (`kubectl rollout restart`).
6. No application source files change.

## Files touched

| File | Change |
|---|---|
| `k8s/storage/public-files.yaml` | **New** — PV + PVC |
| `k8s/config/secrets.yaml` | Add `azure-storage-secret` as a second Secret document |
| `k8s/frontend/deployment.yaml` | Add volume, initContainer, 8 subPath mounts |
| `.github/workflows/deploy.yml` | Apply storage secret + PV/PVC before frontend |
| `k8s/.env.example` | Document storage account name/key vars |
| `k8s/README.md` | Provisioning runbook for the share + secret |
