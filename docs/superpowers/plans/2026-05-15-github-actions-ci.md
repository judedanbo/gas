# GitHub Actions CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions workflow that runs typecheck, lint, test, and build on every push to `main` and every PR targeting `main`.

**Architecture:** Single workflow file with one job (`quality-gate`) that runs four npm scripts sequentially in the `ghana-audit-service/` subdirectory. Node version pinned via `.nvmrc`, npm cache via `actions/setup-node`, concurrency group cancels stale PR runs.

**Tech Stack:** GitHub Actions, Node 24 LTS, npm, vue-tsc, ESLint, Vitest, Nuxt build

---

### Task 1: Create `.nvmrc`

**Files:**
- Create: `.nvmrc`

- [ ] **Step 1: Create the `.nvmrc` file at the repo root**

```
24
```

This single-line file pins Node 24 LTS for both CI (`actions/setup-node` reads it via `node-version-file`) and local dev (`nvm use` reads it automatically).

- [ ] **Step 2: Verify nvm recognizes it**

Run: `cat .nvmrc`
Expected: `24`

- [ ] **Step 3: Commit**

```bash
git add .nvmrc
git commit -m "chore: pin Node 24 LTS via .nvmrc"
```

---

### Task 2: Create the CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

jobs:
  quality-gate:
    name: Quality Gate
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ghana-audit-service

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
          cache-dependency-path: ghana-audit-service/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm run test:run

      - name: Build
        run: npm run build
```

Key details:
- `defaults.run.working-directory: ghana-audit-service` applies to all `run` steps, so each `npm` command executes in the app directory.
- `cache-dependency-path` points to the subdirectory lockfile since `setup-node` defaults to looking at the repo root.
- `cancel-in-progress` is `true` only for non-main refs (PRs), so pushes to `main` always complete.

- [ ] **Step 3: Validate the YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "YAML valid"`
Expected: `YAML valid`

If `python3` or `pyyaml` are not available, use: `npx yaml-lint .github/workflows/ci.yml` or visually confirm the indentation is consistent (2-space, no tabs).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add quality-gate workflow for typecheck, lint, test, and build"
```

---

### Task 3: Verify the workflow locally (smoke test)

This task confirms the four commands work in sequence on the current codebase before pushing to trigger CI.

**Files:** None (read-only verification)

- [ ] **Step 1: Run typecheck**

Run from `ghana-audit-service/`:
```bash
npm run typecheck
```
Expected: exits 0 with no errors.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```
Expected: exits 0 with no errors (or only warnings).

- [ ] **Step 3: Run tests**

```bash
npm run test:run
```
Expected: exits 0, all tests pass. No database connection required (tests mock DB access).

- [ ] **Step 4: Run build**

```bash
npm run build
```
Expected: exits 0, Nuxt production build completes.

- [ ] **Step 5: If any step fails, fix the issue before pushing**

Failures here will also fail in CI. Fix them now — the goal is that the first CI run is green.

---

### Task 4: Push and verify CI runs

- [ ] **Step 1: Push to remote**

```bash
git push origin main
```

- [ ] **Step 2: Verify the workflow appears in GitHub Actions**

Go to the repository's Actions tab (or run `gh run list --limit 1`). Confirm a "CI" workflow run has started on the `main` branch.

- [ ] **Step 3: Verify the run completes successfully**

```bash
gh run watch --exit-status
```

Expected: all steps (Checkout, Setup Node, Install, Typecheck, Lint, Test, Build) pass with green checkmarks.

- [ ] **Step 4: If the run fails, read the logs and fix**

```bash
gh run view --log-failed
```

Common issues:
- **Node version not found**: check `.nvmrc` contains just `24` with no trailing whitespace.
- **npm ci fails**: `package-lock.json` may be out of sync — run `npm install` locally and commit the updated lockfile.
- **Typecheck/lint/test failures**: fix locally, commit, push again.
