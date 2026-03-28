ARG MODE=production

# ── Shared base: install deps ──
FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/ packages/shared/
COPY packages/app/package.json packages/app/
RUN pnpm install --frozen-lockfile --filter @zync/app...
COPY packages/app/ packages/app/

# ── Production: build + serve with nginx ──
FROM base AS build-production
RUN pnpm --filter @zync/app build

FROM nginx:alpine AS production
COPY --from=build-production /app/packages/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN echo 'gzip on; gzip_vary on; gzip_min_length 1024; gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;' \
    > /etc/nginx/conf.d/gzip.conf
EXPOSE 80

# ── Development: vite dev server with HMR ──
FROM base AS development
EXPOSE 5173
WORKDIR /app/packages/app
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

# ── Pick final stage based on MODE ──
FROM ${MODE} AS final
