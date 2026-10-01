import { describe, it, expect, vi } from 'vitest'
import { drainExplicitOptimizations } from '~/server/utils/explicitOptimizations'
import { onShutdownSignal } from '~/server/utils/shutdownSignals'

vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin)

const removeSignalHandlers = vi.hoisted(() => vi.fn())

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('~/server/utils/explicitOptimizations', () => ({
  drainExplicitOptimizations: vi.fn(async () => undefined)
}))

vi.mock('~/server/utils/shutdownSignals', () => ({
  onShutdownSignal: vi.fn(() => removeSignalHandlers)
}))

const { default: plugin } = await import('~/server/plugins/pdfOptimizationShutdown')

type Hook = () => Promise<void>

function boot(): Record<string, Hook> {
  const hooks: Record<string, Hook> = {}
  const nitroApp = { hooks: { hook: (name: string, fn: Hook) => void (hooks[name] = fn) } }
  ;(plugin as unknown as (app: typeof nitroApp) => void)(nitroApp)
  return hooks
}

describe('pdfOptimizationShutdown', () => {
  it('starts the drain from the shutdown signal itself', async () => {
    boot()
    expect(drainExplicitOptimizations).not.toHaveBeenCalled()

    const [[handler]] = vi.mocked(onShutdownSignal).mock.calls
    await handler()
    expect(drainExplicitOptimizations).toHaveBeenCalledTimes(1)
  })

  it('removes its signal handlers and awaits the drain on close', async () => {
    const hooks = boot()

    await hooks.close()

    expect(removeSignalHandlers).toHaveBeenCalled()
    expect(drainExplicitOptimizations).toHaveBeenCalled()
  })
})
