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
// File purpose: reads runtime configuration from environment variables.
// =============================================================================

export interface AppConfig {
  port: number;
  databaseUrl: string | undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number.parseInt(env.PORT ?? "3000", 10);
  return {
    port: Number.isNaN(port) ? 3000 : port,
    databaseUrl: env.DATABASE_URL,
  };
}
