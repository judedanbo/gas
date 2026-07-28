# Uptime Monitoring & Alerting

External monitoring for the Ghana Audit Service site, covering **both**
deployments:

| Environment  | URL                       |
| ------------ | ------------------------- |
| `test`       | https://test.audit.gov.gh |
| `production` | https://audit.gov.gh      |

The design has two layers:

1. **In-cluster self-healing (already in place)** — the k8s Deployment's
   startup/readiness/liveness probes (`k8s/frontend/deployment.yaml`) restart
   or de-route unhealthy pods automatically. This keeps the app up but is
   _invisible from outside_: it cannot detect DNS, ingress, TLS, or
   cluster-wide failures, and it alerts nobody.
2. **External uptime monitor (this document)** — a scheduled GitHub Actions
   workflow probes the public URLs from outside the cluster, exactly the way a
   citizen reaches the site, and sends alerts externally when a site goes down
   or recovers.

## The health endpoint: `GET /api/health`

`ghana-audit-service/server/api/health.get.ts` (logic in
`server/utils/health.ts`). Public, uncached (`Cache-Control: no-store`),
excluded from analytics capture.

| `status`   | HTTP | Meaning                                                                                                       |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------------- |
| `ok`       | 200  | Site and database healthy; Redis up or intentionally not configured.                                          |
| `degraded` | 200  | Site serving but a **configured** Redis is unreachable (rate limiting/analytics fall back per-instance).      |
| `error`    | 503  | **Database unreachable** — the site cannot serve DB-backed content. Status-code-only monitors see it as down. |

```json
{
  "status": "ok",
  "timestamp": "2026-07-28T12:00:00.000Z",
  "checks": { "database": "up", "redis": "up" }
}
```

Both checks are timeboxed (DB 5s, Redis 2s) so a wedged connection pool
surfaces as `down` instead of hanging the probe.

## The monitor: `.github/workflows/uptime.yml`

- Runs **every 5 minutes** (GitHub cron is best-effort; delays of a few
  minutes are normal under load) and on manual `workflow_dispatch`.
- Per environment: the **homepage** is the up/down signal (3 attempts, 15s
  timeout, 10s apart — one blip never pages anyone), then **`/api/health`**
  verifies the database behind the site. A 404 from `/api/health` means the
  endpoint isn't deployed on that environment yet (e.g. the legacy production
  site) and the deep check is skipped.
- Scheduled workflows only run from the **default branch** — monitoring goes
  live once the workflow lands on `main`.

### Alert channels

Alerting is **edge-triggered**: alerts fire only on the down→up and up→down
transitions, never repeatedly during an ongoing outage.

**1. GitHub incident issue (default — zero configuration).**
The first failed check opens an issue labelled `uptime:<env>` titled
"🔴 Site down (env): url"; the first successful check afterwards comments
"✅ Recovered" and closes it. The open/closed issues double as an outage log
with timestamps.

> To receive these alerts externally (email / GitHub mobile push), team
> members should **Watch** the repository (at least _Issues_) or subscribe to
> the `uptime:*` labels. The monitor run also turns red while a site is down,
> which triggers GitHub's normal workflow-failure notifications.

**2. Slack (optional).** Set one repo-level Actions secret:

| Secret                     | Value                      |
| -------------------------- | -------------------------- |
| `UPTIME_SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL |

**3. Direct email via SMTP (optional).** Set these repo-level Actions secrets
(they can hold the same values as the deploy-time `NUXT_SMTP_*` secrets, but
must be created at the **repository** level — the `production` environment
scope is not readable by the scheduled monitor):

| Secret             | Value                         |
| ------------------ | ----------------------------- |
| `UPTIME_SMTP_HOST` | SMTP server hostname          |
| `UPTIME_SMTP_PORT` | SMTP port (e.g. 587)          |
| `UPTIME_SMTP_USER` | SMTP username                 |
| `UPTIME_SMTP_PASS` | SMTP password                 |
| `UPTIME_SMTP_FROM` | From address                  |
| `UPTIME_ALERT_TO`  | Recipient(s), comma-separated |

Unset secrets simply disable that channel — the issue-based alerting always
works.

### Adding / changing monitored environments

Edit the `matrix.include` list in `.github/workflows/uptime.yml`:

```yaml
- environment: staging
  url: https://staging.audit.gov.gh
```

Each environment gets its own `uptime:<env>` label and independent incident
lifecycle.

## Verifying the setup

1. Merge to `main`, then run the workflow manually: _Actions → Uptime
   Monitor → Run workflow_. Both environment jobs should pass with a summary
   like `✅ Up (homepage HTTP 200; health: HTTP 200: {"status":"ok"...})`.
2. To rehearse an outage end-to-end, temporarily point an extra matrix entry
   at a dead URL (e.g. `https://down.audit.gov.gh`) and dispatch the
   workflow — an incident issue appears; remove the entry and dispatch again
   after closing the issue.
3. Locally, the endpoint can be checked with
   `curl -i http://localhost:3000/api/health` (run `npm run dev` in
   `ghana-audit-service/`; stop MySQL to see the 503 path).

## When to add more

GitHub Actions' 5-minute best-effort cron gives detection in roughly 5–15
minutes, which is adequate for most public-sector sites at zero cost. If
tighter SLAs or richer telemetry are needed later, the `/api/health` endpoint
is already the right probe target for:

- **UptimeRobot / Better Stack / Pingdom** — 1-minute checks, SMS/phone
  escalation, public status pages.
- **Azure Monitor availability tests** — the site already runs on AKS, so
  standard web tests + alert rules integrate with Azure action groups
  (email/SMS/Teams) without new vendors.
- **Prometheus blackbox exporter** in-cluster, if a metrics stack is ever
  added.
