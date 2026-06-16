# Security TODO & Manual Steps

Running tracker for outstanding security work and manual actions, kept alongside
`SECURITY-ASSESSMENT.md`. Claude appends new items here each session; the user works
through them later. Check items off (`[x]`) as they're completed.

Status legend: 🔴 not started · 🟡 in progress · 🟢 done (kept for history)

---

## 1. Manual steps — action required by you (cannot be automated by Claude)

- [ ] 🔴 **Create the `REDIS_PASSWORD` GitHub Actions secret** on the **`production`**
  environment (from M-2). Until set, `envsubst` renders an empty password and **Redis runs
  without authentication** — the deploy still succeeds, but the protection is off.
  ```bash
  gh secret set REDIS_PASSWORD --env production --body "$(openssl rand -hex 32)"
  ```
  After setting it, redeploy (or re-apply secrets + restart the redis Deployment) so the new
  password takes effect. Ref: `k8s/README.md`, `SECURITY-ASSESSMENT.md` (M-2).

- [ ] 🔴 **Enable the deploy approval gate (M-5).** In **Settings → Environments →
  production → Required reviewers**, add reviewer(s). The `build-and-push` and `deploy` jobs
  already run in the `production` environment, so this makes production deploys pause for
  manual approval. No code change needed.
- [ ] 🔴 **If the repo is private, enable GitHub Advanced Security (M-5)** so the new
  `codeql.yml` workflow can run (CodeQL on private repos requires GHAS; on public repos it
  works as-is).

---

## 2. Pre-production verification (residual risk on already-merged fixes)

These changes passed the quality gate but were **not** validated at runtime (per chosen
verification scope). Validate before/at production rollout.

- [ ] 🔴 **CSP browser smoke test (M-1).** Load the site with the new nonce-based CSP and
  watch the browser console for CSP violations: home page, a news/publication detail page
  **with an embedded YouTube video**, and toggle dark mode (color-mode inline script). Fix
  any `Refused to …` violations by adjusting the `security.headers.contentSecurityPolicy`
  block in `ghana-audit-service/nuxt.config.ts`.
- [ ] 🔴 **Redis auth on a live cluster (M-2).** Confirm: the redis pod becomes Ready
  (probes authenticate via `REDISCLI_AUTH`), the frontend connects with the authenticated
  `REDIS_URL`, and an unauthenticated `redis-cli` is rejected (`NOAUTH`). Confirm rate
  limiting + analytics dedup still use Redis (not the in-process fallback).

---

## 3. Open security findings (from SECURITY-ASSESSMENT.md — not yet implemented)

### Medium
- [ ] 🔴 **M-3 — Fail-fast on missing `ANALYTICS_IP_SALT`.** `fingerprint.ts` only warns,
  then hashes IPs unsalted (reversible). Add a boot-time check (Nitro plugin) that errors in
  production if the salt is unset/short. *(Good next quick win.)*
### Low
- [ ] 🔴 **L-1 — Pin JWT `algorithms: ['HS256']`** in `server/utils/jwt.ts` sign/verify.
- [ ] 🔴 **L-2 — Keep the SSE query-token allowlist minimal** (`adminAuth.ts`
  `QUERY_TOKEN_ROUTES`); consider a single-use short-TTL SSE ticket instead of the session JWT.
- [ ] 🔴 **L-3 — Sanitize the contact `message` on storage** (`contact.post.ts`), so it's
  safe regardless of the rendering path (currently relies on display-time DOMPurify).
- [ ] 🔴 **L-4 — CSP/config hardening:** drop `data:` from `img-src` if unneeded; require
  Redis in production (rate-limiter is per-process without it); ensure `TRUSTED_PROXIES` is
  set behind the load balancer.
- [ ] 🔴 **L-5 — Replace weak placeholder default secrets** in `.env.example` /
  `docker-compose.yml`; ensure prod overrides and that the seed (with `ADMIN_PASSWORD`) never
  runs against production.

### Future hardening
- [ ] 🔴 **Redis TLS** (defense-in-depth on top of M-2's `requirepass`).

---

## 4. Dependency maintenance (from the npm audit, 2026-06-16)

- [ ] 🔴 **Run `npm audit fix`** (non-breaking) for runtime-relevant advisories:
  **nodemailer** (CRLF header injection + TLS validation), **ws** (DoS), **js-yaml** (DoS),
  **launch-editor**. Then re-run the full quality gate.
- [ ] 🔴 **Schedule the `@nuxtjs/i18n` major upgrade** (10.x) to clear the build-time
  esbuild/vite/i18n highs — deferred per `CLAUDE.md` dependency policy; needs explicit
  approval + testing.

---

## 5. Completed this session (history)

- [x] 🟢 **M-1 — Nonce-based CSP.** Integrated `nuxt-security`; served `script-src` is now
  `'self' 'nonce-{{nonce}}'` (removed `'unsafe-inline'` + `'unsafe-eval'`). Commit `5712620`.
- [x] 🟢 **M-2 — Redis auth (k8s) + loopback-bound compose ports.** Commit `0e48896`.
  *(Manual `REDIS_PASSWORD` secret still required — see §1.)*
- [x] 🟢 **M-4 — Allowlisted publication-download redirect** (`server/utils/downloadRedirect.ts`
  + unit test). Disallowed hosts now 404. *(M-3 skipped for now, still open in §3.)*
- [x] 🟢 **M-5 — CI/CD security scanning.** npm audit (fail-on-critical) in `ci.yml`, Trivy
  image scan in `deploy.yml`, new `codeql.yml`. *(Two manual follow-ups in §1: enable
  Required reviewers; enable GHAS if the repo is private.)*
- [x] 🟢 **M-6 — Per-account login lockout** (`server/utils/loginLockout.ts` + `users` columns,
  migration `0001`). 10 fails/15m → exponential backoff (15m→…→24h cap), env-configurable.
  *Optional follow-up:* an admin "unlock account" action (clear the lockout columns) — not
  required since locks auto-expire and a successful login resets them.
- [x] 🟢 **Security assessment report** (`SECURITY-ASSESSMENT.md`). Commit `65f1ff0`.
