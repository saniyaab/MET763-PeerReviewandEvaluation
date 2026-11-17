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
// File purpose: grade aggregation (functional requirement 3) and the
//   consolidated course/lab report (functional requirement 4).
// =============================================================================

import { type Db, query } from "../db";
import { notFound } from "../errors";
import { compositeScore, LETTERS, mean, median, round2, stdDev } from "./scoring";

interface AggReviewRow {
  id: string;
  project_id: string;
  reviewer_id: string;
  reviewer_role: "faculty_instructor" | "student_peer";
  reviewer_name: string;
  comment: string | null;
  total_score: number;
  grade_points: number;
  letter_grade: string;
  created_at: Date;
}

interface CriterionAggRow {
  project_id: string;
  reviewer_role: string;
  criterion_id: string;
  title: string;
  max_points: number | null;
  mean_score: number;
  review_count: number;
}

interface ProjectRow {
  id: string;
  title: string;
  course_id: string;
  lab_id: string | null;
  rubric_id: string | null;
  rubric_title: string | null;
}

export interface RoleBlock {
  review_count: number;
  mean_score: number | null;
  median_score: number | null;
  std_dev: number | null;
  min_score: number | null;
  max_score: number | null;
  mean_grade_points: number | null;
  grade_distribution: Record<string, number>;
  criterion_means: Array<{ criterion_id: string; title: string; max_points: number | null; mean_score: number }>;
  grade_point_trend: Array<{ date: string; review_count: number; mean_grade_points: number | null; cumulative_mean_grade_points: number | null }>;
}

function buildBlock(reviews: AggReviewRow[], criteria: CriterionAggRow[]): RoleBlock {
  const scores = reviews.map((r) => r.total_score);
  const distribution: Record<string, number> = Object.fromEntries(LETTERS.map((l) => [l, 0]));
  for (const r of reviews) distribution[r.letter_grade] = (distribution[r.letter_grade] ?? 0) + 1;

  // Grade-point trend: per-day mean of weighted grade points plus running mean.
  const byDay = new Map<string, number[]>();
  for (const r of [...reviews].sort((a, b) => a.created_at.getTime() - b.created_at.getTime())) {
    const day = r.created_at.toISOString().slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), r.grade_points]);
  }
  const running: number[] = [];
  const trend = [...byDay.entries()].map(([date, points]) => {
    running.push(...points);
    return { date, review_count: points.length, mean_grade_points: mean(points), cumulative_mean_grade_points: mean(running) };
  });

  return {
    review_count: reviews.length,
    mean_score: mean(scores),
    median_score: median(scores),
    std_dev: stdDev(scores),
    min_score: scores.length ? Math.min(...scores) : null,
    max_score: scores.length ? Math.max(...scores) : null,
    mean_grade_points: mean(reviews.map((r) => r.grade_points)),
    grade_distribution: distribution,
    criterion_means: criteria.map((c) => ({
      criterion_id: c.criterion_id,
      title: c.title,
      max_points: c.max_points,
      mean_score: round2(c.mean_score),
    })),
    grade_point_trend: trend,
  };
}

async function loadProjects(db: Db, where: string, values: unknown[]): Promise<ProjectRow[]> {
  const result = await query<ProjectRow>(
    db,
    `SELECT p.id, p.title, p.course_id, p.lab_id, b.rubric_id, r.title AS rubric_title
     FROM projects p
     LEFT JOIN project_rubric_bindings b ON b.project_id = p.id
     LEFT JOIN rubrics r ON r.id = b.rubric_id
     ${where}
     ORDER BY p.title`,
    values,
  );
  return result.rows;
}

async function loadReviews(db: Db, projectIds: string[]): Promise<AggReviewRow[]> {
  if (projectIds.length === 0) return [];
  const result = await query<AggReviewRow>(
    db,
    `SELECT r.id, r.project_id, r.reviewer_id, r.reviewer_role, u.name AS reviewer_name, r.comment,
            r.total_score, r.grade_points, r.letter_grade, r.created_at
     FROM reviews r JOIN users u ON u.id = r.reviewer_id
     WHERE r.project_id = ANY($1::uuid[])
     ORDER BY r.created_at`,
    [projectIds],
  );
  return result.rows;
}

async function loadCriterionMeans(db: Db, projectIds: string[]): Promise<CriterionAggRow[]> {
  if (projectIds.length === 0) return [];
  const result = await query<CriterionAggRow>(
    db,
    `SELECT r.project_id, r.reviewer_role, s.criterion_id, c.title, c.max_points,
            avg(s.score) AS mean_score, count(*) AS review_count
     FROM review_scores s
     JOIN reviews r ON r.id = s.review_id
     JOIN rubric_criteria c ON c.id = s.criterion_id
     WHERE r.project_id = ANY($1::uuid[])
     GROUP BY r.project_id, r.reviewer_role, s.criterion_id, c.title, c.max_points, c.position
     ORDER BY c.position`,
    [projectIds],
  );
  return result.rows;
}

function splitByRole<T extends { reviewer_role: string }>(rows: T[]) {
  return {
    faculty: rows.filter((r) => r.reviewer_role === "faculty_instructor"),
    peer: rows.filter((r) => r.reviewer_role === "student_peer"),
  };
}

export async function projectSummary(db: Db, projectId: string) {
  const projects = await loadProjects(db, "WHERE p.id::text = $1", [projectId]);
  if (projects.length === 0) throw notFound("Project");
  const project = projects[0];
  const reviews = splitByRole(await loadReviews(db, [project.id]));
  const criteria = splitByRole(await loadCriterionMeans(db, [project.id]));
  const faculty = buildBlock(reviews.faculty, criteria.faculty);
  const peer = buildBlock(reviews.peer, criteria.peer);
  return {
    project: { id: project.id, title: project.title, course_id: project.course_id, lab_id: project.lab_id },
    rubric: project.rubric_id ? { id: project.rubric_id, title: project.rubric_title } : null,
    faculty_evaluations: faculty,
    peer_reviews: peer,
    composite_score: compositeScore(faculty.mean_score, peer.mean_score),
    generated_at: new Date().toISOString(),
  };
}

export interface ReportFilter {
  course_id?: string;
  lab_id?: string;
  project_id?: string;
  min_score?: number;
  sort?: string;
  order?: string;
  include_comments?: boolean;
}

export interface ReportRow {
  project_id: string;
  project_title: string;
  course_id: string;
  lab_id: string | null;
  rubric_id: string | null;
  grading_status: "not_started" | "peer_reviews_only" | "faculty_graded";
  faculty_review_count: number;
  faculty_mean: number | null;
  faculty_std_dev: number | null;
  peer_review_count: number;
  peer_mean: number | null;
  peer_std_dev: number | null;
  composite_score: number | null;
  criteria: Array<{ criterion_id: string; title: string; faculty_mean: number | null; peer_mean: number | null }>;
}

export interface ReportComment {
  review_id: string;
  project_id: string;
  reviewer_role: string;
  reviewer: string;
  total_score: number;
  letter_grade: string;
  comment: string | null;
  created_at: string;
}

export async function buildReport(db: Db, filter: ReportFilter) {
  const where: string[] = [];
  const values: unknown[] = [];
  if (filter.course_id) {
    values.push(filter.course_id);
    where.push(`p.course_id = $${values.length}`);
  }
  if (filter.lab_id) {
    values.push(filter.lab_id);
    where.push(`p.lab_id = $${values.length}`);
  }
  if (filter.project_id) {
    values.push(filter.project_id);
    where.push(`p.id::text = $${values.length}`);
  }
  const projects = await loadProjects(db, where.length ? `WHERE ${where.join(" AND ")}` : "", values);
  const ids = projects.map((p) => p.id);
  const reviews = await loadReviews(db, ids);
  const criteria = await loadCriterionMeans(db, ids);

  let rows: ReportRow[] = projects.map((p): ReportRow => {
    const pr = splitByRole(reviews.filter((r) => r.project_id === p.id));
    const facultyScores = pr.faculty.map((r) => r.total_score);
    const peerScores = pr.peer.map((r) => r.total_score);
    const facultyMean = mean(facultyScores);
    const peerMean = mean(peerScores);
    const pc = criteria.filter((c) => c.project_id === p.id);
    const criterionIds = [...new Set(pc.map((c) => c.criterion_id))];
    return {
      project_id: p.id,
      project_title: p.title,
      course_id: p.course_id,
      lab_id: p.lab_id,
      rubric_id: p.rubric_id,
      grading_status: pr.faculty.length > 0 ? "faculty_graded" : pr.peer.length > 0 ? "peer_reviews_only" : "not_started",
      faculty_review_count: pr.faculty.length,
      faculty_mean: facultyMean,
      faculty_std_dev: stdDev(facultyScores),
      peer_review_count: pr.peer.length,
      peer_mean: peerMean,
      peer_std_dev: stdDev(peerScores),
      composite_score: compositeScore(facultyMean, peerMean),
      criteria: criterionIds.map((cid) => {
        const f = pc.find((c) => c.criterion_id === cid && c.reviewer_role === "faculty_instructor");
        const s = pc.find((c) => c.criterion_id === cid && c.reviewer_role === "student_peer");
        return {
          criterion_id: cid,
          title: (f ?? s)!.title,
          faculty_mean: f ? round2(f.mean_score) : null,
          peer_mean: s ? round2(s.mean_score) : null,
        };
      }),
    };
  });

  if (filter.min_score !== undefined) {
    const min = filter.min_score;
    rows = rows.filter((r) => r.composite_score !== null && r.composite_score >= min);
  }

  const sortKey = (filter.sort ?? "project_title") as keyof ReportRow;
  const dir = filter.order?.toLowerCase() === "desc" ? -1 : 1;
  rows.sort((a, b) => {
    const av = a[sortKey] as unknown;
    const bv = b[sortKey] as unknown;
    if (av === bv) return 0;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    return (av as number | string) < (bv as number | string) ? -dir : dir;
  });

  const includedIds = new Set(rows.map((r) => r.project_id));
  const comments: ReportComment[] = filter.include_comments
    ? reviews
        .filter((r) => includedIds.has(r.project_id))
        .filter((r) => filter.min_score === undefined || r.total_score >= filter.min_score)
        .map((r) => ({
          review_id: r.id,
          project_id: r.project_id,
          reviewer_role: r.reviewer_role,
          reviewer: r.reviewer_role === "student_peer" ? "Anonymous Peer" : r.reviewer_name,
          total_score: r.total_score,
          letter_grade: r.letter_grade,
          comment: r.comment,
          created_at: r.created_at.toISOString(),
        }))
    : [];

  return {
    scope: { course_id: filter.course_id ?? null, lab_id: filter.lab_id ?? null, project_id: filter.project_id ?? null },
    generated_at: new Date().toISOString(),
    project_count: rows.length,
    graded_count: rows.filter((r) => r.grading_status === "faculty_graded").length,
    projects: rows,
    comments,
  };
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvLine(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

/** Renders the report as one consolidated CSV file with three sections. */
export function reportToCsv(report: Awaited<ReturnType<typeof buildReport>>): string {
  const lines: string[] = [];
  lines.push(csvLine(["# Peer Review & Evaluation Gateway - consolidated evaluation report"]));
  lines.push(csvLine(["# generated_at", report.generated_at, "course_id", report.scope.course_id, "lab_id", report.scope.lab_id]));
  lines.push("");
  lines.push("[PROJECT SUMMARY]");
  lines.push(
    csvLine([
      "project_id", "project_title", "course_id", "lab_id", "rubric_id", "grading_status",
      "faculty_review_count", "faculty_mean", "faculty_std_dev",
      "peer_review_count", "peer_mean", "peer_std_dev", "composite_score",
    ]),
  );
  for (const r of report.projects) {
    lines.push(
      csvLine([
        r.project_id, r.project_title, r.course_id, r.lab_id, r.rubric_id, r.grading_status,
        r.faculty_review_count, r.faculty_mean, r.faculty_std_dev,
        r.peer_review_count, r.peer_mean, r.peer_std_dev, r.composite_score,
      ]),
    );
  }
  lines.push("");
  lines.push("[CRITERION MATRIX]");
  lines.push(csvLine(["project_id", "criterion_id", "criterion_title", "faculty_mean", "peer_mean"]));
  for (const r of report.projects) {
    for (const c of r.criteria) {
      lines.push(csvLine([r.project_id, c.criterion_id, c.title, c.faculty_mean, c.peer_mean]));
    }
  }
  if (report.comments.length > 0) {
    lines.push("");
    lines.push("[REVIEW COMMENTS]");
    lines.push(csvLine(["review_id", "project_id", "reviewer_role", "reviewer", "total_score", "letter_grade", "comment", "created_at"]));
    for (const c of report.comments) {
      lines.push(csvLine([c.review_id, c.project_id, c.reviewer_role, c.reviewer, c.total_score, c.letter_grade, c.comment, c.created_at]));
    }
  }
  return `${lines.join("\n")}\n`;
}
