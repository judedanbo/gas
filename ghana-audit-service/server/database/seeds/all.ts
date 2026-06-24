/**
 * Master seed orchestrator — runs every seed script in dependency order.
 *
 * Run with:           npm run db:seed:all
 * Clear and reseed:   npm run db:seed:all -- --force
 *
 * Each seed is a self-contained script that opens its own DB pool, so we run
 * them as sequential child processes (mirroring `crawl:all`) rather than
 * importing them. Any CLI flags (e.g. --force) are forwarded to every seed.
 *
 * The admin-user seed (../seed.ts) is run first but only when ADMIN_EMAIL and
 * ADMIN_PASSWORD are set — otherwise it is skipped with a notice instead of
 * aborting the whole run.
 */

import 'dotenv/config'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const databaseDir = join(__dirname, '..')

// Forward extra CLI args (everything after the script name) to each seed.
const forwardedArgs = process.argv.slice(2)

interface SeedTask {
  name: string
  script: string
  // When false, a non-zero exit aborts the whole run. When true, we warn and continue.
  optional?: boolean
  // Skip entirely unless this predicate passes (e.g. required env present).
  skipUnless?: () => boolean
  skipReason?: string
}

// Order matters: departments must exist before management-team resolves its
// department slugs. Everything else is independent.
const tasks: SeedTask[] = [
  {
    name: 'admin user',
    script: join(databaseDir, 'seed.ts'),
    optional: true,
    skipUnless: () => Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD),
    skipReason: 'ADMIN_EMAIL and ADMIN_PASSWORD not set'
  },
  { name: 'departments', script: join(__dirname, 'departments.ts') },
  { name: 'management-team', script: join(__dirname, 'management-team.ts') },
  { name: 'offices', script: join(__dirname, 'offices.ts') },
  { name: 'news', script: join(__dirname, 'news.ts') },
  { name: 'events', script: join(__dirname, 'events.ts') },
  { name: 'gallery', script: join(__dirname, 'gallery.ts') },
  { name: 'videos', script: join(__dirname, 'videos.ts') },
  { name: 'reports', script: join(__dirname, 'reports.ts') },
  { name: 'publications', script: join(__dirname, 'publications.ts') }
]

function runSeed(task: SeedTask): boolean {
  // tsx is resolved from node_modules; pass env through so each child reads the
  // same DB credentials we loaded via dotenv.
  const result = spawnSync('npx', ['tsx', task.script, ...forwardedArgs], {
    stdio: 'inherit',
    env: process.env
  })

  if (result.error) {
    console.error(`\n✖ ${task.name}: failed to launch — ${result.error.message}`)
    return false
  }

  return result.status === 0
}

async function main() {
  const force = forwardedArgs.includes('--force')
  console.log('═'.repeat(60))
  console.log(`Seeding all data${force ? ' (--force: clearing existing rows)' : ''}`)
  console.log('═'.repeat(60))

  const skipped: string[] = []
  const succeeded: string[] = []

  for (const task of tasks) {
    if (task.skipUnless && !task.skipUnless()) {
      console.log(`\n↷ Skipping ${task.name}: ${task.skipReason}`)
      skipped.push(task.name)
      continue
    }

    console.log(`\n▶ Seeding ${task.name}...`)
    const ok = runSeed(task)

    if (ok) {
      succeeded.push(task.name)
      continue
    }

    if (task.optional) {
      console.warn(`\n⚠ ${task.name} failed but is optional — continuing.`)
      skipped.push(task.name)
      continue
    }

    console.error(`\n✖ ${task.name} failed. Aborting remaining seeds.`)
    process.exit(1)
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log('All seeds complete.')
  console.log(`  Seeded: ${succeeded.join(', ') || 'none'}`)
  if (skipped.length > 0) console.log(`  Skipped: ${skipped.join(', ')}`)
  console.log('═'.repeat(60))
}

main().catch((error) => {
  console.error('Seed-all failed:', error)
  process.exit(1)
})
