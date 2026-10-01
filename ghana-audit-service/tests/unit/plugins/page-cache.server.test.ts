import { describe, it, expect, vi, beforeAll } from 'vitest'

type AppRenderedHook = (ctx: {
  ssrContext?: { event: { context: Record<string, unknown> } }
}) => void

type InstallPlugin = (nuxtApp: unknown) => void

let installPlugin: InstallPlugin

beforeAll(async () => {
  // defineNuxtPlugin is an auto-import; with it stubbed the default export is the setup fn.
  vi.stubGlobal('defineNuxtPlugin', (plugin: unknown) => plugin)
  installPlugin = (await import('~/plugins/page-cache.server')).default as unknown as InstallPlugin
})

/** Runs the plugin against a fake app whose payload holds `errors`; returns the event context. */
function render(errors: Record<string, unknown>) {
  let appRendered: AppRenderedHook | undefined
  installPlugin({
    payload: { _errors: errors },
    hooks: {
      hook: (name: string, fn: AppRenderedHook) => {
        if (name === 'app:rendered') appRendered = fn
      }
    }
  })
  const context: Record<string, unknown> = {}
  appRendered?.({ ssrContext: { event: { context } } })
  return context
}

describe('page-cache.server plugin', () => {
  it('flags a render whose data fetch failed transiently', () => {
    expect(render({ 'site-stats': { statusCode: 500 } }).ssrFetchFailed).toBe(true)
  })

  it('leaves renders with no or only stable fetch errors unflagged', () => {
    expect(render({ 'site-stats': null }).ssrFetchFailed).toBeUndefined()
    expect(render({ report: { statusCode: 404 } }).ssrFetchFailed).toBeUndefined()
  })
})
