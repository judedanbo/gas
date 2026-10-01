import { stopReportUploadPipelines } from '../utils/reportUploadPipeline'

/**
 * On shutdown, stop background report uploads before they start optimizing
 * (killing a cover render in flight) and give them a few seconds to record
 * the outcome. Otherwise the process exits mid-stage and the admin only sees
 * the upload fail once the stall watchdog sweeps it, minutes later.
 */
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('close', async () => {
    await stopReportUploadPipelines()
  })
})
