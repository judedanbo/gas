/**
 * Start shutdown work the moment the process is told to stop.
 *
 * Nitro's own graceful shutdown (node-server preset) handles SIGTERM by
 * closing the listener, waiting up to NITRO_SHUTDOWN_TIMEOUT for open
 * connections, and only then running `close` hooks. Work that needs a head
 * start — handing background uploads off before the pod is killed — listens
 * for the signal directly, alongside Nitro rather than instead of it.
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
 * handler settles, so the default action still happens — just after the
 * work instead of before it.
 */
export function onShutdownSignal(
  handler: () => Promise<void>,
  signals: NodeJS.Signals[] = nitroShutdownSignals(),
  target: SignalTarget = process
): () => void {
  const listener: SignalListener = (signal) => {
    // `once` has already removed this listener; anything left is someone
    // else's handler (Nitro's) that will take care of exiting.
    const handledElsewhere = target.listenerCount(signal) > 0
    void handler()
      .catch(() => {
        /* the handler reports its own failures */
      })
      .finally(() => {
        removeAll()
        if (!handledElsewhere) target.kill(target.pid, signal)
      })
  }
  const removeAll = () => {
    for (const signal of signals) target.off(signal, listener)
  }
  for (const signal of signals) target.once(signal, listener)
  return removeAll
}
