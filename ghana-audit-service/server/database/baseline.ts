import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

export const MIGRATIONS_FOLDER = './server/database/migrations'

// A table guaranteed to be created by 0000_init_squash. Its presence means the
// schema already exists (e.g. it was created with `drizzle-kit push`).
const CORE_TABLE = 'users'
const LEDGER_TABLE = '__drizzle_migrations'

/**
 * Minimal slice of a mysql2 connection. `query` resolves to mysql2's
 * `[rows, fields]` tuple, typed here as `unknown` and narrowed on extraction.
 */
export interface SqlExecutor {
  query(sql: string, values?: unknown[]): Promise<unknown>
}

export type BaselineOutcome = 'fresh' | 'already-tracked' | 'baselined'

/**
 * Reconcile a squashed migration history with a DB whose schema predates it.
 *
 * The migration chain was squashed to a single `0000_init_squash`. A schema
 * created with `drizzle-kit push` (or the old pre-squash chain) has every table
 * but an EMPTY `__drizzle_migrations` ledger. The file-based migrator would then
 * assume nothing is applied and try to `CREATE TABLE` over live tables — failing
 * with "table already exists".
 *
 * When we detect that exact state (core table present, ledger empty) we seed the
 * single baseline row Drizzle itself writes for `0000_init_squash` — hash =
 * sha256 of the migration file, created_at = the journal `when` — so the
 * migrator treats 0000 as applied and runs only LATER migrations.
 *
 * Idempotent and safe in every state:
 *  - fresh DB (no core table)     -> 'fresh'           (migrator creates everything)
 *  - schema present, ledger empty -> 'baselined'       (seed the 0000 row)
 *  - ledger already has rows      -> 'already-tracked' (no-op)
 */
export async function baselineIfNeeded(
  exec: SqlExecutor,
  migrationsFolder: string = MIGRATIONS_FOLDER
): Promise<BaselineOutcome> {
  if (!(await tableExists(exec, CORE_TABLE))) return 'fresh'

  if (await tableExists(exec, LEDGER_TABLE)) {
    const ledgerRows = await scalarCount(exec, `SELECT COUNT(*) AS n FROM \`${LEDGER_TABLE}\``)
    if (ledgerRows > 0) return 'already-tracked'
  }

  const { tag, hash, when } = baselineLedgerRow(migrationsFolder)

  // Mirror Drizzle's own DDL so the migrator's `create table if not exists` no-ops.
  await exec.query(
    `create table if not exists \`${LEDGER_TABLE}\` (id serial primary key, hash text not null, created_at bigint)`
  )
  await exec.query(`INSERT INTO \`${LEDGER_TABLE}\` (\`hash\`, \`created_at\`) VALUES (?, ?)`, [
    hash,
    when
  ])
  console.log(
    `[migrate] Existing schema, empty ledger — baselined as ${tag} (${hash.slice(0, 12)}…)`
  )
  return 'baselined'
}

/**
 * The exact ledger row Drizzle writes when it applies the baseline migration:
 * hash = sha256 of the migration SQL, created_at = the journal `when`. Derived
 * from the same files the migrator reads, so it stays correct if the baseline
 * is ever regenerated.
 */
export function baselineLedgerRow(migrationsFolder: string = MIGRATIONS_FOLDER): {
  tag: string
  hash: string
  when: number
} {
  const journal = JSON.parse(readFileSync(`${migrationsFolder}/meta/_journal.json`, 'utf8')) as {
    entries: Array<{ tag: string; when: number }>
  }
  const baseline = journal.entries[0]
  const sql = readFileSync(`${migrationsFolder}/${baseline.tag}.sql`, 'utf8')
  const hash = createHash('sha256').update(sql).digest('hex')
  return { tag: baseline.tag, hash, when: baseline.when }
}

async function tableExists(exec: SqlExecutor, table: string): Promise<boolean> {
  return (
    (await scalarCount(
      exec,
      `SELECT COUNT(*) AS n FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = ?`,
      [table]
    )) > 0
  )
}

async function scalarCount(exec: SqlExecutor, sql: string, values?: unknown[]): Promise<number> {
  const result = await exec.query(sql, values)
  const rows = (result as [Array<{ n?: number }>, unknown])[0]
  return Number(rows?.[0]?.n ?? 0)
}
