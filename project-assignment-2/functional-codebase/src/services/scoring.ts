// =============================================================================
// Language/Stack: TypeScript 5.9 | Node.js 22 | Express 5 | PostgreSQL 17 (pg)
// Tool: Claude Code agent harness (Claude desktop app), model claude-opus-5-5
// Prompt Summary: "build every Domain 3 requirement and endpoint from
//   ProjectPortalDomainServices.pdf in functional-codebase/" (PA2 happy-path
//   prompt; full verbatim text in /.ai_logs/)
// AI Contribution: 100% AI generated / 0% human refactored
// Human Modifications: none
// Verification:
//   - CI: unit tests (tests/scoring.test.ts) + API integration tests
//   - Human review: PENDING (student must review and sign off)
// Confidence: Medium
// File purpose: pure scoring and statistics functions (no database access).
// =============================================================================

export interface CriterionNode {
  id: string;
  title: string;
  description: string | null;
  weight: number;
  max_points: number | null;
  position: number;
  subcriteria: CriterionNode[];
}

export interface CriterionRow {
  id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  weight: number;
  max_points: number | null;
  position: number;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Turns flat rubric_criteria rows into the nested criteria tree. */
export function buildCriteriaTree(rows: CriterionRow[]): CriterionNode[] {
  const nodes = new Map<string, CriterionNode>();
  for (const r of rows) {
    nodes.set(r.id, {
      id: r.id,
      title: r.title,
      description: r.description,
      weight: Number(r.weight),
      max_points: r.max_points === null ? null : Number(r.max_points),
      position: r.position,
      subcriteria: [],
    });
  }
  const roots: CriterionNode[] = [];
  for (const r of rows) {
    const node = nodes.get(r.id)!;
    if (r.parent_id && nodes.has(r.parent_id)) {
      nodes.get(r.parent_id)!.subcriteria.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortTree = (list: CriterionNode[]): void => {
    list.sort((a, b) => a.position - b.position);
    list.forEach((n) => sortTree(n.subcriteria));
  };
  sortTree(roots);
  return roots;
}

/** Leaf criteria are the ones reviewers score directly. */
export function leafCriteria(tree: CriterionNode[]): CriterionNode[] {
  const out: CriterionNode[] = [];
  const walk = (list: CriterionNode[]): void => {
    for (const n of list) {
      if (n.subcriteria.length === 0) out.push(n);
      else walk(n.subcriteria);
    }
  };
  walk(tree);
  return out;
}

function nodeFraction(node: CriterionNode, scores: Map<string, number>): number {
  if (node.subcriteria.length > 0) {
    return weightedFraction(node.subcriteria, scores);
  }
  if (!node.max_points) return 0;
  return (scores.get(node.id) ?? 0) / node.max_points;
}

function weightedFraction(list: CriterionNode[], scores: Map<string, number>): number {
  const totalWeight = list.reduce((sum, n) => sum + n.weight, 0);
  if (totalWeight === 0) return 0;
  return list.reduce((sum, n) => sum + n.weight * nodeFraction(n, scores), 0) / totalWeight;
}

/**
 * Weighted percentage score (0-100) of one review.
 * Leaf: score / max_points. Parent: weight-averaged children. Root: weight-averaged top level.
 */
export function computeTotalScore(tree: CriterionNode[], scores: Map<string, number>): number {
  return round2(weightedFraction(tree, scores) * 100);
}

const GRADE_SCALE: Array<{ min: number; letter: string; points: number }> = [
  { min: 93, letter: "A", points: 4.0 },
  { min: 90, letter: "A-", points: 3.7 },
  { min: 87, letter: "B+", points: 3.3 },
  { min: 83, letter: "B", points: 3.0 },
  { min: 80, letter: "B-", points: 2.7 },
  { min: 77, letter: "C+", points: 2.3 },
  { min: 73, letter: "C", points: 2.0 },
  { min: 70, letter: "C-", points: 1.7 },
  { min: 60, letter: "D", points: 1.0 },
  { min: -Infinity, letter: "F", points: 0.0 },
];

export function toGrade(score: number): { letter: string; points: number } {
  const g = GRADE_SCALE.find((s) => score >= s.min)!;
  return { letter: g.letter, points: g.points };
}

export const LETTERS = GRADE_SCALE.map((g) => g.letter);

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return round2(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Population standard deviation. */
export function stdDev(values: number[]): number | null {
  if (values.length === 0) return null;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return round2(Math.sqrt(variance));
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return round2(s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]);
}

/** Composite grade used in reports: 70% faculty, 30% peer when both exist. */
export const FACULTY_WEIGHT = 0.7;

export function compositeScore(facultyMean: number | null, peerMean: number | null): number | null {
  if (facultyMean !== null && peerMean !== null) {
    return round2(facultyMean * FACULTY_WEIGHT + peerMean * (1 - FACULTY_WEIGHT));
  }
  return facultyMean ?? peerMean;
}
