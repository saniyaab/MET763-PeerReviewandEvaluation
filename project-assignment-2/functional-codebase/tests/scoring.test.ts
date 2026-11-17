// =============================================================================
// Language/Stack: TypeScript 5.9 | Node.js 22 built-in test runner (node:test)
// Tool: Claude Code agent harness (Claude desktop app), model claude-opus-5-5
// Prompt Summary: "Write API integration tests for every endpoint and run them
//   in the pipeline" (PA2 happy-path prompt; full verbatim text in /.ai_logs/)
// AI Contribution: 100% AI generated / 0% human refactored
// Human Modifications: none
// Verification:
//   - CI: run by `npm run test:unit` in .github/workflows/devsecops.yml
//   - Human review: signed off by the student (Saniya Bhambhvani), 2026-11-17
// Confidence: High
// File purpose: unit tests for the pure scoring and statistics functions.
// =============================================================================

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCriteriaTree,
  compositeScore,
  computeTotalScore,
  leafCriteria,
  mean,
  median,
  stdDev,
  toGrade,
  type CriterionRow,
} from "../src/services/scoring";

const ROWS: CriterionRow[] = [
  { id: "tech", parent_id: null, title: "Technical Implementation", description: null, weight: 60, max_points: null, position: 0 },
  { id: "func", parent_id: "tech", title: "Functionality", description: null, weight: 70, max_points: 10, position: 0 },
  { id: "qual", parent_id: "tech", title: "Code Quality", description: null, weight: 30, max_points: 10, position: 1 },
  { id: "pres", parent_id: null, title: "Presentation", description: null, weight: 40, max_points: 20, position: 1 },
];

test("buildCriteriaTree nests sub-criteria under their parent in position order", () => {
  const tree = buildCriteriaTree(ROWS);
  assert.equal(tree.length, 2);
  assert.equal(tree[0].title, "Technical Implementation");
  assert.deepEqual(tree[0].subcriteria.map((c) => c.id), ["func", "qual"]);
  assert.deepEqual(leafCriteria(tree).map((c) => c.id), ["func", "qual", "pres"]);
});

test("computeTotalScore applies hierarchical weights", () => {
  const tree = buildCriteriaTree(ROWS);
  const scores = new Map([["func", 9], ["qual", 8], ["pres", 15]]);
  assert.equal(computeTotalScore(tree, scores), 82.2);
  assert.equal(computeTotalScore(tree, new Map([["func", 10], ["qual", 10], ["pres", 20]])), 100);
  assert.equal(computeTotalScore(tree, new Map([["func", 5], ["qual", 5], ["pres", 10]])), 50);
});

test("missing scores count as zero", () => {
  const tree = buildCriteriaTree(ROWS);
  assert.equal(computeTotalScore(tree, new Map([["pres", 20]])), 40);
});

test("toGrade maps scores to letter grades and grade points", () => {
  assert.deepEqual(toGrade(100), { letter: "A", points: 4 });
  assert.deepEqual(toGrade(82.2), { letter: "B-", points: 2.7 });
  assert.deepEqual(toGrade(50), { letter: "F", points: 0 });
});

test("statistics helpers", () => {
  assert.equal(mean([100, 50]), 75);
  assert.equal(stdDev([100, 50]), 25);
  assert.equal(median([1, 3, 2]), 2);
  assert.equal(mean([]), null);
  assert.equal(compositeScore(82.2, 75), 80.04);
  assert.equal(compositeScore(null, 75), 75);
});
