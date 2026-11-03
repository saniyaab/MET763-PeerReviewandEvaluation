// AI Contribution Weight: [100%] AI Generated / [0%] Human Refactored
// Author: Claude Code agent (claude-opus-5-5) - see code_AI_history.md
// Barebones Express app for PA1. Business endpoints from spec.md are NOT
// implemented yet; only liveness/readiness probes and a service descriptor.

import express, { type Express, type Request, type Response } from "express";
import type { Pool } from "pg";
import { pingDatabase } from "./db";

export const SERVICE_NAME = "peer-review-evaluation-gateway";

export function createApp(pool: Pool | undefined): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", service: SERVICE_NAME });
  });

  app.get("/health/ready", async (_req: Request, res: Response) => {
    const dbUp = await pingDatabase(pool);
    res.status(dbUp ? 200 : 503).json({
      status: dbUp ? "ready" : "unavailable",
      database: dbUp ? "up" : "down",
    });
  });

  app.get("/api/v1", (_req: Request, res: Response) => {
    res.status(200).json({
      service: SERVICE_NAME,
      domain: "Project Portal - Domain 3",
      version: "0.1.0",
      spec: "spec.md",
    });
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  return app;
}
