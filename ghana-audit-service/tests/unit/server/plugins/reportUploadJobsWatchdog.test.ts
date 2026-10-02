import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  pruneUploadJobs,
  recoverOrphanedUploadJobs,
  sweepStalledUploadJobs
} from '~/server/utils/reportUploadJobs'
import {
  drainReportUploadPipelines,
  isAcceptingUploads,
  resumeInterruptedUploadJobs
} from '~/server/utils/reportUploadPipeline'
import { onShutdownSignal } from '~/server/utils/shutdownSignals'

vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin)

const removeSignalHandlers = vi.hoisted(() => vi.fn())

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('~/server/utils/reportUploadJobs', () => ({
  pruneUploadJobs: vi.fn(async () => undefined),
  recoverOrphanedUploadJobs: vi.fn(async () => ({ failed: 0, interrupted: 0 })),
  sweepStalledUploadJobs: vi.fn(async () => ({ failed: 0, interrupted: 0 })),
  uploadWorkerId: vi.fn(() => 'pod-a')
}))

vi.mock('~/server/utils/reportUploadPipeline', () => ({
  drainReportUploadPipelines: vi.fn(async () => undefined),
  isAcceptingUploads: vi.fn(() => true),
  resumeInterruptedUploadJobs: vi.fn(async () => ({ resumed: 0, finalized: 0 }))
}))

vi.mock('~/server/utils/shutdownSignals', () => ({
  onShutdownSignal: vi.fn(() => removeSignalHandlers)
}))

const { default: watchdog } = await import('~/server/plugins/reportUploadJobsWatchdog')

type Hook = () => Promise<void>

function boot(): Record<string, Hook> {
  const hooks: Record<string, Hook> = {}
  const nitroApp = { hooks: { hook: (name: string, fn: Hook) => void (hooks[name] = fn) } }
  ;(watchdog as unknown as (app: typeof nitroApp) => void)(nitroApp)
  return hooks
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(isAcceptingUploads).mockReturnValue(true)
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('reportUploadJobsWatchdog', () => {
  it('recovers its own orphans once at startup, then sweeps and resumes on every tick', async () => {
    const bootedAt = Date.now()
    boot()

    await vi.advanceTimersByTimeAsync(5_000)
    expect(recoverOrphanedUploadJobs).toHaveBeenCalledWith('pod-a', new Date(bootedAt))
    expect(sweepStalledUploadJobs).toHaveBeenCalledTimes(1)
    expect(resumeInterruptedUploadJobs).toHaveBeenCalledTimes(1)
    expect(pruneUploadJobs).toHaveBeenCalledTimes(1)

    // Then every 15s, so a job handed off by a draining pod is picked up fast.
    await vi.advanceTimersByTimeAsync(10_000)
    expect(recoverOrphanedUploadJobs).toHaveBeenCalledTimes(1)
    expect(sweepStalledUploadJobs).toHaveBeenCalledTimes(2)
    expect(resumeInterruptedUploadJobs).toHaveBeenCalledTimes(2)
  })

  it('retries the startup recovery until it gets through', async () => {
    vi.mocked(recoverOrphanedUploadJobs).mockRejectedValueOnce(new Error('db not ready'))
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    boot()

    await vi.advanceTimersByTimeAsync(5_000)
    expect(sweepStalledUploadJobs).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(15_000)
    expect(recoverOrphanedUploadJobs).toHaveBeenCalledTimes(2)
    expect(resumeInterruptedUploadJobs).toHaveBeenCalled()
  })

  it('claims nothing once the process is shutting down', async () => {
    vi.mocked(isAcceptingUploads).mockReturnValue(false)
    boot()

    await vi.advanceTimersByTimeAsync(20_000)
    expect(recoverOrphanedUploadJobs).not.toHaveBeenCalled()
    expect(resumeInterruptedUploadJobs).not.toHaveBeenCalled()
  })

  it('starts the drain from the shutdown signal', async () => {
    boot()
    const [[handler]] = vi.mocked(onShutdownSignal).mock.calls
    await handler()
    expect(drainReportUploadPipelines).toHaveBeenCalledTimes(1)
  })

  it('drains on close and stops sweeping', async () => {
    const hooks = boot()

    await hooks.close()
    expect(drainReportUploadPipelines).toHaveBeenCalled()
    expect(removeSignalHandlers).toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(sweepStalledUploadJobs).not.toHaveBeenCalled()
  })
})
