<!-- AI_USAGE_LOG -->
## AI Usage Log

| Item | Value |
|---|---|
| Session link | https://claude.ai/code/session_01Mj79JHpoGSSrKQhMcsCbL5 |
| AI tool | Claude (Anthropic) autonomous developer agent, Claude Code / Agent SDK harness in the Claude desktop app (see `/Agent_environment.md`) |
| Model | `claude-opus-5-5` (Claude Opus 5.5) |
| Conceptual AI contribution | **100% AI generated / 0% human** (this log was written by the agent; the student prompts inside it are the student's own words) |
| Log type | **Manual session log.** This agent harness did not leave an exportable transcript file on disk for this session (checked `~/.claude/projects/`: only tool-result caches). The course rules allow a manual log with the prompt history, a summary of each output, and dates; the session link above is the cloud record |

---
<!-- /AI_USAGE_LOG -->
# PA2 session log — functional baseline build

Times are America/New_York. Student prompts are copied word for word, typos and spacing included. Text the agent wrote is never labelled as a student prompt; where the student answered a multiple-choice question written by the agent, the question is shown as agent text and only the chosen answer is the student's.

---

## Prompt 1 — 2026-11-16 20:59 ET (student)

~~~~text
Using the documents provided in the folder and the GitHub link provided below (The GitHub is my Project Assignment #1 I would appreciate it if you could use the same GitHub but make a new folder for Project Assignment #2), start on Project Assignment #2 
*before starting make sure to read and reread all files and instructions*
https://github.com/saniyaab/MET763-PeerReviewandEvaluation
~~~~

**Agent output summary**

- Read the course folder on the student's Mac: `CS763_ProjectDescription.pdf`, `ProjectPortalDomainServices.pdf`, `Project Assignment #2 Claude Context.pdf` (PA3 scope update and mock token issuer announcement).
- Attached and cloned the PA1 repository; read `spec.md`, `Agent_environment.md`, `Prompt_test_log.md`, `code_AI_history.md`, the pipeline, Dockerfile, compose file, sources and the PA1 pipeline log.
- Checked the build environment: npm registry unreachable from both the agent workspace and the student's machine (proxy 403), so builds/tests must run on GitHub Actions (same as PA1).
- Did **not** generate any code. Noted that PA2 requires the *student* to prompt the agent with a purely functional, happy-path prompt, and asked the student how to produce it (next entry).

## Prompt 2 — 2026-11-16, between 21:00 and 21:29 ET (student answers to an agent question)

Agent question 1 (agent text): *"PA2 says YOU must prompt the agent with a purely functional, happy-path prompt (no mention of security, validation or encryption), and your logs must show your exact prompts. How should the codebase-generation prompt be produced?"* Options offered by the agent: "Draft it, I'll send it (Recommended)", "Use my current message", "I'll write my own".

Student answer (selected): `I'll write my own`

Agent question 2 (agent text): *"The conceptual_journal_template.md lives in the course Google Drive, which isn't in your folder. What should I do for /.ai_logs/conceptual_journal.md?"*

Student answer (selected): `I'll add the template`

**Agent output summary**

- Waited for the student's prompt. Listed what the master spec's Domain 3 section contains so the prompt could reference it, and said where files would go (`project-assignment-2/` folder, `/.ai_logs/` at repo root) and that tests would run on GitHub Actions.

## Prompt 3 — 2026-11-16 21:29 ET (student; the happy-path build prompt)

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

**Agent output summary**

1. Read the new file `Conceptual Journal and AI Telemetry Log.md.pdf` (journal template) so its sections are known; did not write journal content (the prompt said "Code only, no reports").
2. Generated `project-assignment-2/functional-codebase/` (Express 5 + `pg`, TypeScript):
   - Rubric CRUD with hierarchical criteria and project/course/lab scoping; `project_rubric_bindings` table (PK `project_id`) so each project has one governing rubric and one rubric can govern many projects; PUT/DELETE refused with `409` while a rubric has reviews.
   - Review CRUD for `faculty_instructor` and anonymous `student_peer` reviewers, server-computed weighted total score, letter grade and grade points.
   - Project summary with separate faculty and peer blocks (mean, median, population std dev, min/max, grade distribution, per-criterion means, grade-point trend).
   - Consolidated report (`/reports?course_id=` / `?lab_id=`) as a CSV attachment or JSON, with min-score filter, sorting and optional raw comments.
   - Static mock data (users, courses, labs, projects) seeded into reference tables at startup.
   - Clarifications the agent chose are listed in `functional-codebase/README.md` for the student to review.
3. Wrote tests with Node's built-in runner: 5 unit tests (scoring/statistics) and 20 API integration tests covering every endpoint.
4. Repointed the root `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `sonar-project.properties` and `.github/workflows/devsecops.yml` at the new folder. The pipeline now runs unit tests, starts the compose stack, runs the integration tests, and scans the folder with Trivy, Semgrep (adds a JSON report artifact) and SonarQube Cloud.
5. Local check in the agent workspace: TypeScript compiled against `@types/node` with stand-in types for `express`/`pg` (real packages unreachable); unit tests passed 5/5.
6. Pushed to `main` (commits labelled `AI: ...`).
   - Run [44004585834](https://github.com/saniyaab/MET763-PeerReviewandEvaluation/actions/runs/44004585834): **failed**, 19/20 integration tests. Cause: the agent's own test expected quotes around the download filename in `Content-Disposition`; Express sends `attachment; filename=evaluation-report-CS763.csv` without quotes. Fixed the test assertion only (no service change).
   - Run [44004909266](https://github.com/saniyaab/MET763-PeerReviewandEvaluation/actions/runs/44004909266): **success**. Unit 5/5, integration 20/20, SonarQube Cloud analysis successful, Semgrep `Ran 136 rules on 19 files: 0 findings`, Trivy dependency scan of the app's `package-lock.json` clean; the image scan reported 1 MEDIUM Alpine OS-package finding and 23 findings (10 HIGH) in Node packages bundled with npm inside the `node:22-alpine` base image (e.g. `brace-expansion`, `glob`, `@sigstore/core`), not in the app's own dependencies.
7. Saved the full run log to `project-assignment-2/pipeline-logs/pa2-run-44004909266.log` (GitHub masks secrets as `***`; the compose database password is generated at run time and never printed).
8. Could not read SonarQube Cloud results from the agent workspace (sonarcloud.io blocked by the egress proxy); the dashboard link is in the pipeline log.
