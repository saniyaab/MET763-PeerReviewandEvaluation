// =============================================================================
// Language/Stack: TypeScript 5.9 | Node.js 22 | Express 5 | PostgreSQL 17 (pg)
// Tool: Claude Code agent harness (Claude desktop app), model claude-opus-5-5
// Prompt Summary: "build every Domain 3 requirement and endpoint from
//   ProjectPortalDomainServices.pdf in functional-codebase/" (PA2 happy-path
//   prompt; full verbatim text in /.ai_logs/)
// AI Contribution: 100% AI generated / 0% human refactored
// Human Modifications: none
// Verification:
//   - CI: build + unit + API integration tests in .github/workflows/devsecops.yml
//   - Human review: signed off by the student (Saniya Bhambhvani), 2026-11-17
// Confidence: Medium
// File purpose: PostgreSQL pool, query helper and transaction helper.
// =============================================================================

import { Pool, type PoolClient, type QueryResult, type QueryResultRow, types } from "pg";

// NUMERIC (1700) and BIGINT/COUNT (20) come back as strings by default.
types.setTypeParser(1700, (value: string) => Number.parseFloat(value));
types.setTypeParser(20, (value: string) => Number.parseInt(value, 10));

export type Db = Pool | PoolClient;

let pool: Pool | undefined;

export function getPool(databaseUrl: string | undefined): Pool {
  pool ??= new Pool({ connectionString: databaseUrl, max: 10 });
  return pool;
}

export async function query<R extends QueryResultRow = QueryResultRow>(
  db: Db,
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<R>> {
  return (db as Pool).query<R>(text, values);
}

export async function withTransaction<T>(p: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function pingDatabase(p: Pool | undefined): Promise<boolean> {
  if (!p) {
    return false;
  }
  try {
    await p.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
