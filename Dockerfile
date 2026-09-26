# One image for every service: api (+ web UI), scheduler, opencode.
# The compose file picks the role via the command argument.

FROM node:24-bookworm-slim AS base
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/jobs/package.json packages/jobs/
COPY packages/api/package.json packages/api/
COPY packages/web/package.json packages/web/

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY packages packages
RUN pnpm build

FROM base AS deps
RUN pnpm install --prod --frozen-lockfile --filter "@zync/api..."

FROM node:24-bookworm-slim AS runtime
ARG OPENCODE_VERSION=1.18.30
RUN apt-get update \
  && apt-get install -y --no-install-recommends git curl ca-certificates ripgrep python3 tini gosu \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g "opencode-ai@${OPENCODE_VERSION}" && npm cache clean --force \
  # `opencode web` tries to open a browser; there is none in a container.
  && ln -s /bin/true /usr/local/bin/xdg-open

WORKDIR /app
COPY --from=deps /app ./
COPY --from=build /app/packages/jobs/dist packages/jobs/dist
COPY --from=build /app/packages/api/dist packages/api/dist
COPY --from=build /app/packages/web/dist packages/web/dist
COPY opencode opencode
COPY docker/entrypoint.sh /entrypoint.sh

ENV NODE_ENV=production \
    WORKSPACES_ROOT=/workspace \
    PORT=3001
RUN chmod +x /entrypoint.sh \
  && mkdir -p /workspace /home/node/.config/opencode /home/node/.local/share/opencode /home/node/.local/state /home/node/.cache \
  && chown -R node:node /workspace /home/node
# No USER here: the entrypoint starts as root only to hand the mounted folders to `node`, then
# re-runs itself as `node` (see docker/entrypoint.sh). Nothing else ever runs as root.

ENTRYPOINT ["tini", "--", "/entrypoint.sh"]
CMD ["api"]
