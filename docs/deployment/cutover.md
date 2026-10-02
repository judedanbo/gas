# audit.gov.gh go-live: DNS and TLS cutover

Both environments run on the `website` cluster behind **40.89.171.199**. The
DNS zone is operated by NITA (`ns1-3.nita.gov.gh`). Email (MX → Microsoft 365,
SPF `include:` only) does not depend on the apex A record, so moving it does
not affect mail.

## State after Phase 1 (applied 2026-10-01)

| Record                   | Value          | TTL |
| ------------------------ | -------------- | --- |
| `test.audit.gov.gh`      | 40.89.171.199  | 300 |
| `prelaunch.audit.gov.gh` | 40.89.171.199  | 300 |
| `audit.gov.gh`           | 162.240.49.193 | 300 |
| `www.audit.gov.gh`       | 162.240.42.234 | 300 |

## Before asking NITA for Phase 2

1. Production stack deployed (`gas-production`), data copied from staging in
   `production` mode, staging accounts reviewed.
2. `https://prelaunch.audit.gov.gh` serves the site with a valid certificate
   and `X-Robots-Tag: noindex`. Smoke-test admin login, a report download, a
   search, the contact form (email arrives), `/sitemap.xml` shows
   `https://audit.gov.gh/...` URLs.
3. `kubectl --context website -n gas-production get certificate gas-tls` is
   NOT Ready yet — expected: HTTP-01 for the apex cannot pass until DNS moves.
4. Old-site links: `SELECT COUNT(*) FROM audit_reports WHERE file_url LIKE
'http%audit.gov.gh%'` — those files must exist on the new site first.
5. `kubectl --context website -n gas-production logs deploy/gas-frontend | grep -i redis`
   shows a verified TLS connection (not the in-process fallback).

## Phase 2 — the switch (ask NITA, both records together)

| Record             | New value     | TTL |
| ------------------ | ------------- | --- |
| `audit.gov.gh`     | 40.89.171.199 | 300 |
| `www.audit.gov.gh` | 40.89.171.199 | 300 |

Then:

```bash
# propagation (both must show 40.89.171.199)
getent ahosts audit.gov.gh | awk '{print $1}' | sort -u
resolvectl query --type=A www.audit.gov.gh
# certificate: cert-manager retries its self-check every few minutes
kubectl --context website -n gas-production get certificate gas-tls -w
# if it stalls > 15 min after DNS is visible, force a fresh order:
kubectl --context website -n gas-production delete certificate gas-tls   # recreated by the Ingress
# verify
curl -sI https://audit.gov.gh/ | grep -iE '^(HTTP|strict)'
curl -sI https://www.audit.gov.gh/ | grep -iE '^(HTTP|location)'       # 301 -> https://audit.gov.gh/
```

Rollback: NITA restores `audit.gov.gh` → 162.240.49.193 and `www` →
162.240.42.234. Works only while the HSTS header is short-lived
(`hsts-max-age: 300` in `k8s/cluster/ingress-nginx/patches/controller-config.yaml`)
and the old host still serves valid HTTPS.

## Phase 3 — about a week after go-live

1. Ask NITA to remove `prelaunch.audit.gov.gh` and raise TTLs to 3600.
2. Remove the `components:` block from `k8s/overlays/production/kustomization.yaml`
   and delete by hand (apply does not prune):
   ```bash
   kubectl --context website -n gas-production delete ingress gas-frontend-prelaunch
   kubectl --context website -n gas-production delete secret gas-prelaunch-tls
   kubectl --context website -n gas-production delete configmap gas-prelaunch-headers
   ```
3. Raise HSTS in steps (`hsts-max-age`: 300 → 86400 → 2592000 → 31536000),
   re-applying `k8s/cluster/ingress-nginx` each time, once every subdomain
   that exists serves HTTPS (the app's own header has `includeSubDomains`).
4. Decommission the `gas` namespace on the `infosys` cluster after confirming
   nothing else references it.
