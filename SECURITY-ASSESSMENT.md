# Security Assessment — Ghana Audit Service

**Date:** 2026-06-16
**Scope:** Full application + infrastructure (monorepo at repo root)
**Type:** Static source-code review + dependency vulnerability audit (`npm audit`)
**Assessor:** Automated security review (Claude Code)

---

## 1. Executive Summary

The Ghana Audit Service demonstrates a **mature, well-architected security posture**. The
authentication stack (dual-layer JWT + server-side session), role/module-based access
control, CSRF protection, parameterized data access, output sanitization, and hardened
Kubernetes deployment are all implemented to a good standard. No **critical** code-level
vulnerabilities were found.

The findings below are **hardening opportunities and configuration risks** rather than
actively exploitable holes. The most material items are: an overly permissive Content
Security Policy, unauthenticated Redis, a fail-open analytics IP-salt fallback, the absence
of automated security scanning in CI/CD, and a set of dependency advisories (mostly in
build-time tooling).

### Severity rollup (code/config findings)

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 0 |
| Medium   | 6 |
| Low      | 5 |

### Dependency audit rollup (`npm audit`)

| Scope | Critical | High | Moderate | Low | Total |
|-------|----------|------|----------|-----|-------|
| All dependencies | 0 | 15 | 3 | 1 | 19 |
| Production only (`--omit=dev`) | 0 | 11 | 3 | 1 | 15 |

> Severity calibration: several individual checks initially flagged "high" are reported
> here at Medium/Low because compensating controls exist (e.g. DOMPurify offsets the CSP
> weakness; Kubernetes NetworkPolicies offset unauthenticated Redis). Rationale is stated
> per finding.

---

## 2. Scope & Methodology

**Reviewed:**
- Application: `ghana-audit-service/` — Nuxt 3 frontend, Nitro server (`server/api`,
  `server/middleware`, `server/utils`), Drizzle/MySQL data layer (`server/database`).
- Orchestration: `docker-compose.yml`.
- Kubernetes manifests: `k8s/` (frontend, MySQL, Redis, network policies, secrets, ingress).
- CI/CD: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`.
- Configuration: root and app `.env.example`, `nuxt.config.ts`, `Dockerfile`.
- Dependencies: `package.json` / `package-lock.json` via `npm audit`.

**Methodology:** Read-only static analysis of source, configuration, and infrastructure,
plus a live dependency vulnerability scan. Findings cite `file:line` anchors.

**Out of scope (per engagement):** No dynamic testing / penetration testing, no probing of
a running instance, no infrastructure-live review (cloud IAM, WAF, DNS), no secrets
inventory of the live environment.

---

## 3. Findings Summary

| ID | Finding | Severity | Area | Location |
|----|---------|----------|------|----------|
| M-1 | CSP allows `'unsafe-inline'` and `'unsafe-eval'` in `script-src` | Medium | Web/Headers | `ghana-audit-service/nuxt.config.ts:404` |
| M-2 | Redis runs without authentication; DB/Redis ports exposed in compose | Medium | Infra | `k8s/redis/deployment.yaml:45`, `docker-compose.yml:83,123` |
| M-3 | Analytics IP-salt fails open to unsalted (reversible) hashing | Medium | Privacy | `ghana-audit-service/server/utils/analytics/fingerprint.ts:19,25` |
| M-4 | Open redirect via stored publication `fileUrl` | Medium | Web | `ghana-audit-service/server/api/downloads/publications/[id].get.ts:72` |
| M-5 | No SAST / dependency / image scanning or approval gate in CI/CD | Medium | CI/CD | `.github/workflows/ci.yml`, `deploy.yml` |
| M-6 | No account lockout on login (per-IP rate limit only) | Medium | Auth | `ghana-audit-service/server/api/admin/auth/login.post.ts:34` |
| L-1 | JWT verification does not pin `algorithms` | Low | Auth | `ghana-audit-service/server/utils/jwt.ts:55` |
| L-2 | SSE auth token passed via query string | Low | Auth | `ghana-audit-service/server/middleware/adminAuth.ts:48,69` |
| L-3 | Contact `message` stored unescaped (display-time sanitized) | Low | Web | `ghana-audit-service/server/api/contact.post.ts:131` |
| L-4 | Config-dependent hardening (CSP `data:`, Redis-less rate-limit fallback, `TRUSTED_PROXIES`) | Low | Infra | `nuxt.config.ts:405`, `server/utils/rateLimiter.ts` |
| L-5 | Weak placeholder default secrets in examples/compose | Low | Config | `.env.example`, `docker-compose.yml` |

---

## 4. Detailed Findings

### Medium

#### M-1 — CSP allows `'unsafe-inline'` and `'unsafe-eval'`
**Location:** `ghana-audit-service/nuxt.config.ts:404-405`
**Description:** The Content-Security-Policy header sets
`script-src 'self' 'unsafe-inline' 'unsafe-eval'` and `style-src 'self' 'unsafe-inline'`.
`'unsafe-inline'`/`'unsafe-eval'` allow inline scripts and dynamic evaluation, which
significantly weakens CSP as an XSS mitigation layer.
**Impact:** If a stored/reflected XSS sink were ever introduced, CSP would not block it.
**Mitigating controls:** All user-supplied HTML is rendered through DOMPurify
(`isomorphic-dompurify`, see `utils/sanitizeHtml.ts`), `connect-src` is locked to `'self'`,
and no third-party script origins are allowed — so the practical XSS exposure today is low.
**Recommendation:** Move toward a nonce/hash-based CSP for inline scripts and drop
`'unsafe-eval'` where the Nuxt/Vue runtime permits. Track as a hardening item; verify in a
staging build because Vue's runtime compiler may require `'unsafe-eval'` in some modes.

#### M-2 — Redis without authentication; DB/Redis ports exposed in Docker Compose
**Location:** `k8s/redis/deployment.yaml:45-46` (no `--requirepass`); `docker-compose.yml:83`
(`3306:3306` MySQL), `docker-compose.yml:123` (`6479:6379` Redis)
**Description:** The Redis server starts without a password. Redis backs admin sessions'
rate-limit counters and the analytics buffer. In Docker Compose, MySQL and Redis ports are
published to the host.
**Impact:** Any workload able to reach Redis on the pod network can read/modify rate-limit
state and the analytics buffer. The compose port exposure makes MySQL/Redis reachable from
the developer host (and anything that host routes to).
**Mitigating controls:** Kubernetes `NetworkPolicy` is default-deny ingress and only allows
the frontend pod to reach Redis (`k8s/network/network-policies.yaml`), which substantially
contains the k8s risk. The compose exposure is local-development only.
**Recommendation:** Set `--requirepass` (sourced from a secret) on Redis and configure the
`ioredis` client accordingly; consider Redis TLS for defense-in-depth. For non-dev compose
usage, remove the host port mappings or bind them to `127.0.0.1` only.

#### M-3 — Analytics IP-salt fails open to unsalted hashing
**Location:** `ghana-audit-service/server/utils/analytics/fingerprint.ts:19,25,40`
**Description:** `getIpSalt()` reads `process.env.ANALYTICS_IP_SALT || ''` and, when unset,
only emits `console.warn(... 'IP hashes will be unsalted')` before proceeding. `hashIp()`
then computes `sha256(ip|salt)` with an empty salt.
**Impact:** Unsalted `sha256(ip)` is trivially reversible via precomputed/rainbow tables
(the IPv4 space is enumerable). This defeats the system's privacy guarantee that raw IPs are
never recoverable, with potential data-protection implications for a government service.
**Recommendation:** Fail-fast at server boot in production if `ANALYTICS_IP_SALT` is unset
or shorter than ~32 bytes (a Nitro startup plugin), rather than warning and continuing.

#### M-4 — Open redirect via stored publication `fileUrl`
**Location:** `ghana-audit-service/server/api/downloads/publications/[id].get.ts:72`
**Description:** When a publication's `fileUrl` is an absolute `http(s)` URL, the endpoint
issues `sendRedirect(event, publication.fileUrl, 302)` without validating the destination
host.
**Impact:** A public download link could redirect users to an arbitrary external site
(phishing / token leakage via `Referer`). Exploitation requires writing a malicious
`fileUrl`, which is gated behind authenticated admin/editor access — so this is primarily a
post-compromise amplification, not an unauthenticated open redirect.
**Recommendation:** Validate the redirect target against an allowlist of expected hosts
(e.g. the Azure Blob storage account / organization domains) before redirecting.

#### M-5 — No automated security scanning or approval gate in CI/CD
**Location:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
**Description:** The CI quality gate runs typecheck, lint, test, and build, but no security
tooling. There is no dependency scan (`npm audit`), no SAST (CodeQL/Snyk), no container
image scan (Trivy/Grype), and `deploy.yml` auto-deploys on push to `main` with no manual
approval gate. (Confirmed: a grep for `trivy|npm audit|codeql|snyk|grype` over
`.github/workflows/` returns nothing.)
**Impact:** Vulnerable dependencies or base-image CVEs can reach production undetected;
any merge to `main` ships automatically.
**Recommendation:** Add `npm audit --audit-level=high` (or Snyk) and CodeQL to CI; add
Trivy image scanning to `deploy.yml` before push; gate production deploys with a GitHub
Environment protection rule (manual approval). Secret handling (OIDC, `id-token: write`,
secrets-scoped env) is already done well.

#### M-6 — No account lockout on login
**Location:** `ghana-audit-service/server/api/admin/auth/login.post.ts:34-35`
**Description:** Login is protected by per-IP rate limiting (5 attempts / 15 minutes) but
there is no per-account lockout or progressive delay.
**Impact:** A distributed attacker (many source IPs) could still attempt credential
stuffing/brute force against a known account, since the limit is keyed on IP, not account.
**Mitigating controls:** bcrypt (cost 12), generic error messages (no user enumeration),
strong password policy, and full audit logging of failed logins are all in place.
**Recommendation:** Add a temporary per-account lockout (e.g. exponential backoff after N
failures within a window) and/or CAPTCHA after repeated failures.

### Low

#### L-1 — JWT verification does not pin `algorithms`
**Location:** `ghana-audit-service/server/utils/jwt.ts:45,55`
**Description:** `jwt.verify(token, secret)` is called without an explicit
`{ algorithms: ['HS256'] }` option.
**Impact:** Low. The secret is a symmetric HMAC key and `jsonwebtoken` v9 rejects `alg: none`
by default, so classic algorithm-confusion is not exploitable here. Pinning is a
defense-in-depth best practice.
**Recommendation:** Pass `{ algorithms: ['HS256'] }` to both sign and verify.

#### L-2 — SSE auth token passed via query string
**Location:** `ghana-audit-service/server/middleware/adminAuth.ts:48,69-71`
**Description:** For `QUERY_TOKEN_ROUTES` (`/api/admin/reports/optimize-stream`), the bearer
token is accepted from `?token=` because `EventSource` cannot set headers.
**Impact:** Tokens in URLs can leak via access logs, proxies, and browser history.
**Mitigating controls:** The allowlist contains exactly one route, and tokens are short-lived
session-bound JWTs.
**Recommendation:** Keep the allowlist minimal (already done); consider a single-use,
short-TTL SSE ticket instead of the full session token.

#### L-3 — Contact `message` stored without escaping
**Location:** `ghana-audit-service/server/api/contact.post.ts:131`
**Description:** Unlike name/email/subject (which are `validator.escape()`d), the message
body is stored as-is (`const sanitizedMessage = message`).
**Impact:** Low — stored content is sanitized at display time via DOMPurify, so this is a
defense-in-depth gap rather than a stored-XSS vulnerability. Risk would materialize only if
a future consumer renders the field without sanitization.
**Recommendation:** Document the output-escaping dependency, or escape/sanitize on storage as
well so the stored value is safe regardless of the rendering path.

#### L-4 — Config-dependent hardening notes
- **CSP `img-src data:`** (`nuxt.config.ts:405`) — permits data-URI images; minor
  exfiltration surface. Remove if not required.
- **Rate-limiter single-instance fallback** (`server/utils/rateLimiter.ts`) — without
  `REDIS_URL`, limits are per-process, so a multi-replica deployment without Redis would not
  share counters. Require Redis in production.
- **`TRUSTED_PROXIES`** — client-IP derivation trusts `X-Forwarded-For` only from configured
  proxies; if unset behind a load balancer, rate limiting keys on the LB IP. Document as a
  required production env var.

#### L-5 — Weak placeholder default secrets
**Location:** `.env.example` (root and app), `docker-compose.yml`
**Description:** Example/compose defaults such as `JWT_SECRET`/`NUXT_API_SECRET`/
`ANALYTICS_IP_SALT` placeholders and `ADMIN_PASSWORD=change-this-password` are insecure by
design and rely on operators overriding them.
**Impact:** Informational — only a risk if defaults reach a real environment. Source code
correctly requires `JWT_SECRET` at runtime (throws if missing) and contains no hardcoded
secrets.
**Recommendation:** Enforce strong secret generation in the deploy runbook; ensure the seed
script (which consumes `ADMIN_PASSWORD`) never runs against production.

---

## 5. Dependency Vulnerability Audit

`npm audit` (run 2026-06-16) across 1,757 dependencies reported **19 advisories
(15 high, 3 moderate, 1 low, 0 critical)**; **15** affect the production tree.

### Build-time tooling (not runtime-exploitable in the deployed artifact)
The bulk of the "high" advisories are in the dev/build toolchain and the Nuxt i18n chain;
they execute at build time, not in the running server:
- **esbuild** — `GHSA-gv7w-rqvm-qjhr` (binary integrity / RCE via `NPM_CONFIG_REGISTRY`,
  CVSS 8.1) — reachable only in a Deno install context during builds.
- **vite**, **nuxt**, **nitropack**, **@nuxt/vite-builder**, **@nuxt/nitro-server**, **tsx** —
  transitively depend on the affected `esbuild`/build packages.
- **@nuxtjs/i18n** → **@intlify/unplugin-vue-i18n** → **@intlify/bundle-utils** — fix
  requires a **semver-major** bump (`@nuxtjs/i18n` 10.x). Per `CLAUDE.md`, major upgrades are
  intentionally deferred and need explicit approval.
- **@babel/core** (low) — arbitrary file read via `sourceMappingURL` (build-time).

**Recommendation:** Track these; schedule the `@nuxtjs/i18n` major upgrade as a separate,
tested change. Because they are build-time, the runtime risk to the deployed app is low.

### Runtime-relevant (fixable without breaking changes)
- **nodemailer ≤ 8.0.8** (moderate, **direct dep**, used by `server/utils/email.ts`) —
  CRLF header injection (`GHSA-268h-hp4c-crq3`), improper TLS cert validation in OAuth2
  token fetch (`GHSA-r7g4-qg5f-qqm2`), jsonTransport file/URL access bypass. **Most relevant
  finding here** since it runs server-side on contact/newsletter flows.
- **ws** (high) — memory-exhaustion DoS (`GHSA-96hv-2xvq-fx4p`), transitive.
- **js-yaml ≤ 4.1.1** (moderate) — quadratic-complexity DoS, transitive.
- **launch-editor** (moderate) — Windows-only NTLM hash disclosure (dev tooling).

**Recommendation:** Run `npm audit fix` (non-breaking) to remediate nodemailer, ws, js-yaml,
and launch-editor, then re-run the full quality gate (`typecheck`, `lint`, `test:run`) per
`CLAUDE.md`. Add `npm audit` to CI to catch regressions (see M-5).

---

## 6. Security Strengths

The following controls are implemented well and should be preserved:

- **Authentication:** bcrypt (cost 12) + strong password policy; **dual-layer** auth —
  signed JWT *and* a server-side session row validated on every request, with idle +
  absolute timeouts and revocation (`server/utils/sessions.ts`). JWT lifetime is pinned to
  the session's absolute timeout.
- **Authorization:** role + module-based access control enforced centrally in
  `server/middleware/adminAuth.ts`; user re-checked active and non-deleted on each request;
  admin-only routes guarded by `requireAdmin()`.
- **CSRF:** double-submit token, HttpOnly + Secure + `SameSite=strict` cookie, constant-time
  comparison; enforced on public mutating routes.
- **Injection:** Drizzle ORM parameterization throughout; `LIKE` wildcards escaped via
  `escapeLike()`; Zod schema validation + `validator` sanitization on inputs.
- **XSS:** DOMPurify (`sanitizeHtml.ts`) on all `v-html`, with link hardening
  (`rel="noopener noreferrer"`).
- **File handling:** MIME-type allowlists and size limits on uploads; path-traversal guards
  in `publicFiles.ts` / `blobStorage.ts`; direct `/public/uploads/**` access blocked to force
  metered download endpoints.
- **Privacy/telemetry:** raw IPs never stored (hashed); fuzz/probing detection with
  deduplicated incident recording.
- **Infrastructure:** non-root containers (UID 1001/999), `allowPrivilegeEscalation: false`,
  `capabilities: drop: [ALL]`, `seccompProfile: RuntimeDefault`, resource limits,
  `readOnlyRootFilesystem` on init containers, default-deny `NetworkPolicy` with explicit
  per-service allows, cert-manager TLS, HSTS (1 year) and the standard security-header set.
- **CI/CD:** least-privilege workflow permissions, OIDC-based auth, secrets scoped to the
  `production` environment and never logged.
- **Auditability:** login attempts (success/failure) and content mutations are audit-logged.

---

## 7. Prioritized Recommendations

| Priority | Action | Finding | Effort |
|----------|--------|---------|--------|
| 1 | Fail-fast on missing/short `ANALYTICS_IP_SALT` in production | M-3 | Low |
| 2 | Run `npm audit fix` (nodemailer/ws/js-yaml/launch-editor); re-run quality gate | §5 | Low |
| 3 | Set Redis `--requirepass`; bind compose DB/Redis ports to localhost | M-2 | Low |
| 4 | Add allowlist validation to publication redirect | M-4 | Low |
| 5 | Add `npm audit` + CodeQL to CI, Trivy to deploy, approval gate on prod | M-5 | Medium |
| 6 | Add per-account login lockout / backoff | M-6 | Medium |
| 7 | Pin JWT `algorithms: ['HS256']` | L-1 | Low |
| 8 | Tighten CSP toward nonce/hash; drop `'unsafe-eval'`/`data:` where possible | M-1, L-4 | Medium |
| 9 | Schedule `@nuxtjs/i18n` major upgrade (deferred deps) | §5 | High |
| 10 | Sanitize contact `message` on storage; minimize SSE query-token allowlist | L-3, L-2 | Low |

---

## 8. Appendix — Controls Inventory

| Control | Status | Reference |
|---------|--------|-----------|
| Password hashing | bcrypt cost 12 | `server/utils/password.ts` |
| Session model | Server-side + JWT, idle/absolute timeout, revocation | `server/utils/sessions.ts` |
| AuthZ | Role + module RBAC, active-user recheck | `server/middleware/adminAuth.ts` |
| CSRF | Double-submit, HttpOnly/Secure/SameSite=strict | `server/utils/csrf.ts` |
| Rate limiting | Redis-backed, per-route buckets, trusted-proxy aware | `server/utils/rateLimiter.ts` |
| Input validation | Zod + `validator` | `server/utils/validation.ts` |
| Output sanitization | DOMPurify | `utils/sanitizeHtml.ts` |
| SQL injection | Drizzle parameterized + `escapeLike()` | `server/utils/searchService.ts` |
| Path traversal | `..`/leading-slash rejection | `server/utils/publicFiles.ts` |
| Security headers | HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, CSP | `nuxt.config.ts:394-407` |
| Container hardening | non-root, drop ALL caps, no privesc, seccomp RuntimeDefault | `k8s/frontend/deployment.yaml` |
| Network policy | Default-deny ingress, explicit allows | `k8s/network/network-policies.yaml` |
| TLS | cert-manager | `k8s/frontend/ingress.yaml` |
| Audit logging | Logins + mutations | `server/database/schema` (auditLogs) |

---

*This report is based on read-only static analysis and a dependency scan as of 2026-06-16.
No application code was modified. Dynamic/penetration testing was out of scope.*
