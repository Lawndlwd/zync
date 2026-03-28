ARG MODE=production

# ── Shared base: install deps + native modules ──
FROM node:20-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv make g++ procps git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/ packages/shared/
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile --filter @zync/server...
RUN cd packages/server && npx playwright install chromium --with-deps
RUN mkdir -p /home/node/.cache && cp -r /root/.cache/ms-playwright /home/node/.cache/ms-playwright && chown -R node:node /home/node/.cache
COPY packages/server/ packages/server/

RUN mkdir -p /app/packages/server/data /app/documents && chown -R node:node /app/packages/server/data /app/documents
ENV DOCUMENTS_PATH=/app/documents

# ── Production: compile TS then slim runtime image ──
FROM base AS build-production
RUN pnpm --filter @zync/server build

FROM node:20-bookworm-slim AS production
RUN apt-get update && apt-get install -y --no-install-recommends procps python3 git && rm -rf /var/lib/apt/lists/*
WORKDIR /app/packages/server
RUN corepack enable pnpm
COPY --from=build-production /app/packages/server/dist ./dist
COPY --from=build-production /app/packages/server/node_modules ./node_modules
COPY --from=build-production /app/packages/server/package.json ./
COPY --from=base /home/node/.cache/ms-playwright /home/node/.cache/ms-playwright
RUN chown -R node:node /home/node/.cache
RUN npx playwright install-deps chromium 2>/dev/null || true
RUN mkdir -p /app/packages/server/data /app/documents && chown -R node:node /app/packages/server/data /app/documents
ENV DOCUMENTS_PATH=/app/documents
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]

# ── Development: tsx watch, source mounted as volume ──
FROM base AS development
USER node
WORKDIR /app/packages/server
EXPOSE 3001
CMD ["pnpm", "dev"]

# ── Pick final stage based on MODE ──
FROM ${MODE} AS final
