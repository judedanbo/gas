import { EventEmitter } from 'node:events'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { nitroShutdownSignals, onShutdownSignal } from '~/server/utils/shutdownSignals'

// A stand-in for `process`: real EventEmitter semantics for once/off/
// listenerCount, and a spy instead of actually signalling the test runner.
function fakeProcess() {
  return Object.assign(new EventEmitter(), { pid: 4242, kill: vi.fn() })
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((res) => (resolve = res))
  return { promise, resolve }
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('onShutdownSignal', () => {
  it('runs the handler once and leaves exiting to the existing shutdown handler', async () => {
    const proc = fakeProcess()
    const nitro = vi.fn()
    proc.on('SIGTERM', nitro)
    const handler = vi.fn(async () => undefined)
    onShutdownSignal(handler, ['SIGTERM', 'SIGINT'], proc)

    proc.emit('SIGTERM', 'SIGTERM')
    proc.emit('SIGTERM', 'SIGTERM')
    await settle()

    expect(handler).toHaveBeenCalledTimes(1)
    expect(nitro).toHaveBeenCalledTimes(2)
    expect(proc.kill).not.toHaveBeenCalled()
    // Done with both signals once the handler settled.
    expect(proc.listenerCount('SIGINT')).toBe(0)
  })

  it('re-raises the signal after the handler when nothing else would exit', async () => {
    const proc = fakeProcess()
    const work = deferred()
    onShutdownSignal(() => work.promise, ['SIGTERM'], proc)

    proc.emit('SIGTERM', 'SIGTERM')
    await settle()
    // The default action waits for the work…
    expect(proc.kill).not.toHaveBeenCalled()

    work.resolve()
    await settle()
    // …and then happens with no listener left in the way.
    expect(proc.kill).toHaveBeenCalledWith(4242, 'SIGTERM')
    expect(proc.listenerCount('SIGTERM')).toBe(0)
  })

  it('still re-raises when the handler fails', async () => {
    const proc = fakeProcess()
    onShutdownSignal(() => Promise.reject(new Error('boom')), ['SIGINT'], proc)

    proc.emit('SIGINT', 'SIGINT')
    await settle()

    expect(proc.kill).toHaveBeenCalledWith(4242, 'SIGINT')
  })

  it('can be removed before any signal arrives', () => {
    const proc = fakeProcess()
    const handler = vi.fn(async () => undefined)
    const remove = onShutdownSignal(handler, ['SIGTERM', 'SIGINT'], proc)

    remove()
    proc.emit('SIGTERM', 'SIGTERM')

    expect(handler).not.toHaveBeenCalled()
    expect(proc.listenerCount('SIGTERM')).toBe(0)
    expect(proc.listenerCount('SIGINT')).toBe(0)
  })
})

describe('nitroShutdownSignals', () => {
  it("follows Nitro's NITRO_SHUTDOWN_SIGNALS and its default", () => {
    vi.stubEnv('NITRO_SHUTDOWN_SIGNALS', '')
    expect(nitroShutdownSignals()).toEqual(['SIGTERM', 'SIGINT'])
    vi.stubEnv('NITRO_SHUTDOWN_SIGNALS', 'SIGTERM  SIGUSR2')
    expect(nitroShutdownSignals()).toEqual(['SIGTERM', 'SIGUSR2'])
  })
})
