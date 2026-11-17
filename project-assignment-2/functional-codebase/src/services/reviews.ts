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
// File purpose: multi-role review submission and retrieval (functional
//   requirement 2): faculty_instructor evaluations and anonymous student_peer
//   reviews scored against the project's governing rubric.
// =============================================================================

import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { type Db, query, withTransaction } from "../db";
import { conflict, HttpError, notFound } from "../errors";
import { governingRubricId, loadCriteriaTree } from "./rubrics";
import { computeTotalScore, toGrade } from "./scoring";

export type ReviewerRole = "faculty_instructor" | "student_peer";

export interface ScoreInput {
  criterion_id: string;
  score: number;
  feedback?: string;
}

export interface ReviewInput {
  reviewer_id: string;
  reviewer_role?: ReviewerRole;
  rubric_id?: string;
  comment?: string;
  scores: ScoreInput[];
}

interface ReviewRow {
  id: string;
  project_id: string;
  rubric_id: string;
  reviewer_id: string;
  reviewer_role: ReviewerRole;
  comment: string | null;
  total_score: number;
  grade_points: number;
  letter_grade: string;
  created_at: Date;
  updated_at: Date;
}

export interface Review {
  id: string;
  project_id: string;
  rubric_id: string;
  reviewer_id: string | null;
  reviewer_display: string;
  reviewer_role: ReviewerRole;
  comment: string | null;
  total_score: number;
  grade_points: number;
  letter_grade: string;
  scores: Array<{ criterion_id: string; score: number; feedback: string | null }>;
  created_at: Date;
  updated_at: Date;
}

/** Student peer reviews are anonymous: the reviewer identity is not returned. */
function present(row: ReviewRow & { reviewer_name?: string }, scores: Review["scores"]): Review {
  const anonymous = row.reviewer_role === "student_peer";
  return {
    id: row.id,
    project_id: row.project_id,
    rubric_id: row.rubric_id,
    reviewer_id: anonymous ? null : row.reviewer_id,
    reviewer_display: anonymous ? "Anonymous Peer" : (row.reviewer_name ?? row.reviewer_id),
    reviewer_role: row.reviewer_role,
    comment: row.comment,
    total_score: row.total_score,
    grade_points: row.grade_points,
    letter_grade: row.letter_grade,
    scores,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadScores(db: Db, reviewIds: string[]): Promise<Map<string, Review["scores"]>> {
  const map = new Map<string, Review["scores"]>();
  if (reviewIds.length === 0) return map;
  const result = await query<{ review_id: string; criterion_id: string; score: number; feedback: string | null }>(
    db,
    "SELECT review_id, criterion_id, score, feedback FROM review_scores WHERE review_id = ANY($1::uuid[])",
    [reviewIds],
  );
  for (const r of result.rows) {
    const list = map.get(r.review_id) ?? [];
    list.push({ criterion_id: r.criterion_id, score: r.score, feedback: r.feedback });
    map.set(r.review_id, list);
  }
  return map;
}

export async function assertProjectExists(db: Db, projectId: string): Promise<void> {
  const result = await query(db, "SELECT 1 FROM projects WHERE id::text = $1", [projectId]);
  if (result.rows.length === 0) throw notFound("Project");
}

async function scoreReview(db: Db, rubricId: string, scores: ScoreInput[]) {
  const tree = await loadCriteriaTree(db, rubricId);
  const scoreMap = new Map(scores.map((s) => [s.criterion_id, Number(s.score)]));
  const total = computeTotalScore(tree, scoreMap);
  const grade = toGrade(total);
  return { total, grade };
}

export async function getReview(db: Db, projectId: string, reviewId: string): Promise<Review> {
  const result = await query<ReviewRow & { reviewer_name: string }>(
    db,
    `SELECT r.*, u.name AS reviewer_name FROM reviews r JOIN users u ON u.id = r.reviewer_id
     WHERE r.id::text = $1 AND r.project_id::text = $2`,
    [reviewId, projectId],
  );
  if (result.rows.length === 0) throw notFound("Review");
  const scores = await loadScores(db, [reviewId]);
  return present(result.rows[0], scores.get(reviewId) ?? []);
}

export async function createReview(pool: Pool, projectId: string, input: ReviewInput): Promise<Review> {
  await assertProjectExists(pool, projectId);
  const rubricId = await governingRubricId(pool, projectId);
  if (!rubricId) throw conflict("Project has no governing rubric");
  if (input.rubric_id && input.rubric_id !== rubricId) {
    throw conflict(`Review targets rubric ${input.rubric_id} but project is governed by rubric ${rubricId}`);
  }

  let role = input.reviewer_role;
  if (!role) {
    const user = await query<{ role: ReviewerRole }>(pool, "SELECT role FROM users WHERE id::text = $1", [input.reviewer_id]);
    if (user.rows.length === 0) throw new HttpError(404, "Reviewer not found");
    role = user.rows[0].role;
  }

  const { total, grade } = await scoreReview(pool, rubricId, input.scores);
  const id = randomUUID();
  await withTransaction(pool, async (client) => {
    await query(
      client,
      `INSERT INTO reviews (id, project_id, rubric_id, reviewer_id, reviewer_role, comment, total_score, grade_points, letter_grade)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, projectId, rubricId, input.reviewer_id, role, input.comment ?? null, total, grade.points, grade.letter],
    );
    for (const s of input.scores) {
      await query(
        client,
        "INSERT INTO review_scores (review_id, criterion_id, score, feedback) VALUES ($1, $2, $3, $4)",
        [id, s.criterion_id, s.score, s.feedback ?? null],
      );
    }
  });
  return getReview(pool, projectId, id);
}

export interface ReviewFilter {
  min_score?: number;
  reviewer_role?: string;
  sort?: string;
  order?: string;
}

const SORT_COLUMNS: Record<string, string> = {
  created_at: "r.created_at",
  total_score: "r.total_score",
  grade_points: "r.grade_points",
};

export async function listReviews(db: Db, projectId: string, filter: ReviewFilter): Promise<Review[]> {
  await assertProjectExists(db, projectId);
  const values: unknown[] = [projectId];
  const where = ["r.project_id::text = $1"];
  if (filter.min_score !== undefined) {
    values.push(filter.min_score);
    where.push(`r.total_score >= $${values.length}`);
  }
  if (filter.reviewer_role) {
    values.push(filter.reviewer_role);
    where.push(`r.reviewer_role = $${values.length}`);
  }
  const sortColumn = SORT_COLUMNS[filter.sort ?? "created_at"] ?? "r.created_at";
  const direction = filter.order?.toLowerCase() === "desc" ? "DESC" : "ASC";
  const result = await query<ReviewRow & { reviewer_name: string }>(
    db,
    `SELECT r.*, u.name AS reviewer_name FROM reviews r JOIN users u ON u.id = r.reviewer_id
     WHERE ${where.join(" AND ")} ORDER BY ${sortColumn} ${direction}`,
    values,
  );
  const scores = await loadScores(db, result.rows.map((r) => r.id));
  return result.rows.map((row) => present(row, scores.get(row.id) ?? []));
}

export async function updateReview(
  pool: Pool,
  projectId: string,
  reviewId: string,
  input: Partial<ReviewInput>,
): Promise<Review> {
  const existing = await getReview(pool, projectId, reviewId);
  const scores = input.scores ?? existing.scores.map((s) => ({ criterion_id: s.criterion_id, score: s.score, feedback: s.feedback ?? undefined }));
  const { total, grade } = await scoreReview(pool, existing.rubric_id, scores);
  await withTransaction(pool, async (client) => {
    await query(
      client,
      `UPDATE reviews SET comment = $2, total_score = $3, grade_points = $4, letter_grade = $5, updated_at = now()
       WHERE id = $1`,
      [reviewId, input.comment ?? existing.comment, total, grade.points, grade.letter],
    );
    if (input.scores) {
      await query(client, "DELETE FROM review_scores WHERE review_id = $1", [reviewId]);
      for (const s of input.scores) {
        await query(
          client,
          "INSERT INTO review_scores (review_id, criterion_id, score, feedback) VALUES ($1, $2, $3, $4)",
          [reviewId, s.criterion_id, s.score, s.feedback ?? null],
        );
      }
    }
  });
  return getReview(pool, projectId, reviewId);
}

export async function deleteReview(pool: Pool, projectId: string, reviewId: string): Promise<void> {
  const result = await query(pool, "DELETE FROM reviews WHERE id::text = $1 AND project_id::text = $2", [reviewId, projectId]);
  if (result.rowCount === 0) throw notFound("Review");
}
