import { drainExplicitOptimizations } from '../utils/explicitOptimizations'
import { onShutdownSignal } from '../utils/shutdownSignals'

/**
 * Shutdown for explicit PDF optimizations (the edit page's "Optimize"),
 * which run in this process and die with it. On SIGTERM (deploys,
 * scale-down) each one still queued or running is reported INTERRUPTED and
 * its file released — see explicitOptimizations.ts. Started from the signal
 * itself, so the admin hears within moments instead of after Nitro has
 * waited out open connections, and so its Redis writes land before
 * analyticsBuffer's close hook shuts the client; the close hook awaits it.
 */
export default defineNitroPlugin((nitroApp) => {
  // `nuxt build` prerenders pages with this server in-process; nothing runs
  // there to interrupt.
  if (import.meta.prerender) return

  // The dev server runs Nitro in a worker thread that never sees signals;
  // its reloads still reach the close hook below.
  const removeSignalHandlers = import.meta.dev
    ? () => {}
    : onShutdownSignal(() => drainExplicitOptimizations())

  nitroApp.hooks.hook('close', async () => {
    removeSignalHandlers()
    await drainExplicitOptimizations()
  })
})
