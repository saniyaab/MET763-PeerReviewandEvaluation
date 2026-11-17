// =============================================================================
// Language/Stack: TypeScript 5.9 | Node.js 22 built-in test runner + fetch
// Tool: Claude Code agent harness (Claude desktop app), model claude-opus-5-5
// Prompt Summary: "Write API integration tests for every endpoint and run them
//   in the pipeline" (PA2 happy-path prompt; full verbatim text in /.ai_logs/)
// AI Contribution: 100% AI generated / 0% human refactored
// Human Modifications: none
// Verification:
//   - CI: run by `npm run test:integration` against the docker compose stack
//   - Human review: PENDING (student must review and sign off)
// Confidence: Medium
// File purpose: happy-path API integration tests for every Domain 3 endpoint.
//   Runs against a live server (BASE_URL, default http://127.0.0.1:3000) backed
//   by a fresh database; tests run in order and share state.
// =============================================================================

import assert from "node:assert/strict";
import { before, test } from "node:test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const API = `${BASE_URL}/api/v1/evaluations`;

// Static mock data (src/mock/data.ts)
const FACULTY_RUIZ = "10000000-0000-4000-8000-000000000001";
const STUDENT_AVA = "20000000-0000-4000-8000-000000000001";
const STUDENT_BEN = "20000000-0000-4000-8000-000000000002";
const STUDENT_CHLOE = "20000000-0000-4000-8000-000000000003";
const P1_SECURE_GRADE_PORTAL = "30000000-0000-4000-8000-000000000001"; // CS763, lab_cybersec
const P2_THREAT_MODEL_VIS = "30000000-0000-4000-8000-000000000002"; // CS763, lab_cybersec
const P3_PHISHING = "30000000-0000-4000-8000-000000000003"; // CS763, no lab
const P4_ROVER = "30000000-0000-4000-8000-000000000004"; // CS501, lab_robotics
const P7_DRONES = "30000000-0000-4000-8000-000000000007"; // EC544, lab_robotics
const UNKNOWN_ID = "99999999-0000-4000-8000-000000000000";

interface Json {
  [key: string]: any;
}

async function call(method: string, path: string, body?: unknown): Promise<{ status: number; body: Json; text: string; headers: Headers }> {
  const res = await fetch(`${path.startsWith("http") ? "" : API}${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: Json = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = {};
  }
  return { status: res.status, body: parsed, text, headers: res.headers };
}

const state: {
  courseRubric?: Json;
  projectRubric?: Json;
  labRubric?: Json;
  leaf: Record<string, string>;
  facultyReviewId?: string;
  peerReviewIds: string[];
  extraReviewId?: string;
} = { leaf: {}, peerReviewIds: [] };

const COURSE_RUBRIC = {
  title: "CS763 Capstone Rubric",
  description: "Course-wide rubric for CS763 final projects",
  scope_type: "course",
  scope_id: "CS763",
  created_by: FACULTY_RUIZ,
  criteria: [
    {
      title: "Technical Implementation",
      description: "Overall engineering quality",
      weight: 60,
      subcriteria: [
        { title: "Functionality", description: "Features work as specified", weight: 70, max_points: 10 },
        { title: "Code Quality", description: "Readable, tested code", weight: 30, max_points: 10 },
      ],
    },
    { title: "Presentation", description: "Demo and slides", weight: 40, max_points: 20 },
  ],
};

function scoresFor(functionality: number, quality: number, presentation: number, feedback?: string) {
  return [
    { criterion_id: state.leaf.Functionality, score: functionality, feedback },
    { criterion_id: state.leaf["Code Quality"], score: quality },
    { criterion_id: state.leaf.Presentation, score: presentation },
  ];
}

before(async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE_URL}/health/ready`);
      if (res.ok) return;
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Service at ${BASE_URL} did not become ready`);
});

// ---- service probes -------------------------------------------------------

test("GET /health and /health/ready report the service and database as up", async () => {
  const health = await call("GET", `${BASE_URL}/health`);
  assert.equal(health.status, 200);
  assert.equal(health.body.status, "ok");
  const ready = await call("GET", `${BASE_URL}/health/ready`);
  assert.equal(ready.status, 200);
  assert.equal(ready.body.database, "up");
  const descriptor = await call("GET", `${BASE_URL}/api/v1`);
  assert.equal(descriptor.status, 200);
});

// ---- /rubrics -------------------------------------------------------------

test("POST /rubrics creates a course-scoped rubric with hierarchical criteria and binds the course's projects", async () => {
  const res = await call("POST", "/rubrics", COURSE_RUBRIC);
  assert.equal(res.status, 201);
  assert.match(res.headers.get("location") ?? "", /\/api\/v1\/evaluations\/rubrics\//);
  assert.equal(res.body.scope_type, "course");
  assert.equal(res.body.criteria.length, 2);
  assert.equal(res.body.criteria[0].subcriteria.length, 2);
  assert.equal(res.body.in_use, false);
  assert.deepEqual([...res.body.bound_project_ids].sort(), [P1_SECURE_GRADE_PORTAL, P2_THREAT_MODEL_VIS, P3_PHISHING]);
  state.courseRubric = res.body;
  const tech = res.body.criteria[0];
  state.leaf.Functionality = tech.subcriteria[0].id;
  state.leaf["Code Quality"] = tech.subcriteria[1].id;
  state.leaf.Presentation = res.body.criteria[1].id;
});

test("POST /rubrics with project scope overrides the course rubric for that one project", async () => {
  const res = await call("POST", "/rubrics", {
    title: "Secure Grade Portal custom rubric",
    scope_type: "project",
    scope_id: P1_SECURE_GRADE_PORTAL,
    created_by: FACULTY_RUIZ,
    criteria: [{ title: "Overall", weight: 1, max_points: 100 }],
  });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.bound_project_ids, [P1_SECURE_GRADE_PORTAL]);
  state.projectRubric = res.body;

  const course = await call("GET", `/rubrics/${state.courseRubric!.id}`);
  assert.deepEqual([...course.body.bound_project_ids].sort(), [P2_THREAT_MODEL_VIS, P3_PHISHING]);
});

test("POST /rubrics with lab scope binds lab projects that have no more specific rubric", async () => {
  const res = await call("POST", "/rubrics", {
    title: "Robotics Lab Demo Rubric",
    scope_type: "lab",
    scope_id: "lab_robotics",
    created_by: FACULTY_RUIZ,
    criteria: [{ title: "Demo", weight: 1, max_points: 50 }],
  });
  assert.equal(res.status, 201);
  assert.deepEqual([...res.body.bound_project_ids].sort(), [P4_ROVER, P7_DRONES]);
  state.labRubric = res.body;
});

test("GET /rubrics filters by course_id, lab_id and project_id", async () => {
  const byCourse = await call("GET", "/rubrics?course_id=CS763");
  assert.equal(byCourse.status, 200);
  assert.deepEqual(byCourse.body.data.map((r: Json) => r.id), [state.courseRubric!.id]);

  const byLab = await call("GET", "/rubrics?lab_id=lab_robotics");
  assert.deepEqual(byLab.body.data.map((r: Json) => r.id), [state.labRubric!.id]);

  const byProject = await call("GET", `/rubrics?project_id=${P1_SECURE_GRADE_PORTAL}`);
  assert.deepEqual(byProject.body.data.map((r: Json) => r.id), [state.projectRubric!.id]);

  const governing = await call("GET", `/rubrics?project_id=${P2_THREAT_MODEL_VIS}`);
  assert.deepEqual(governing.body.data.map((r: Json) => r.id), [state.courseRubric!.id]);

  const all = await call("GET", "/rubrics");
  assert.equal(all.body.count, 3);
});

test("GET /rubrics/{rubric_id} returns one rubric, 404 when unknown", async () => {
  const res = await call("GET", `/rubrics/${state.courseRubric!.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.title, COURSE_RUBRIC.title);
  const missing = await call("GET", `/rubrics/${UNKNOWN_ID}`);
  assert.equal(missing.status, 404);
});

test("PUT /rubrics/{rubric_id} updates a rubric that is not in use", async () => {
  const res = await call("PUT", `/rubrics/${state.labRubric!.id}`, {
    title: "Robotics Lab Demo Rubric v2",
    criteria: [
      { title: "Demo", weight: 2, max_points: 50 },
      { title: "Report", weight: 1, max_points: 25 },
    ],
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.title, "Robotics Lab Demo Rubric v2");
  assert.equal(res.body.criteria.length, 2);
  assert.equal(res.body.scope_id, "lab_robotics");
});

// ---- /projects/{project_id}/reviews ---------------------------------------

test("POST /projects/{id}/reviews submits a faculty evaluation and computes the weighted score", async () => {
  const res = await call("POST", `/projects/${P2_THREAT_MODEL_VIS}/reviews`, {
    reviewer_id: FACULTY_RUIZ,
    reviewer_role: "faculty_instructor",
    rubric_id: state.courseRubric!.id,
    comment: "Solid threat model, presentation ran long.",
    scores: scoresFor(9, 8, 15, "All features worked in the demo."),
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.total_score, 82.2);
  assert.equal(res.body.letter_grade, "B-");
  assert.equal(res.body.grade_points, 2.7);
  assert.equal(res.body.reviewer_id, FACULTY_RUIZ);
  assert.equal(res.body.scores.length, 3);
  state.facultyReviewId = res.body.id;
});

test("POST /projects/{id}/reviews accepts anonymous student peer reviews", async () => {
  const first = await call("POST", `/projects/${P2_THREAT_MODEL_VIS}/reviews`, {
    reviewer_id: STUDENT_AVA,
    comment: "Excellent work!",
    scores: scoresFor(10, 10, 20),
  });
  assert.equal(first.status, 201);
  assert.equal(first.body.reviewer_role, "student_peer");
  assert.equal(first.body.reviewer_id, null);
  assert.equal(first.body.reviewer_display, "Anonymous Peer");
  assert.equal(first.body.total_score, 100);

  const second = await call("POST", `/projects/${P2_THREAT_MODEL_VIS}/reviews`, {
    reviewer_id: STUDENT_BEN,
    reviewer_role: "student_peer",
    comment: "Needs more testing.",
    scores: scoresFor(5, 5, 10),
  });
  assert.equal(second.status, 201);
  assert.equal(second.body.total_score, 50);
  assert.equal(second.body.letter_grade, "F");
  state.peerReviewIds = [first.body.id, second.body.id];
});

test("POST /projects/{id}/reviews rejects a review that targets a rubric not governing the project", async () => {
  const res = await call("POST", `/projects/${P2_THREAT_MODEL_VIS}/reviews`, {
    reviewer_id: STUDENT_CHLOE,
    rubric_id: state.labRubric!.id,
    scores: [],
  });
  assert.equal(res.status, 409);
  const missing = await call("POST", `/projects/${UNKNOWN_ID}/reviews`, { reviewer_id: STUDENT_CHLOE, scores: [] });
  assert.equal(missing.status, 404);
});

test("GET /projects/{id}/reviews lists raw entries with min_score and role filters", async () => {
  const all = await call("GET", `/projects/${P2_THREAT_MODEL_VIS}/reviews`);
  assert.equal(all.status, 200);
  assert.equal(all.body.count, 3);

  const min60 = await call("GET", `/projects/${P2_THREAT_MODEL_VIS}/reviews?min_score=60&sort=total_score&order=desc`);
  assert.deepEqual(min60.body.data.map((r: Json) => r.total_score), [100, 82.2]);

  const peers = await call("GET", `/projects/${P2_THREAT_MODEL_VIS}/reviews?reviewer_role=student_peer`);
  assert.equal(peers.body.count, 2);
  assert.ok(peers.body.data.every((r: Json) => r.reviewer_id === null));
});

test("GET /projects/{id}/reviews/{review_id} reads one review", async () => {
  const res = await call("GET", `/projects/${P2_THREAT_MODEL_VIS}/reviews/${state.facultyReviewId}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.id, state.facultyReviewId);
  assert.equal(res.body.comment, "Solid threat model, presentation ran long.");
  const missing = await call("GET", `/projects/${P2_THREAT_MODEL_VIS}/reviews/${UNKNOWN_ID}`);
  assert.equal(missing.status, 404);
});

test("PUT /projects/{id}/reviews/{review_id} updates scores and recomputes the grade", async () => {
  const extra = await call("POST", `/projects/${P3_PHISHING}/reviews`, {
    reviewer_id: STUDENT_CHLOE,
    scores: scoresFor(6, 6, 12),
  });
  assert.equal(extra.status, 201);
  assert.equal(extra.body.total_score, 60);
  state.extraReviewId = extra.body.id;

  const res = await call("PUT", `/projects/${P3_PHISHING}/reviews/${state.extraReviewId}`, {
    comment: "Updated after the second demo.",
    scores: scoresFor(10, 10, 20),
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.total_score, 100);
  assert.equal(res.body.letter_grade, "A");
  assert.equal(res.body.comment, "Updated after the second demo.");
});

test("DELETE /projects/{id}/reviews/{review_id} removes a review", async () => {
  const res = await call("DELETE", `/projects/${P3_PHISHING}/reviews/${state.extraReviewId}`);
  assert.equal(res.status, 204);
  const gone = await call("GET", `/projects/${P3_PHISHING}/reviews/${state.extraReviewId}`);
  assert.equal(gone.status, 404);
});

// ---- rubric in-use rules --------------------------------------------------

test("PUT and DELETE /rubrics/{rubric_id} are refused while the rubric is in use", async () => {
  const put = await call("PUT", `/rubrics/${state.courseRubric!.id}`, { title: "Changed" });
  assert.equal(put.status, 409);
  const del = await call("DELETE", `/rubrics/${state.courseRubric!.id}`);
  assert.equal(del.status, 409);
  const still = await call("GET", `/rubrics/${state.courseRubric!.id}`);
  assert.equal(still.body.in_use, true);
  assert.equal(still.body.title, COURSE_RUBRIC.title);
});

test("DELETE /rubrics/{rubric_id} removes an unused rubric and its projects fall back to the next rubric", async () => {
  const res = await call("DELETE", `/rubrics/${state.projectRubric!.id}`);
  assert.equal(res.status, 204);
  const gone = await call("GET", `/rubrics/${state.projectRubric!.id}`);
  assert.equal(gone.status, 404);
  const governing = await call("GET", `/rubrics?project_id=${P1_SECURE_GRADE_PORTAL}`);
  assert.deepEqual(governing.body.data.map((r: Json) => r.id), [state.courseRubric!.id]);
});

// ---- /projects/{project_id}/summary ---------------------------------------

test("GET /projects/{id}/summary separates faculty and peer statistics", async () => {
  const res = await call("GET", `/projects/${P2_THREAT_MODEL_VIS}/summary`);
  assert.equal(res.status, 200);
  assert.equal(res.body.rubric.id, state.courseRubric!.id);

  const faculty = res.body.faculty_evaluations;
  assert.equal(faculty.review_count, 1);
  assert.equal(faculty.mean_score, 82.2);
  assert.equal(faculty.std_dev, 0);
  assert.equal(faculty.grade_distribution["B-"], 1);
  assert.equal(faculty.criterion_means.length, 3);
  assert.equal(faculty.grade_point_trend.length, 1);

  const peer = res.body.peer_reviews;
  assert.equal(peer.review_count, 2);
  assert.equal(peer.mean_score, 75);
  assert.equal(peer.std_dev, 25);
  assert.equal(peer.min_score, 50);
  assert.equal(peer.max_score, 100);
  assert.equal(peer.mean_grade_points, 2);
  assert.equal(peer.grade_distribution.A, 1);
  assert.equal(peer.grade_distribution.F, 1);

  assert.equal(res.body.composite_score, 80.04);

  const empty = await call("GET", `/projects/${P4_ROVER}/summary`);
  assert.equal(empty.status, 200);
  assert.equal(empty.body.faculty_evaluations.review_count, 0);
  assert.equal(empty.body.faculty_evaluations.mean_score, null);

  const missing = await call("GET", `/projects/${UNKNOWN_ID}/summary`);
  assert.equal(missing.status, 404);
});

// ---- /reports -------------------------------------------------------------

test("GET /reports?course_id= exports one consolidated CSV report file for the course", async () => {
  const res = await call("GET", "/reports?course_id=CS763");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /text\/csv/);
  assert.match(res.headers.get("content-disposition") ?? "", /attachment; filename="?evaluation-report-CS763\.csv"?/);
  assert.match(res.text, /\[PROJECT SUMMARY\]/);
  assert.match(res.text, /\[CRITERION MATRIX\]/);
  assert.ok(res.text.includes(`${P2_THREAT_MODEL_VIS},Threat Model Visualizer,CS763,lab_cybersec`));
  assert.ok(res.text.includes(P1_SECURE_GRADE_PORTAL));
  assert.ok(!res.text.includes(P4_ROVER));
});

test("GET /reports?lab_id=&format=json returns the lab report as JSON", async () => {
  const res = await call("GET", "/reports?lab_id=lab_cybersec&format=json");
  assert.equal(res.status, 200);
  assert.equal(res.body.project_count, 2);
  const p2 = res.body.projects.find((p: Json) => p.project_id === P2_THREAT_MODEL_VIS);
  assert.equal(p2.grading_status, "faculty_graded");
  assert.equal(p2.faculty_mean, 82.2);
  assert.equal(p2.peer_mean, 75);
  assert.equal(p2.composite_score, 80.04);
  assert.equal(p2.criteria.length, 3);
  const p1 = res.body.projects.find((p: Json) => p.project_id === P1_SECURE_GRADE_PORTAL);
  assert.equal(p1.grading_status, "not_started");
});

test("GET /reports supports min_score, sorting and raw review comments", async () => {
  const res = await call("GET", "/reports?course_id=CS763&min_score=80&sort=composite_score&order=desc&include_comments=true&format=json");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.projects.map((p: Json) => p.project_id), [P2_THREAT_MODEL_VIS]);
  assert.deepEqual(res.body.comments.map((c: Json) => c.total_score).sort(), [100, 82.2]);
  assert.ok(res.body.comments.some((c: Json) => c.reviewer === "Anonymous Peer"));

  const csv = await call("GET", "/reports?course_id=CS763&include_comments=true");
  assert.match(csv.text, /\[REVIEW COMMENTS\]/);
  assert.ok(csv.text.includes('"Solid threat model, presentation ran long."'));
});
