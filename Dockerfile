ARG MODE=production

# ── Base: install all dependencies ──
FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv make g++ procps git \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable pnpm

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/app/package.json packages/app/
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ packages/shared/
COPY packages/app/ packages/app/
COPY packages/server/ packages/server/

# Install Playwright chromium
RUN cd packages/server && npx playwright install chromium --with-deps
RUN mkdir -p /home/node/.cache && cp -r /root/.cache/ms-playwright /home/node/.cache/ms-playwright && chown -R node:node /home/node/.cache

RUN mkdir -p /app/packages/server/data /app/documents && chown -R node:node /app/packages/server/data /app/documents
ENV DOCUMENTS_PATH=/app/documents

# ── Build: compile everything ──
FROM base AS build-production
RUN pnpm --filter @zync/shared build
RUN pnpm --filter @zync/app build
RUN pnpm --filter @zync/server build
# Create self-contained deployment with resolved dependencies (no symlinks)
RUN pnpm --filter @zync/server deploy --legacy /app/server-deploy

# ── Production: slim runtime ──
FROM node:24-bookworm-slim AS production
RUN apt-get update && apt-get install -y --no-install-recommends procps python3 git && rm -rf /var/lib/apt/lists/*
WORKDIR /app/packages/server
RUN corepack enable pnpm

# Compiled server (deploy bundle has real node_modules, not pnpm symlinks)
COPY --from=build-production /app/server-deploy/node_modules ./node_modules
COPY --from=build-production /app/server-deploy/package.json ./
COPY --from=build-production /app/packages/server/dist ./dist

# Built frontend (served by Express in production)
COPY --from=build-production /app/packages/app/dist /app/packages/app/dist

# Playwright browser
COPY --from=base /home/node/.cache/ms-playwright /home/node/.cache/ms-playwright
RUN chown -R node:node /home/node/.cache
RUN npx playwright install-deps chromium 2>/dev/null || true

RUN mkdir -p /app/packages/server/data /app/documents && chown -R node:node /app/packages/server/data /app/documents
ENV DOCUMENTS_PATH=/app/documents
ENV NODE_ENV=production

USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]

# ── Development: use packages/server/Dockerfile + packages/app/Dockerfile instead ──
FROM base AS development
USER node
WORKDIR /app/packages/server
EXPOSE 3001
CMD ["pnpm", "dev"]

# ── Pick final stage ──
FROM ${MODE} AS final
