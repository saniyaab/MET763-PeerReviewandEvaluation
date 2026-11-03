// AI Contribution Weight: [100%] AI Generated / [0%] Human Refactored
// Author: Claude Code agent (claude-opus-5-5) - see code_AI_history.md
// Process entry point: starts the HTTP server and shuts down cleanly.

import { createApp, SERVICE_NAME } from "./app";
import { loadConfig } from "./config";
import { closePool, getPool } from "./db";

const config = loadConfig();
const pool = getPool(config.databaseUrl);
const app = createApp(pool);

const server = app.listen(config.port, () => {
  console.log(`${SERVICE_NAME} listening on port ${config.port}`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    closePool()
      .catch((err: unknown) => console.error("Error closing DB pool", err))
      .finally(() => process.exit(0));
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
