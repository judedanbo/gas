/**
 * Start shutdown work the moment the process is told to stop.
 *
 * Nitro's own graceful shutdown (node-server preset) handles SIGTERM by
 * closing the listener, waiting up to NITRO_SHUTDOWN_TIMEOUT for open
 * connections, and only then running `close` hooks. Work that needs a head
 * start — handing background uploads off before the pod is killed,
 * reporting explicit optimizations as interrupted — listens for the signal
 * directly, alongside Nitro rather than instead of it.
 */

type SignalListener = (signal: NodeJS.Signals) => void

/** The slice of `process` this needs; injectable for tests. */
export interface SignalTarget {
  readonly pid: number
  once(event: NodeJS.Signals, listener: SignalListener): unknown
  off(event: NodeJS.Signals, listener: SignalListener): unknown
  listenerCount(event: NodeJS.Signals): number
  kill(pid: number, signal: NodeJS.Signals): unknown
}

/**
 * Per target, what every onShutdownSignal registration shares: the
 * listeners installed and not yet fired or removed, by signal, and the
 * handlers a signal has started that have not settled yet.
 */
interface Registry {
  installed: Map<NodeJS.Signals, Set<SignalListener>>
  pending: Set<Promise<void>>
}

const registries = new WeakMap<SignalTarget, Registry>()

function registryOf(target: SignalTarget): Registry {
  let registry = registries.get(target)
  if (!registry) {
    registry = { installed: new Map(), pending: new Set() }
    registries.set(target, registry)
  }
  return registry
}

/** The signals Nitro's graceful shutdown reacts to (same env var, same default). */
export function nitroShutdownSignals(): NodeJS.Signals[] {
  return (process.env.NITRO_SHUTDOWN_SIGNALS || 'SIGTERM SIGINT')
    .split(' ')
    .map((s) => s.trim())
    .filter(Boolean) as NodeJS.Signals[]
}

/**
 * Run `handler` once on the first of `signals`. Returns a function that
 * removes the listeners again (call it from a `close` hook).
 *
 * Installing any listener disables Node's default exit-on-signal. Normally
 * Nitro's handler exits the process; if nothing else is listening for the
 * signal (e.g. NITRO_SHUTDOWN_DISABLED is set), it is re-raised once the
 * handlers settle — every handler registered here, not just this one — so
 * the default action still happens, just after the work instead of before it.
 */
export function onShutdownSignal(
  handler: () => Promise<void>,
  signals: NodeJS.Signals[] = nitroShutdownSignals(),
  target: SignalTarget = process
): () => void {
  const registry = registryOf(target)
  const listener: SignalListener = (signal) => {
    // `once` has already removed this listener. Of those left, the ones
    // installed here start their own work; anything else is someone else's
    // handler (Nitro's) that will take care of exiting.
    registry.installed.get(signal)?.delete(listener)
    const ours = registry.installed.get(signal)?.size ?? 0
    const handledElsewhere = target.listenerCount(signal) > ours
    const work = handler().catch(() => {
      /* the handler reports its own failures */
    })
    registry.pending.add(work)
    void work.finally(() => {
      registry.pending.delete(work)
      removeAll()
      if (!handledElsewhere && registry.pending.size === 0) target.kill(target.pid, signal)
    })
  }
  const removeAll = () => {
    for (const signal of signals) {
      target.off(signal, listener)
      registry.installed.get(signal)?.delete(listener)
    }
  }
  for (const signal of signals) {
    target.once(signal, listener)
    const installed = registry.installed.get(signal) ?? new Set<SignalListener>()
    registry.installed.set(signal, installed.add(listener))
  }
  return removeAll
}

/**
 * Resolve once every promise has settled or `ms` has passed, whichever
 * comes first: a drain's bounded wait for the work it is giving time to.
 */
export function settledOrTimeout(promises: Promise<unknown>[], ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    void Promise.allSettled(promises).then(() => {
      clearTimeout(timer)
      resolve()
    })
  })
}
