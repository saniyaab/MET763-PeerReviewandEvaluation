# Language/Stack: Docker multi-stage build for Node.js 22 + TypeScript (Express 5, pg)
# Tool: Claude Code agent harness (Claude desktop app), model claude-opus-5-5
# Prompt Summary: PA1 "multi-stage Dockerfile" prompt; repointed by the PA2 prompt
#   "Point the Dockerfile, compose file, Sonar config and devsecops.yml at
#   functional-codebase/" (full verbatim prompts in /.ai_logs/)
# AI Contribution: 100% AI generated / 0% human refactored
# Human Modifications: none
# Verification: CI docker build + compose smoke/integration tests; human review PENDING
# Confidence: High
# Builds project-assignment-2/functional-codebase (PA2 Domain 3 service).
# Build context is the repository root.

ARG APP_DIR=project-assignment-2/functional-codebase

# ---- Stage 1: build (full deps + TypeScript compile) ----
FROM node:22-alpine AS build
ARG APP_DIR
WORKDIR /app
COPY ${APP_DIR}/package.json ${APP_DIR}/package-lock.json ./
RUN npm ci --ignore-scripts
COPY ${APP_DIR}/tsconfig.json ./
COPY ${APP_DIR}/src ./src
RUN npm run build

# ---- Stage 2: production dependencies only ----
FROM node:22-alpine AS prod-deps
ARG APP_DIR
WORKDIR /app
COPY ${APP_DIR}/package.json ${APP_DIR}/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ---- Stage 3: minimal runtime ----
FROM node:22-alpine AS runtime
ARG APP_DIR
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node ${APP_DIR}/package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
