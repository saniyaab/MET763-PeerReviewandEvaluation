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
//   - Human review: PENDING (student must review and sign off)
// Confidence: Medium
// File purpose: database schema (created at startup) and mock-data seeding.
// =============================================================================

import type { Pool } from "pg";
import { query } from "./db";
import { COURSES, LABS, PROJECTS, USERS } from "./mock/data";

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY,
  name        text NOT NULL,
  email       text NOT NULL UNIQUE,
  role        text NOT NULL CHECK (role IN ('faculty_instructor', 'student_peer'))
);

CREATE TABLE IF NOT EXISTS courses (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  term        text NOT NULL
);

CREATE TABLE IF NOT EXISTS labs (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  department  text NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id          uuid PRIMARY KEY,
  title       text NOT NULL,
  course_id   text NOT NULL REFERENCES courses(id),
  lab_id      text REFERENCES labs(id)
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id  uuid NOT NULL REFERENCES projects(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS rubrics (
  id          uuid PRIMARY KEY,
  title       text NOT NULL,
  description text,
  scope_type  text NOT NULL CHECK (scope_type IN ('project', 'course', 'lab')),
  scope_id    text NOT NULL,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rubrics_scope_idx ON rubrics (scope_type, scope_id);

CREATE TABLE IF NOT EXISTS rubric_criteria (
  id          uuid PRIMARY KEY,
  rubric_id   uuid NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES rubric_criteria(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  weight      numeric NOT NULL DEFAULT 1,
  max_points  numeric,
  position    integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS rubric_criteria_rubric_idx ON rubric_criteria (rubric_id);

-- Each project is bound to exactly one governing rubric (PK on project_id);
-- one rubric may govern many projects.
CREATE TABLE IF NOT EXISTS project_rubric_bindings (
  project_id  uuid PRIMARY KEY REFERENCES projects(id),
  rubric_id   uuid NOT NULL REFERENCES rubrics(id),
  bound_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id            uuid PRIMARY KEY,
  project_id    uuid NOT NULL REFERENCES projects(id),
  rubric_id     uuid NOT NULL REFERENCES rubrics(id),
  reviewer_id   uuid NOT NULL REFERENCES users(id),
  reviewer_role text NOT NULL CHECK (reviewer_role IN ('faculty_instructor', 'student_peer')),
  comment       text,
  total_score   numeric NOT NULL,
  grade_points  numeric NOT NULL,
  letter_grade  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_project_idx ON reviews (project_id);

CREATE TABLE IF NOT EXISTS review_scores (
  review_id     uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  criterion_id  uuid NOT NULL REFERENCES rubric_criteria(id),
  score         numeric NOT NULL,
  feedback      text,
  PRIMARY KEY (review_id, criterion_id)
);
`;

export async function migrateAndSeed(pool: Pool): Promise<void> {
  await pool.query(SCHEMA_SQL);

  for (const u of USERS) {
    await query(pool, "INSERT INTO users (id, name, email, role) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING", [u.id, u.name, u.email, u.role]);
  }
  for (const c of COURSES) {
    await query(pool, "INSERT INTO courses (id, title, term) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING", [c.id, c.title, c.term]);
  }
  for (const l of LABS) {
    await query(pool, "INSERT INTO labs (id, name, department) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING", [l.id, l.name, l.department]);
  }
  for (const p of PROJECTS) {
    await query(pool, "INSERT INTO projects (id, title, course_id, lab_id) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING", [p.id, p.title, p.courseId, p.labId]);
    for (const m of p.memberIds) {
      await query(pool, "INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [p.id, m]);
    }
  }
}
