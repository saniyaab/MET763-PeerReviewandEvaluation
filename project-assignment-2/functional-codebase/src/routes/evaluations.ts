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
//   - Human review: signed off by the student (Saniya Bhambhvani), 2026-11-17
// Confidence: Medium
// File purpose: REST routes for every Domain 3 endpoint under /api/v1/evaluations.
// =============================================================================

import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";
import { buildReport, projectSummary, reportToCsv } from "../services/aggregation";
import { createReview, deleteReview, getReview, listReviews, updateReview } from "../services/reviews";
import { createRubric, deleteRubric, getRubric, listRubrics, updateRubric } from "../services/rubrics";

function qs(value: unknown): string | undefined {
  if (Array.isArray(value)) return qs(value[0]);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function qnum(value: unknown): number | undefined {
  const s = qs(value);
  return s === undefined ? undefined : Number(s);
}

function param(req: Request, name: string): string {
  return String(req.params[name]);
}

export function evaluationsRouter(pool: Pool): Router {
  const router = Router();

  // ---- Rubrics -------------------------------------------------------------
  router.post("/rubrics", async (req: Request, res: Response) => {
    const rubric = await createRubric(pool, req.body);
    res.status(201).location(`/api/v1/evaluations/rubrics/${rubric.id}`).json(rubric);
  });

  router.get("/rubrics", async (req: Request, res: Response) => {
    const rubrics = await listRubrics(pool, {
      project_id: qs(req.query.project_id),
      course_id: qs(req.query.course_id),
      lab_id: qs(req.query.lab_id),
    });
    res.json({ data: rubrics, count: rubrics.length });
  });

  router.get("/rubrics/:rubric_id", async (req: Request, res: Response) => {
    res.json(await getRubric(pool, param(req, "rubric_id")));
  });

  router.put("/rubrics/:rubric_id", async (req: Request, res: Response) => {
    res.json(await updateRubric(pool, param(req, "rubric_id"), req.body));
  });

  router.delete("/rubrics/:rubric_id", async (req: Request, res: Response) => {
    await deleteRubric(pool, param(req, "rubric_id"));
    res.status(204).end();
  });

  // ---- Project summary -----------------------------------------------------
  router.get("/projects/:project_id/summary", async (req: Request, res: Response) => {
    res.json(await projectSummary(pool, param(req, "project_id")));
  });

  // ---- Reviews -------------------------------------------------------------
  router.post("/projects/:project_id/reviews", async (req: Request, res: Response) => {
    const projectId = param(req, "project_id");
    const review = await createReview(pool, projectId, req.body);
    res.status(201).location(`/api/v1/evaluations/projects/${projectId}/reviews/${review.id}`).json(review);
  });

  router.get("/projects/:project_id/reviews", async (req: Request, res: Response) => {
    const reviews = await listReviews(pool, param(req, "project_id"), {
      min_score: qnum(req.query.min_score),
      reviewer_role: qs(req.query.reviewer_role),
      sort: qs(req.query.sort),
      order: qs(req.query.order),
    });
    res.json({ data: reviews, count: reviews.length });
  });

  router.get("/projects/:project_id/reviews/:review_id", async (req: Request, res: Response) => {
    res.json(await getReview(pool, param(req, "project_id"), param(req, "review_id")));
  });

  router.put("/projects/:project_id/reviews/:review_id", async (req: Request, res: Response) => {
    res.json(await updateReview(pool, param(req, "project_id"), param(req, "review_id"), req.body));
  });

  router.delete("/projects/:project_id/reviews/:review_id", async (req: Request, res: Response) => {
    await deleteReview(pool, param(req, "project_id"), param(req, "review_id"));
    res.status(204).end();
  });

  // ---- Consolidated reports ------------------------------------------------
  router.get("/reports", async (req: Request, res: Response) => {
    const report = await buildReport(pool, {
      course_id: qs(req.query.course_id),
      lab_id: qs(req.query.lab_id),
      project_id: qs(req.query.project_id),
      min_score: qnum(req.query.min_score),
      sort: qs(req.query.sort),
      order: qs(req.query.order),
      include_comments: qs(req.query.include_comments) === "true",
    });
    if (qs(req.query.format) === "json") {
      res.json(report);
      return;
    }
    const scope = qs(req.query.course_id) ?? qs(req.query.lab_id) ?? qs(req.query.project_id) ?? "all";
    res.attachment(`evaluation-report-${scope}.csv`);
    res.type("text/csv").send(reportToCsv(report));
  });

  return router;
}
