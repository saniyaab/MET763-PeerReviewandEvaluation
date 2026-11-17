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
// File purpose: Express application: JSON parsing, health probes, the
//   /api/v1/evaluations router, 404 and error handling.
// =============================================================================

import express, { type Express, type NextFunction, type Request, type Response } from "express";
import type { Pool } from "pg";
import { pingDatabase } from "./db";
import { HttpError } from "./errors";
import { evaluationsRouter } from "./routes/evaluations";

export const SERVICE_NAME = "peer-review-evaluation-gateway";

export function createApp(pool: Pool): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", service: SERVICE_NAME });
  });

  app.get("/health/ready", async (_req: Request, res: Response) => {
    const dbUp = await pingDatabase(pool);
    res.status(dbUp ? 200 : 503).json({ status: dbUp ? "ready" : "unavailable", database: dbUp ? "up" : "down" });
  });

  app.get("/api/v1", (_req: Request, res: Response) => {
    res.status(200).json({
      service: SERVICE_NAME,
      domain: "Project Portal - Domain 3: Peer Review & Evaluation Gateway",
      version: "0.2.0",
    });
  });

  app.use("/api/v1/evaluations", evaluationsRouter(pool));

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { message: "Route not found" } });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: { message: err.message } });
  });

  return app;
}
