# ─── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Enable corepack so pnpm is available at the exact version we need
RUN corepack enable

# Copy manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/mcp/package.json          ./packages/mcp/package.json
COPY packages/scanner/package.json      ./packages/scanner/package.json
COPY packages/watcher/package.json      ./packages/watcher/package.json
COPY packages/generator/package.json    ./packages/generator/package.json
COPY packages/bootstrapper/package.json ./packages/bootstrapper/package.json
COPY packages/cli/package.json          ./packages/cli/package.json

# CI=true suppresses interactive prompts in some post-install hooks
RUN CI=true pnpm install --frozen-lockfile

# Copy source and build all packages
COPY . .
RUN pnpm build

# Create a self-contained production deployment for the MCP server package.
# pnpm deploy copies dist + flattened prod node_modules (including workspace deps).
RUN pnpm --filter @contextforge/mcp deploy --prod /deploy

# ─── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy only the deployed package (dist + prod node_modules)
COPY --from=builder /deploy .

# The MCP server communicates over stdio — no network port required.
# Callers pipe JSON-RPC messages in via stdin and read responses from stdout.
# Set PROJECT_ROOT to wherever the host mounts the project under /project.
ENV PROJECT_ROOT=/project

CMD ["node", "dist/bin.js"]
