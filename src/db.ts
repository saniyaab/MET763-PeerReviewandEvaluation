// AI Contribution Weight: [100%] AI Generated / [0%] Human Refactored
// Author: Claude Code agent (claude-opus-5-5) - see code_AI_history.md
// Single PostgreSQL connection pool for this service's own database.

import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool(databaseUrl: string | undefined): Pool | undefined {
  if (!databaseUrl) {
    return undefined;
  }
  pool ??= new Pool({ connectionString: databaseUrl, max: 5 });
  return pool;
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
