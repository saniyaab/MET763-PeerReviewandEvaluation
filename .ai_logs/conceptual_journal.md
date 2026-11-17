# MASTER CONCEPTUAL JOURNAL & AI TELEMETRY LOG

- **Student Name:** Saniya Bhambhvani
- **Assigned Domain Module:** Domain 3: The Peer Review & Evaluation Gateway
- **Core Technology Stack:** Node.js 22, TypeScript 5.9, Express 5, PostgreSQL 17

---

## SECTION 1: SYSTEM ENVIRONMENT & TOOL SPECIFICATION

### 1.1 AI Tool & Engine Deployments

> Identify all autonomous developer agents, conversational LLMs, inline assistants, or documentation tools utilized during this project milestone.

| Tool Context | Framework / Platform Name & Version | Underlying LLM Brain Model String | Operational Setting / Access Mode |
|---|---|---|---|
| Code Generation | Claude Version 5.11492.5 (1403e2) | claude-opus-5-5 | Claude App |
| Document/Design | Claude Version 5.11492.5 (1403e2) | claude-opus-5-5 | Claude App |

### 1.2 Verification Telemetry Access Checklist

- [ ] Primary Auto-Extracted Session Logs / Appendices Saved to /.ai_logs/ directory
- [ ] External Chat Cloud Share Link 1 (If applicable): [Insert URL Here]
- [ ] External Chat Cloud Share Link 2 (If applicable): [Insert URL Here]

---

## SECTION 2: COGNITIVE REFLECTION — CODE GENERATION & COMPREHENSION

### 2.1 The Architectural Flow (How You Understand the Code)

> Provide a rigorous, detailed architectural breakdown explaining the data path your AI tool generated for your core routes (e.g., /api/v1/assets/pools/allocate). Describe how an incoming HTTP request payload is captured by your framework, parsed by your middleware, processed via database queries, and safely closed or rolled back inside your transaction engine. State what design patterns (Repository, MVC, Singleton, etc.) the AI decided to adopt.

I traced the most important write route, `POST /api/v1/evaluations/projects/{project_id}/reviews`, from start to finish.

1. **Capture:** `server.ts` runs `migrateAndSeed()` first and it creates the schema with `CREATE TABLE IF NOT EXISTS`. It seeds the mock users, courses, labs, and projects from `src/mock/data.ts`. It retries up to 30 times while PostgreSQL starts, then calls `createApp(pool)`. In `app.ts`, `express.json({ limit: "1mb" })` parses the body and the request goes to `evaluationsRouter(pool)` in `routes/evaluations.ts`.
2. **Routing:** There is no controller layer. The route handler passes `req.body` straight to `createReview(pool, projectId, req.body)` in `services/reviews.ts`. TypeScript types such as `ReviewInput` describe the body, but they disappear at runtime. This means that nothing checks its shape.
3. **Service + Database:** `createReview` does 4 reads on the shared pool, all outside any transaction:
   1. `assertProjectExists`
   2. `governingRubricId`, which reads `project_rubric_bindings`
   3. an optional lookup of the user's role, only when `reviewer_role` is missing from the body
   4. `scoreReview`, which loads the criteria tree and runs the pure function `computeTotalScore` from `services/scoring.ts`
4. **Transaction:** Only the writes go through `withTransaction()` in `db.ts`: `BEGIN`, an `INSERT INTO reviews`, an `INSERT INTO review_scores` for each score, then `COMMIT`. If anything throws, it runs `ROLLBACK` and always releases the client in the end. Every query uses `$n` placeholders, so there's no string-built SQL. The one dynamic `ORDER BY` in `listReviews` comes from a whitelist (`SORT_COLUMNS`).
5. **Close:** The service reads the new row back with `getReview` and returns 201 with a `Location` header. Express 5 forwards rejected promises to the error handler in `app.ts`, which maps `HttpError` to its status and everything else to 500.

**Design patterns the AI chose:**

- **Layered Service/Transaction Script:** Routes call service modules and the services hold the SQL. There's no separate repository layer, so data access and business rules are mixed.
- **Module-Level Singleton:** One pg Pool (`pool ??= new Pool(...)`) is shared by every request.
- **Pure Functional Core:** `scoring.ts` has no I/O, which is why it was the only part with unit tests.
- **Derived-State Table:** `recomputeBindings()` rebuilds `project_rubric_bindings` after every rubric create, update or delete.

### 2.2 Defensive Edge-Case Evaluation (Line-by-Line Code Review)

> Perform a line-by-line human audit of the generated source code. Identify where the AI tool completely failed to account for edge cases, unusual boundaries, or unexpected system properties prior to running your pipeline scanners. (e.g., What happens if an integer balance value scales to a negative integer? How does the routing loop handle an invalid JSON payload sequence?)

| # | Where | Edge Case | What Happens |
|---|---|---|---|
| 1 | `reviews.ts` `scoreReview` / `computeTotalScore` | score is negative or above `max_points` | Accepted as is. A score of 50 on a 10-point criterion pushes `total_score` far above 100. A negative score drags it below 0. `toGrade` still gives it a letter. |
| 2 | `reviews.ts` `createReview` | A score for a `criterion_id` from a different rubric, or for a parent (non-leaf) criterion | The foreign key only checks that the criterion exists somewhere. The row is stored, but the total ignores it. The stored scores and the computed grade disagree. |
| 3 | `reviews.ts` `createReview` | Body has no `scores` | `input.scores.map` throws a `TypeError` and the client gets 500 instead of 400. |
| 4 | `rubrics.ts` `getRubric` (`WHERE id = $1`) | `rubric_id` isn't a valid UUID, e.g. `/rubrics/abc` | Postgres rejects the cast. The error handler returns 500 with the raw database message (`invalid input syntax for type uuid…`). Other lookups use `id::text = $1` and return 404, so the code isn't consistent. |
| 5 | `routes/evaluations.ts` `qnum` | `?min_score=abc` | `Number("abc")` is `NaN` and gets passed into the SQL filter and the report filter. The client never sees an error, just a filtered result that makes no sense. |
| 6 | `schema.ts` `reviews` | Same reviewer submits several times for one project | No unique constraint on `(project_id, reviewer_id)`. One person can submit many reviews and skew the mean and standard deviation. |
| 7 | `rubrics.ts` `createRubric` | `scope_id` refers to a course or lab that doesn't exist, or criteria have `weight: 0`, negative weights, or no `max_points` | All accepted. A leaf with `max_points: null` always scores 0. Weights that add up to 0 return 0 without any error. |
| 8 | `rubrics.ts` `recomputeBindings` | A new course- or lab-level rubric is created | Projects in that scope that have no reviews yet are silently rebound to the newest rubric. Creating a rubric changes the governing rubric of other projects without asking. |
| 9 | `rubrics.ts` `updateRubric` / `deleteRubric` | A review is submitted between `assertNotInUse()` and the transaction | The in-use check runs outside the transaction, so a rubric can be changed or deleted while it's in use (time-of-check/time-of-use race). |
| 10 | `reviews.ts` `updateReview` | Clearing a comment by sending `"comment": null` | `input.comment ?? existing.comment` keeps the old comment. A reviewer can't clear it. |
| 11 | `aggregation.ts` `reportToCsv` | A comment that starts with `=`, `+`, `-` or `@` | `csvCell` only escapes quotes, commas, and newlines. The value goes into the exported CSV as is and a spreadsheet will treat it as a formula. |
| 12 | `app.ts` | Large request body | The AI raised the JSON body limit from PA1's 100kb to 1mb without explaining why. |

### 2.3 The AI Agent's "Security Sins" (Evaluating Code Deficiencies)

> Reflect on the prompt sequence fed to your generation tool. Evaluate why it naturally generated insecure code under your happy-path functional prompt constraints. Detail what security shortcuts the model attempted to take to make the feature execute quickly, and analyze how easily it fell into standard vulnerability traps like BOLA/IDOR, Race Conditions, or input injection.

My prompt was deliberately functional only: “build every Domain 3 requirement and endpoint”, “keep going until the build and tests pass”. The agent took the shortest path to successful tests. The integration tests only send well-formed requests from the seeded users, so any check that wasn’t needed to pass them simply doesn’t exist. The shortcuts I found:

- **Trusting the client for identity and role (CWE-269, related CWE-639; V-03).** `reviewer_id` and `reviewer_role` come straight from the request body. The README even says “Reviewer role: taken from the request body”. Any caller can post as a `faculty_instructor` using a student’s ID, or post a faculty review as `student_peer` so it shows up anonymously. Faculty and peer results end up in the wrong blocks of the summary, which defeats the main purpose of the service.
- **No authentication, BOLA/IDOR and missing authorization (CWE-306, CWE-639, CWE-862; V-01, V-02, V-04).** No route checks who is calling (CWE-306). Anyone who knows or lists a `review_id` can read it, rewrite its scores (PUT), or delete it (CWE-639). Anyone can also create or rescope rubrics and export reports (CWE-862). Nothing checks whether a reviewer is reviewing their own project. The schema even has a `project_members` table, but no service reads it.
- **Weak Anonymity (CWE-312; V-12):** Peer anonymity only happens in the response (`present()` sets `reviewer_id` to null). The real reviewer ID and all comments are stored in cleartext and joined in every query, so anyone with database or backup access can unmask peers. One forgotten mapping in a future endpoint would also expose them.
- **Race Condition (CWE-367; V-07):** The “a rubric cannot be modified while in use” rule is checked before the transaction starts, not inside it with a lock or constraint.
- **No Input Validation (CWE-20 / CWE-1284; V-05):** Scores, weights, and query parameters aren’t bounds-checked. One out-of-range score corrupts a project’s mean, standard deviation, and composite grade.
- **One Action Enforced Zero Times (CWE-837; V-06):** A reviewer can submit unlimited reviews of the same project.
- **Over-Sharing (CWE-862 / CWE-359, V-04; CWE-209, V-09):** `GET /reports` with no filter exports every project in every course. `include_comments=true` adds every raw comment. 500 responses echo internal database error text, and even malformed JSON or oversize bodies come back as 500 instead of 400/413.
- **Formula injection in the export (CWE-1236; V-08).** Stored: a comment or criterion title starting with `=` becomes a live formula (see 2.2 #11). Reflected: `course_id`/`lab_id` from the query string are echoed into the CSV header line. This is the path SonarQube flagged as SQ-01.
- **Defaults nobody chose (CWE-674 / CWE-770, V-10; CWE-250, V-11).** Rubric nesting has no depth limit and is processed recursively, so one deep rubric can overflow the call stack, and list endpoints have no pagination. The app connects to Postgres as the superuser the official image creates and runs DDL on every start.

**Why the scanners missed almost everything:** Semgrep ran 136 rules on 19 files and found 0 issues. SonarQube’s first three analyses also showed 0, but that result was inconclusive. During Project Assignment #1, the agent pushed a temporary `bootstrap-lockfile` branch to generate the lockfile and SonarCloud kept it as the project’s main branch. `main` was analyzed as a short-lived branch against a branch that no longer existed. The non-blocking pipeline still printed `ANALYSIS SUCCESSFUL`. That was a configuration flaw the AI introduced and nobody noticed until we checked the SonarCloud API. After I approved the branch fix and re-ran the pipeline (run 44027046164), SonarQube reported 1 BLOCKER: S5131 reflected XSS at `evaluations.ts:119`. It’s a false positive as XSS, because the response is a text/csv attachment that the browser downloads instead of rendering. The taint path is real, though: `lab_id` from the query string lands unescaped in the CSV header, which makes it a reflected CSV injection (CWE-1236, V-08). So the scanners found one real data flow and gave it the wrong name. Every authorization and business-logic flaw came from manual review.

---

## SECTION 3: COGNITIVE REFLECTION — DOCUMENT AUTHORING & THREAT DESIGN

### 3.1 AI Collaboration Matrix for Security Analysis

> Detail exactly how you collaborated with your chosen AI tools to construct your written security requirements, abuse cases, attack trees, and threat modeling frameworks.

1. **Code Generation (Autonomous Agent):** I gave the agent my own happy-path prompt. Then, the agent built the codebase, the tests, and the pipeline changes. (Saved a manual session log)
2. **Review (Multi-Turn, Verification-Focused):** I reviewed the code myself, then asked Claude to check it again without changing anything. I cross-checked its findings against the source and the pipeline log before recording them here.
3. **Security Documents (Constraint-Based, Multi-Turn Chaining):** I wrote one prompt asking for both `sast-triage-report.md` and `security-analysis.md`. I limited it to this codebase (“not generic examples”), told it not to change any code, and told it to review the code by hand because Semgrep found 0. The agent couldn’t reach SonarCloud, so I chained three follow-up prompts:
   1. First, I tried giving it my Chrome session, but the extension wasn’t connected.
   2. Then, I signed in through the built-in browser so it could read the SonarCloud API.
   3. Finally, after it found the branch problem, I approved changing my SonarCloud project and re-running the pipeline.

### 3.2 Evaluation of Automated Conceptual "Blind Spots"

> Analyze the output your document-authoring AI generated. Did the tool hallucinate security threat concepts, overlook critical domain-specific logical risks (like over-allocating hardware inventory pools), or suggest generic text summaries that lacked rigorous engineering context? Detail how you manually audited and revised the AI's structural concepts to match real-world parameters.

- **Invented Business Rules:** The master spec asks for “mean scores, weighted grade point trends, standard deviations”. The agent added its own rules:
  - a 70% faculty / 30% peer composite score
  - BU-style letter cutoffs (A ≥ 93 …)
  - population standard deviation (not sample standard deviation)
  - a per-day “grade point trend”
- **None of these are in the Spec:** They’re reasonable, but the agent made them up. It did list them in the README as “clarifications” which helped me find them.
- **Scope Precedence:** The spec says each project has exactly one governing rubric, but doesn’t say which one wins when a project, course, and lab rubric all apply. The agent chose project > course > lab, newest wins. It also rebinds projects automatically which led to the silent-rebinding edge case in 2.2 #8.
- **Definition of “In Use”:** The agent decided “in use” means at least one review exists. Another reading is that a rubric is in use as soon as it’s bound to a project. The AI’s own security analysis (SR-16) reused this definition without questioning it, so I still need to confirm or change that requirement.
- **Its Own Test was Wrong:** The first pipeline run failed 19/20. The agent’s own test expected quotes around the CSV download filename, but Express doesn’t add them. The agent fixed the test, not the service, which was correct here. It shows the AI’s tests encode its own assumptions, so a green test suite doesn’t prove the spec is met.
- **“Tests Pass” ≠ Secure:** All 20 integration tests are happy-path. None sends a negative score, a fake role or a malformed ID, which is why every flaw in 2.2 and 2.3 passed CI.
- **AI-Introduced Pipeline Flaw:** SonarQube’s clean result was false comfort caused by the agent’s own PA1 workaround (`bootstrap-lockfile`). Because the scans are non-blocking, the misconfiguration stayed hidden for a whole assignment. A scanner that reports 0 needs its configuration checked before the 0 means anything.
- **Mislabeled Scanner Finding:** SonarQube called the CSV path XSS. Accepting it as XSS would have been wrong, and dismissing it as a false positive would have missed a real CWE-1236. I kept the finding and reclassified it as reflected CSV injection (V-08).
- **Errors in the AI’s Own Drafts:** While writing the triage report, the agent caught three of its own mistakes:
  - It first explained Trivy’s 24th alert as a duplicate brace-expansion, but the log showed a second installed copy of pacote.
  - It wrote an unverified claim about Node’s bundled zlib and then rewrote it.
  - A text-replacement script edited the wrong M-08 row (threat T-25), and the agent had to restore it from git.
- Each draft looked confident before it was checked.
- **Analysis Built on Invented Rules:** The V-03 exploit sketch says the impact is larger because “faculty is weighted at 70%”. That 70/30 composite is one of the invented business rules above. The threat analysis treats the AI’s own assumption as a requirement.
- **Open Question Flagged, Not Invented:** The master spec doesn’t name Domain 3’s “designated sensitive field” for PA3 encryption. The agent listed it as an open question and suggested candidates (peer reviewer identity and/or comment text) without picking one. That decision is mine.
- **PA3 Threat Picks are Suggestions:** Section 7.2 of the security analysis proposes T-06 (no audit trail), T-12 (no rate limiting) and T-22 (peer de-anonymization). I still need to choose and justify the 3 STRIDE threats myself.

---

## SECTION 4: HUMAN VERIFICATION & AUDIT TRAIL LOG

> Record every manual configuration test, integration check, dynamic execution verification (Postman, cURL loops), or tool scan triage loop handled completely by you by hand.

| Timestamp | Component Target | Testing/Auditing Methodology | Verified Outcome / Discovered Defect |
|---|---|---|---|
| [2026-11-16] | Happy-path prompt | Checked the final prompt against the PA2 rule (no security, validation, or encryption wording) | Success: prompt is purely functional; Copied verbatim into `/.ai_logs/pa2-session-log.md` |
| [2026-11-16] | Pipeline run 44004909266 | Read the saved log in `project-assignment-2/pipeline-logs/` | Success: unit 5/5, integration 20/20, Semgrep 0 findings (136 rules, 19 files), Trivy dependency scan clean; Image findings only in base image |
| [2026-11-16] | Commit history | Reviewed git log | First PA2 failure (19/20) was a wrong test assertion, fixed in b26062f without changing the service. All PA2 commits use the AI: label |
| [2026-11-16] | `POST /projects/{id}/reviews` (`services/reviews.ts`) | Manual line-by-line code review | Defects: client-supplied `reviewer_role` trusted (CWE-807); no score bounds (CWE-1284); no one-review-per-reviewer rule (CWE-837); missing scores → 500 |
| [2026-11-16] | `PUT/DELETE /rubrics/{id}` (`services/rubrics.ts`) | Manual code review of the transaction boundaries | Defect: in-use check is outside the transaction (TOCTOU, CWE-367). `recomputeBindings` silently rebinds unreviewed projects |
| [2026-11-16] | Review read/update/delete routes | Manual code review for authorization | Defect: no ownership or role checks on any route (CWE-862 / CWE-639); `project_members` table is never used |
| [2026-11-16] | `GET /reports` (`services/aggregation.ts`) | Manual code review of the CSV export | Defects: unfiltered call exports all projects (CWE-200); no formula neutralization in CSV cells (CWE-1236) |
| [2026-11-16] | Error handling (`app.ts`, `getRubric`) | Manual code review | Defect: non-UUID `rubric_id` returns 500 with raw database error text (CWE-209) |
| [2026-11-17] | SonarCloud project | Signed in through the built-in browser so the agent could read the SonarCloud Web API | Found `main` registered as a short-lived branch of the deleted `bootstrap-lockfile`. The earlier 0 results were inconclusive |
| [2026-11-17] | SonarCloud branch config | Approved the fix (delete the short-lived `main` entry, rename the main branch to `main`) | Re-run 44027046164: build passed, 5/5 unit and 20/20 integration tests, SonarQube 1 BLOCKER (S5131) |
| [2026-11-17] | SQ-01 / `evaluations.ts:119` | Checked SonarQube’s taint path against the code and response headers | False positive as XSS (text/csv attachment); true positive as reflected CSV injection, merged into V-08 |
