// AI Contribution Weight: [100%] AI Generated / [0%] Human Refactored
// Author: Claude Code agent (claude-opus-5-5) - see code_AI_history.md
// Reads runtime configuration from environment variables (set by docker-compose).

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
