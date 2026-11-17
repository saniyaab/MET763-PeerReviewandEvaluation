<!-- AI_USAGE_LOG -->
## AI Usage Log

| Item | Value |
|---|---|
| Language / stack | TypeScript 5.9 on Node.js 22, Express 5, PostgreSQL 17 (`pg`), Docker Compose |
| AI tool | Claude (Anthropic) autonomous developer agent, Claude Code / Agent SDK harness in the Claude desktop app. See `/Agent_environment.md` |
| Model | `claude-opus-5-5` (Claude Opus 5.5) |
| AI contribution | **100% AI generated / 0% human refactored** (code, tests and this README) |
| Human modifications | None yet |
| Human verification trail | CI build + unit + API integration tests on GitHub Actions (log in `../pipeline-logs/`). **Student line-by-line review: PENDING** |
| Session link | https://claude.ai/code/session_01Mj79JHpoGSSrKQhMcsCbL5 |
| Session log (all prompts, verbatim) | [`/.ai_logs/pa2-session-log.md`](../../.ai_logs/pa2-session-log.md) |

### Student build prompt (verbatim, typos included)

Sent 2026-11-16 21:29 ET. This is the happy-path prompt the codebase was generated from. The other prompts of the session are in the session log.

~~~~text
here is my happy-path prompt: 
CS763 Project Assignment 2. Repo: https://github.com/saniyaab/MET763-PeerReviewandEvaluation. Course docs are in the folder you can access.

Using my PA1 setup (Node.js/TypeScript, Express, PostgreSQL), build every Domain 3 requirement and endpoint from ProjectPortalDomainServices.pdf in functional-codebase/. Use local static mock data for projects, courses, labs and users. Code only, no reports.

- Write API integration tests for every endpoint and run them in the pipeline. Keep going until the build and tests pass.
- Point the Dockerfile, compose file, Sonar config and devsecops.yml at functional-codebase/.
- Follow the project description's AI logging rules: the header on every file, "AI:" commit labels, and the session export in /.ai_logs/. Copy my prompts word for word.
- Push to main, save the pipeline log, and summarize. Don't tag a release.
and my conceptual_journal_template is in the folder now
~~~~

---
<!-- /AI_USAGE_LOG -->
# functional-codebase — Peer Review & Evaluation Gateway (Domain 3)

PA2 functional baseline. Implements the professor's master specification for Domain 3 (`ProjectPortalDomainServices.pdf`), happy path only. Built from the prompt above, which asked for functionality only.

## Endpoints

All business routes are under `/api/v1/evaluations`.

| Method | Path | What it does |
|---|---|---|
| POST | `/rubrics` | Create a rubric with hierarchical criteria, scoped to a project, course or lab |
| GET | `/rubrics?project_id=&course_id=&lab_id=` | Find rubrics by scope (`project_id` also returns the project's governing rubric) |
| GET / PUT / DELETE | `/rubrics/{rubric_id}` | Read, update or delete a rubric. PUT and DELETE return `409` while the rubric is in use |
| GET | `/projects/{project_id}/summary` | Aggregated report for one project, faculty and peer statistics in separate blocks |
| POST | `/projects/{project_id}/reviews` | Submit a review (raw scores + feedback) against the project's governing rubric |
| GET | `/projects/{project_id}/reviews?min_score=&reviewer_role=&sort=&order=` | Raw review entries, filtered by minimum score |
| GET / PUT / DELETE | `/projects/{project_id}/reviews/{review_id}` | Read, update or remove one review |
| GET | `/reports?course_id=` or `?lab_id=` (also `project_id`, `min_score`, `sort`, `order`, `include_comments=true`, `format=json`) | One consolidated report file (CSV attachment by default) for every project in the course or lab |

Probes outside the router: `GET /health`, `GET /health/ready`, `GET /api/v1`.

### Example: create a rubric

```json
POST /api/v1/evaluations/rubrics
{
  "title": "CS763 Capstone Rubric",
  "scope_type": "course",
  "scope_id": "CS763",
  "created_by": "10000000-0000-4000-8000-000000000001",
  "criteria": [
    { "title": "Technical Implementation", "weight": 60, "subcriteria": [
      { "title": "Functionality", "weight": 70, "max_points": 10 },
      { "title": "Code Quality",  "weight": 30, "max_points": 10 } ] },
    { "title": "Presentation", "weight": 40, "max_points": 20 }
  ]
}
```

### Example: submit a review

```json
POST /api/v1/evaluations/projects/30000000-0000-4000-8000-000000000002/reviews
{
  "reviewer_id": "10000000-0000-4000-8000-000000000001",
  "reviewer_role": "faculty_instructor",
  "comment": "Solid threat model.",
  "scores": [
    { "criterion_id": "<Functionality id>", "score": 9, "feedback": "All features worked." },
    { "criterion_id": "<Code Quality id>", "score": 8 },
    { "criterion_id": "<Presentation id>", "score": 15 }
  ]
}
```

Response `201` with `total_score: 82.2`, `letter_grade: "B-"`, `grade_points: 2.7`.

## Clarifications the agent chose (the spec allows minor clarifications; review these)

1. **Scope precedence.** When several rubrics cover a project, the most specific scope governs it: project, then course, then lab; newest wins a tie. Bindings live in `project_rubric_bindings`, whose primary key is `project_id`, so a project has at most one governing rubric and a rubric can govern many projects.
2. **Stable bindings.** Once a project has reviews it keeps its rubric, even if a more specific rubric is added later.
3. **"In use"** means at least one review references the rubric.
4. **Scoring.** Reviewers score leaf criteria. Leaf = `score / max_points`; a parent = weight-averaged children; the review total = weight-averaged top-level criteria × 100 (0–100, 2 decimals).
5. **Grades.** BU-style letter cutoffs (A ≥ 93 … D ≥ 60, else F) mapped to a 4.0 grade-point scale. "Weighted grade point trend" = per-day mean grade points plus a running (cumulative) mean.
6. **Statistics.** Mean, median, population standard deviation, min, max, letter-grade distribution and per-criterion means, computed separately for `faculty_instructor` and `student_peer`.
7. **Anonymity.** Student peer reviews are returned with `reviewer_id: null` and `reviewer_display: "Anonymous Peer"`.
8. **Composite score** (reports only): 70% faculty mean + 30% peer mean when both exist, otherwise whichever exists. `min_score` on `/reports` filters projects by composite score and comments by review total.
9. **Report file.** CSV with three sections: `[PROJECT SUMMARY]`, `[CRITERION MATRIX]` and, with `include_comments=true`, `[REVIEW COMMENTS]`.
10. **Reviewer role.** Taken from the request body; if omitted, from the mock user's role.

## Mock data (`src/mock/data.ts`)

Static data for entities owned by other Project Portal services, seeded into reference tables at startup: 9 users (3 `faculty_instructor`, 6 `student_peer`), 3 courses (`CS501`, `CS763`, `EC544`), 3 labs (`lab_cybersec`, `lab_robotics`, `lab_hci`) and 7 projects.

## Database

`src/schema.ts` creates the tables on startup: `users`, `courses`, `labs`, `projects`, `project_members` (mock reference data), and `rubrics`, `rubric_criteria` (self-referencing `parent_id` for the hierarchy), `project_rubric_bindings`, `reviews`, `review_scores` (owned by this service).

## Code layout

```
src/
  server.ts              entry point: schema + seed, start HTTP
  app.ts                 Express app, probes, error handling
  routes/evaluations.ts  all /api/v1/evaluations routes
  services/rubrics.ts    rubric CRUD, criteria tree, project bindings
  services/reviews.ts    review CRUD and scoring
  services/aggregation.ts project summary + consolidated report (JSON/CSV)
  services/scoring.ts    pure scoring/statistics functions
  schema.ts, db.ts, config.ts, errors.ts, mock/data.ts
tests/
  scoring.test.ts        unit tests (no database)
  api.test.ts            API integration tests for every endpoint
```

## Run and test

From the repository root (the root `Dockerfile` and `docker-compose.yml` build this folder):

```bash
cp .env.example .env            # set POSTGRES_PASSWORD (letters/digits)
docker compose up -d --build
cd project-assignment-2/functional-codebase
npm ci
npm run test:unit
BASE_URL=http://127.0.0.1:3000 npm run test:integration   # needs a fresh database
```

The integration tests expect an empty database (`docker compose down -v` between runs). The pipeline (`.github/workflows/devsecops.yml`) runs all of this on every push to `main`.

`package-lock.json` is the npm lockfile reused from PA1 (same dependency set, generated by `npm install` on GitHub Actions during PA1). It is JSON, which cannot hold a comment header; its provenance is recorded here.

The `src/` folder at the repository root is the PA1 barebones app, kept unchanged for the `project-assignment-1` tag.
