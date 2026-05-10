/**
 * Probing-path detection. These paths are tried by automated scanners
 * looking for misconfigured WordPress sites, exposed env files, leaked
 * git histories, etc. We don't run any of those, so a single hit is a
 * strong signal that the client is malicious and worth flagging in
 * abuse_incidents.
 *
 * Conservative: every match is a critical-severity incident. Add new
 * paths as we observe them; don't add common 404s here (this list is
 * for "no legitimate user types this").
 */

const EXACT_PROBING_PATHS = new Set([
  '/.env',
  '/.env.local',
  '/.env.production',
  '/.env.development',
  '/.env.backup',
  '/.git',
  '/.git/config',
  '/.git/HEAD',
  '/.gitignore',
  '/.htaccess',
  '/.aws/credentials',
  '/.ssh/id_rsa',
  '/web.config',
  '/wp-login.php',
  '/wp-admin',
  '/wp-config.php',
  '/wp-content/plugins/',
  '/xmlrpc.php',
  '/phpmyadmin',
  '/phpMyAdmin',
  '/pma',
  '/myadmin',
  '/administrator',
  '/admin.php',
  '/admin/login.php',
  '/cgi-bin/luci',
  '/owa/auth/logon.aspx',
  '/druid/index.html',
  '/manager/html',
  '/console/login/LoginForm.jsp',
  '/jenkins',
  '/.well-known/security.txt',
  '/api/v1/secret',
  '/server-status',
  '/server-info',
  '/jmx-console',
  '/jolokia',
  '/actuator',
  '/actuator/env',
  '/actuator/health',
  '/_profiler',
  '/swagger.json',
  '/openapi.json'
])

const PROBING_PREFIXES = [
  '/wp-admin/',
  '/wp-content/',
  '/wp-includes/',
  '/phpmyadmin/',
  '/phpMyAdmin/',
  '/cgi-bin/',
  '/.git/',
  '/.svn/',
  '/.aws/',
  '/.ssh/',
  '/actuator/'
]

const PROBING_PATTERNS = [
  /\.env(\..*)?$/i,
  /\/wp-[a-z]+\.php(\?|$)/i,
  /\/(?:phpmyadmin|pma|myadmin)/i,
  /\/\.git\b/i,
  /\/\.svn\b/i,
  /\/cgi-bin\b/i
]

export function isProbingPath(rawPath: string): boolean {
  if (!rawPath) return false
  const path = rawPath.split('?')[0].split('#')[0]
  if (EXACT_PROBING_PATHS.has(path)) return true
  for (const prefix of PROBING_PREFIXES) {
    if (path.startsWith(prefix)) return true
  }
  for (const re of PROBING_PATTERNS) {
    if (re.test(path)) return true
  }
  return false
}
