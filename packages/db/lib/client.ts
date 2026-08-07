import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type Database = ReturnType<typeof createClient>;

/**
 * A client or a transaction. Helpers that must be callable *inside*
 * `awardPoints`'s transaction take this rather than `Database`: a transaction
 * exposes the same query surface but is not assignable to the client type,
 * because the client also carries `$client` (the underlying pool) which a
 * transaction has no business exposing. Widening here is what lets
 * `currentSeason` be reused inside the transaction instead of being duplicated
 * or cast away.
 */
export type Queryable = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * `node-postgres` over a pooled Neon connection string rather than Neon's HTTP
 * driver, for one reason: `awardPoints` needs a real transaction, and the HTTP
 * driver cannot hold one open across statements. Payload's Postgres adapter
 * uses node-postgres too, so this keeps one driver in the process.
 *
 * Pass Neon's `-pooler` host. Neon's pooler is PgBouncer in transaction mode,
 * which does not support session-level features — so no prepared statements and
 * no `LISTEN`/`NOTIFY` on this connection.
 */
export function createClient(connectionString: string) {
  const pool = new Pool({
    connectionString,
    /**
     * Small on purpose. Neon's free tier caps connections, and each Coolify
     * container plus each preview deployment holds its own pool.
     */
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return drizzle(pool, { schema, casing: "snake_case" });
}
