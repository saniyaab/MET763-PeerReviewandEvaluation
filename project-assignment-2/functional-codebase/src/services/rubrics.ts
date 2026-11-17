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
// File purpose: rubric management (functional requirement 1): hierarchical
//   criteria, project/course/lab scoping and project-to-rubric binding.
// =============================================================================

import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { type Db, query, withTransaction } from "../db";
import { conflict, notFound } from "../errors";
import { buildCriteriaTree, type CriterionNode, type CriterionRow } from "./scoring";

export interface CriterionInput {
  title: string;
  description?: string;
  weight?: number;
  max_points?: number;
  subcriteria?: CriterionInput[];
}

export interface RubricInput {
  title: string;
  description?: string;
  scope_type: "project" | "course" | "lab";
  scope_id: string;
  created_by?: string;
  criteria?: CriterionInput[];
}

export interface Rubric {
  id: string;
  title: string;
  description: string | null;
  scope_type: string;
  scope_id: string;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  in_use: boolean;
  bound_project_ids: string[];
  criteria: CriterionNode[];
}

interface RubricRow {
  id: string;
  title: string;
  description: string | null;
  scope_type: string;
  scope_id: string;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

async function insertCriteria(
  client: PoolClient,
  rubricId: string,
  items: CriterionInput[],
  parentId: string | null,
): Promise<void> {
  for (const [index, c] of items.entries()) {
    const id = randomUUID();
    await query(
      client,
      `INSERT INTO rubric_criteria (id, rubric_id, parent_id, title, description, weight, max_points, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, rubricId, parentId, c.title, c.description ?? null, c.weight ?? 1, c.max_points ?? null, index],
    );
    if (c.subcriteria && c.subcriteria.length > 0) {
      await insertCriteria(client, rubricId, c.subcriteria, id);
    }
  }
}

/**
 * Re-evaluates which rubric governs each project. The most specific scope wins
 * (project > course > lab); ties go to the newest rubric. Projects that already
 * have reviews keep their current rubric so existing grades stay consistent.
 */
export async function recomputeBindings(client: Db): Promise<void> {
  await query(
    client,
    `DELETE FROM project_rubric_bindings b
     WHERE NOT EXISTS (SELECT 1 FROM reviews r WHERE r.project_id = b.project_id)`,
  );
  await query(
    client,
    `INSERT INTO project_rubric_bindings (project_id, rubric_id)
     SELECT DISTINCT ON (p.id) p.id, r.id
     FROM projects p
     JOIN rubrics r
       ON (r.scope_type = 'project' AND r.scope_id = p.id::text)
       OR (r.scope_type = 'course'  AND r.scope_id = p.course_id)
       OR (r.scope_type = 'lab'     AND r.scope_id = p.lab_id)
     WHERE NOT EXISTS (SELECT 1 FROM project_rubric_bindings b WHERE b.project_id = p.id)
     ORDER BY p.id,
              CASE r.scope_type WHEN 'project' THEN 1 WHEN 'course' THEN 2 ELSE 3 END,
              r.created_at DESC
     ON CONFLICT (project_id) DO NOTHING`,
  );
}

export async function loadCriteriaTree(db: Db, rubricId: string): Promise<CriterionNode[]> {
  const rows = await query<CriterionRow>(
    db,
    `SELECT id, parent_id, title, description, weight, max_points, position
     FROM rubric_criteria WHERE rubric_id = $1 ORDER BY position`,
    [rubricId],
  );
  return buildCriteriaTree(rows.rows);
}

async function hydrate(db: Db, row: RubricRow): Promise<Rubric> {
  const [criteria, bindings, usage] = await Promise.all([
    loadCriteriaTree(db, row.id),
    query<{ project_id: string }>(db, "SELECT project_id FROM project_rubric_bindings WHERE rubric_id = $1 ORDER BY project_id", [row.id]),
    query<{ count: number }>(db, "SELECT count(*) AS count FROM reviews WHERE rubric_id = $1", [row.id]),
  ]);
  return {
    ...row,
    in_use: usage.rows[0].count > 0,
    bound_project_ids: bindings.rows.map((b) => b.project_id),
    criteria,
  };
}

export async function getRubric(db: Db, rubricId: string): Promise<Rubric> {
  const result = await query<RubricRow>(db, "SELECT * FROM rubrics WHERE id = $1", [rubricId]);
  if (result.rows.length === 0) throw notFound("Rubric");
  return hydrate(db, result.rows[0]);
}

export async function createRubric(pool: Pool, input: RubricInput): Promise<Rubric> {
  const id = randomUUID();
  await withTransaction(pool, async (client) => {
    await query(
      client,
      `INSERT INTO rubrics (id, title, description, scope_type, scope_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, input.title, input.description ?? null, input.scope_type, input.scope_id, input.created_by ?? null],
    );
    await insertCriteria(client, id, input.criteria ?? [], null);
    await recomputeBindings(client);
  });
  return getRubric(pool, id);
}

export interface RubricFilter {
  project_id?: string;
  course_id?: string;
  lab_id?: string;
}

export async function listRubrics(db: Db, filter: RubricFilter): Promise<Rubric[]> {
  const where: string[] = [];
  const values: unknown[] = [];
  if (filter.project_id) {
    values.push(filter.project_id);
    where.push(
      `((r.scope_type = 'project' AND r.scope_id = $${values.length})
        OR r.id IN (SELECT rubric_id FROM project_rubric_bindings WHERE project_id::text = $${values.length}))`,
    );
  }
  if (filter.course_id) {
    values.push(filter.course_id);
    where.push(`(r.scope_type = 'course' AND r.scope_id = $${values.length})`);
  }
  if (filter.lab_id) {
    values.push(filter.lab_id);
    where.push(`(r.scope_type = 'lab' AND r.scope_id = $${values.length})`);
  }
  const sql = `SELECT r.* FROM rubrics r ${where.length ? `WHERE ${where.join(" OR ")}` : ""} ORDER BY r.created_at DESC`;
  const result = await query<RubricRow>(db, sql, values);
  return Promise.all(result.rows.map((row) => hydrate(db, row)));
}

async function assertNotInUse(db: Db, rubricId: string): Promise<void> {
  const usage = await query<{ count: number }>(db, "SELECT count(*) AS count FROM reviews WHERE rubric_id = $1", [rubricId]);
  if (usage.rows[0].count > 0) {
    throw conflict("Rubric is in use by submitted reviews and cannot be modified or deleted");
  }
}

export async function updateRubric(pool: Pool, rubricId: string, input: Partial<RubricInput>): Promise<Rubric> {
  const existing = await getRubric(pool, rubricId);
  await assertNotInUse(pool, rubricId);
  await withTransaction(pool, async (client) => {
    await query(
      client,
      `UPDATE rubrics SET title = $2, description = $3, scope_type = $4, scope_id = $5, updated_at = now()
       WHERE id = $1`,
      [
        rubricId,
        input.title ?? existing.title,
        input.description ?? existing.description,
        input.scope_type ?? existing.scope_type,
        input.scope_id ?? existing.scope_id,
      ],
    );
    if (input.criteria) {
      await query(client, "DELETE FROM rubric_criteria WHERE rubric_id = $1", [rubricId]);
      await insertCriteria(client, rubricId, input.criteria, null);
    }
    await query(client, "DELETE FROM project_rubric_bindings WHERE rubric_id = $1", [rubricId]);
    await recomputeBindings(client);
  });
  return getRubric(pool, rubricId);
}

export async function deleteRubric(pool: Pool, rubricId: string): Promise<void> {
  await getRubric(pool, rubricId);
  await assertNotInUse(pool, rubricId);
  await withTransaction(pool, async (client) => {
    await query(client, "DELETE FROM project_rubric_bindings WHERE rubric_id = $1", [rubricId]);
    await query(client, "DELETE FROM rubrics WHERE id = $1", [rubricId]);
    await recomputeBindings(client);
  });
}

export async function governingRubricId(db: Db, projectId: string): Promise<string | null> {
  const result = await query<{ rubric_id: string }>(db, "SELECT rubric_id FROM project_rubric_bindings WHERE project_id = $1", [projectId]);
  return result.rows[0]?.rubric_id ?? null;
}
