import type { FieldPacket, QueryResult } from 'mysql2/promise'

declare module 'mysql2/promise' {
  interface Connection {
    execute<T extends QueryResult>(
      sql: string,
      values?: unknown[]
    ): Promise<[T, FieldPacket[]]>
  }
}
