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
// File purpose: HTTP error type thrown by services and turned into responses.
// =============================================================================

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFound = (what: string): HttpError => new HttpError(404, `${what} not found`);
export const conflict = (message: string): HttpError => new HttpError(409, message);
