// =============================================================================
// Language/Stack: TypeScript 5.9 | Node.js 22 | Express 5 | PostgreSQL 17 (pg)
// Tool: Claude Code agent harness (Claude desktop app), model claude-opus-5-5
// Prompt Summary: "build every Domain 3 requirement and endpoint from
//   ProjectPortalDomainServices.pdf in functional-codebase/" (PA2 happy-path
//   prompt; full verbatim text in /.ai_logs/)
// AI Contribution: 100% AI generated / 0% human refactored
// Human Modifications: none
// Verification:
//   - CI: API integration tests (tests/api.test.ts)
//   - Human review: PENDING (student must review and sign off)
// Confidence: Medium
// File purpose: process entry point: create schema, seed mock data, start HTTP.
// =============================================================================

import { createApp, SERVICE_NAME } from "./app";
import { loadConfig } from "./config";
import { closePool, getPool } from "./db";
import { migrateAndSeed } from "./schema";

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = getPool(config.databaseUrl);

  // The database container can take a moment to accept connections.
  for (let attempt = 1; ; attempt++) {
    try {
      await migrateAndSeed(pool);
      break;
    } catch (err) {
      if (attempt >= 30) throw err;
      console.log(`Database not ready (attempt ${attempt}), retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const app = createApp(pool);
  const server = app.listen(config.port, () => {
    console.log(`${SERVICE_NAME} listening on port ${config.port}`);
  });

  const shutdown = (signal: string): void => {
    console.log(`${signal} received, shutting down`);
    server.close(() => {
      closePool()
        .catch((err: unknown) => console.error("Error closing DB pool", err))
        .finally(() => process.exit(0));
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err: unknown) => {
  console.error("Fatal startup error", err);
  process.exit(1);
});
