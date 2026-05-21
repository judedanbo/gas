import { closeBrowser } from '../utils/pdf/browser'

/**
 * Disconnect the singleton Puppeteer browser on Nitro shutdown so the
 * Chromium process exits cleanly with the Node process.
 */
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('close', async () => {
    await closeBrowser()
  })
})
