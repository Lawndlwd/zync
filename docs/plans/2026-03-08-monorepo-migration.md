# Monorepo Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate ai-dashboard from a flat root+server layout to a pnpm monorepo with Turborepo, splitting into packages: app, server, shared, whisper, wakeword, pr-agent.

**Architecture:** pnpm workspaces with Turborepo for build orchestration. Three TypeScript packages (`@zync/app`, `@zync/server`, `@zync/shared`) plus three Python services (`whisper`, `wakeword`, `pr-agent`). Shared package builds first, then app and server in parallel.

**Tech Stack:** pnpm workspaces, Turborepo, Vite, TypeScript, Express 5, Docker

---

### Task 1: Create monorepo root scaffolding

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Modify: `package.json` (strip to workspace root)
- Modify: `.gitignore` (update paths for new layout)

**Step 1: Create pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
```

**Step 2: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

**Step 3: Rewrite root package.json**

Keep only workspace orchestration. All app/server deps will move to their packages.

```json
{
  "name": "zync",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "turbo dev",
    "dev:all": "turbo dev --filter=@zync/app --filter=@zync/server",
    "build": "turbo build",
    "typecheck": "turbo typecheck"
  },
  "devDependencies": {
    "turbo": "^2.5.0",
    "concurrently": "^9.1.0"
  }
}
```

**Step 4: Update .gitignore for monorepo paths**

Replace `server/data/`, `server/.env`, `server/.venv/`, `server/wakeword/.venv/`, `server/data/secrets.db*` with:

```gitignore
# Data files
data/

# Package-specific data
packages/server/data/

# Environment files
.env
packages/server/.env

# Python venvs
packages/pr-agent/.venv/
packages/wakeword/.venv/

# Secrets vault
packages/server/data/secrets.db
packages/server/data/secrets.db-shm
packages/server/data/secrets.db-wal

# Turbo
.turbo/
```

**Step 5: Commit**

```bash
git add pnpm-workspace.yaml turbo.json package.json .gitignore
git commit -m "chore: scaffold monorepo root with pnpm workspaces + turborepo"
```

---

### Task 2: Create @zync/shared package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Move: `src/types/*.ts` -> `packages/shared/src/types/`
- Create: `packages/shared/src/types/index.ts` (barrel)
- Move: `server/src/lib/schemas.ts` -> `packages/shared/src/schemas.ts`
- Move: `server/src/lib/validate.ts` -> `packages/shared/src/validate.ts`

**Step 1: Create packages/shared/package.json**

```json
{
  "name": "@zync/shared",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types/index.ts",
    "./schemas": "./src/schemas.ts",
    "./validate": "./src/validate.ts"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "~5.6.3"
  }
}
```

Note: We use raw `.ts` exports since both consumers (Vite for app, tsx for server) can handle TypeScript directly. No build step needed for shared in dev. For production builds, `tsc` compiles to dist/.

**Step 2: Create packages/shared/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src"]
}
```

**Step 3: Move frontend type files to shared**

```bash
mkdir -p packages/shared/src/types
mv src/types/ai.ts packages/shared/src/types/
mv src/types/bot.ts packages/shared/src/types/
mv src/types/document.ts packages/shared/src/types/
mv src/types/gitlab.ts packages/shared/src/types/
mv src/types/habit.ts packages/shared/src/types/
mv src/types/jira.ts packages/shared/src/types/
mv src/types/jobs.ts packages/shared/src/types/
mv src/types/journal.ts packages/shared/src/types/
mv src/types/message.ts packages/shared/src/types/
mv src/types/opencode.ts packages/shared/src/types/
mv src/types/project.ts packages/shared/src/types/
mv src/types/settings.ts packages/shared/src/types/
mv src/types/social.ts packages/shared/src/types/
mv src/types/todo.ts packages/shared/src/types/
rmdir src/types
```

**Step 4: Create barrel export for types**

Create `packages/shared/src/types/index.ts`:

```typescript
export * from './ai.js'
export * from './bot.js'
export * from './document.js'
export * from './gitlab.js'
export * from './habit.js'
export * from './jira.js'
export * from './jobs.js'
export * from './journal.js'
export * from './message.js'
export * from './opencode.js'
export * from './project.js'
export * from './settings.js'
export * from './social.js'
export * from './todo.js'
```

**Step 5: Move schemas and validate to shared**

```bash
mv server/src/lib/schemas.ts packages/shared/src/schemas.ts
mv server/src/lib/validate.ts packages/shared/src/validate.ts
```

The validate.ts imports Express types — check if it needs `@types/express` added to shared, or if we should keep a thin wrapper in server that re-exports from shared. If validate uses Express `Request`/`Response`/`NextFunction`, keep it in server and only move schemas to shared.

Read `server/src/lib/validate.ts` first. If it depends on Express types, leave it in server and only move `schemas.ts`.

**Step 6: Create packages/shared/src/index.ts**

```typescript
export * from './types/index.js'
export * from './schemas.js'
```

**Step 7: Verify shared package compiles**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: No errors

**Step 8: Commit**

```bash
git add packages/shared/ -A
git add src/types/ server/src/lib/schemas.ts  # track the deletions/moves
git commit -m "feat: create @zync/shared package with types and schemas"
```

---

### Task 3: Move frontend to packages/app

**Files:**
- Create: `packages/app/package.json`
- Move: `src/` -> `packages/app/src/`
- Move: `public/` -> `packages/app/public/`
- Move: `index.html` -> `packages/app/index.html`
- Move: `vite.config.ts` -> `packages/app/vite.config.ts`
- Move: `components.json` -> `packages/app/components.json`
- Create: `packages/app/tsconfig.json`

**Step 1: Create packages/app directory and move files**

```bash
mkdir -p packages/app
mv src/ packages/app/src/
mv public/ packages/app/public/
mv index.html packages/app/index.html
mv vite.config.ts packages/app/vite.config.ts
mv components.json packages/app/components.json
```

**Step 2: Create packages/app/package.json**

Take all frontend deps from root `package.json` (which was already rewritten in Task 1):

```json
{
  "name": "@zync/app",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@zync/shared": "workspace:*",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@milkdown/crepe": "^7.18.0",
    "@milkdown/kit": "^7.18.0",
    "@modelcontextprotocol/sdk": "^1.27.1",
    "@opencode-ai/sdk": "^1.2.15",
    "@tanstack/react-query": "^5.62.0",
    "@types/qrcode": "^1.5.6",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cronstrue": "^3.13.0",
    "date-fns": "^4.1.0",
    "kokoro-js": "^1.2.1",
    "lucide-react": "^0.460.0",
    "node-cron": "^4.2.1",
    "qrcode": "^1.5.4",
    "radix-ui": "^1.4.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hot-toast": "^2.4.1",
    "react-resizable-panels": "^4",
    "react-router-dom": "^6.28.0",
    "recharts": "2.15.4",
    "shiki": "^4.0.0",
    "tailwind-merge": "^2.6.0",
    "zod": "^3.24.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/node-cron": "^3.0.11",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-basic-ssl": "^2.1.4",
    "@vitejs/plugin-react": "^4.3.4",
    "shadcn": "^3.8.5",
    "tailwindcss": "^4.0.0",
    "tw-animate-css": "^1.4.0",
    "typescript": "~5.6.3",
    "vite": "^6.0.0",
    "vitest": "^4.0.18"
  }
}
```

**Step 3: Create packages/app/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

**Step 4: Update all frontend imports from `@/types/` to `@zync/shared`**

There are 85 occurrences across 84 files. Use find-and-replace:

Pattern: `from '@/types/settings'` -> `from '@zync/shared/types'`
Pattern: `from '@/types/bot'` -> `from '@zync/shared/types'`
Pattern: `from '@/types/social'` -> `from '@zync/shared/types'`
... etc for all 14 type modules.

Since all types are re-exported from `@zync/shared/types`, every `from '@/types/<module>'` becomes `from '@zync/shared/types'`. Adjust named imports as needed (some files may import from multiple type modules — consolidate into one import line).

**Step 5: Update components.json paths**

The `components.json` shadcn config references `src/index.css` and `@/` paths. These should still work since they're relative to the package root. Verify:
- `tailwind.css` should be `src/index.css` (relative to packages/app/)
- All `@/` aliases in `aliases` section remain correct

**Step 6: Verify app builds**

Run: `cd packages/app && pnpm install && pnpm typecheck`
Expected: No type errors

Run: `cd packages/app && pnpm build`
Expected: Successful Vite build

**Step 7: Commit**

```bash
git add packages/app/ -A
git add src/ public/ index.html vite.config.ts components.json  # deletions
git commit -m "feat: move frontend to packages/app"
```

---

### Task 4: Move backend to packages/server

**Files:**
- Move: `server/src/` -> `packages/server/src/`
- Move: `server/package.json` -> `packages/server/package.json`
- Move: `server/tsconfig.json` -> `packages/server/tsconfig.json`
- Move: `server/data/` -> `packages/server/data/`
- Move: `server/scripts/` -> `packages/server/scripts/` (temporarily, will move pr-agent parts later)
- Modify: `packages/server/package.json` (add @zync/shared dep, rename)

**Step 1: Move server directory contents**

```bash
mkdir -p packages/server
mv server/src packages/server/src
mv server/package.json packages/server/package.json
mv server/tsconfig.json packages/server/tsconfig.json
mv server/pnpm-lock.yaml packages/server/pnpm-lock.yaml
mv server/data packages/server/data 2>/dev/null || true
mv server/scripts packages/server/scripts
```

**Step 2: Update packages/server/package.json**

- Rename to `@zync/server`
- Add `@zync/shared` workspace dependency
- Keep all existing deps

```json
{
  "name": "@zync/server",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "bin": {
    "zync-mcp": "./src/mcp-server/index.ts"
  },
  "scripts": {
    "dev": "tsx watch --ignore './data/**' src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "secrets:migrate": "tsx src/secrets/migrate.ts"
  },
  "dependencies": {
    "@zync/shared": "workspace:*",
    "@huggingface/transformers": "^3.0.0",
    "@modelcontextprotocol/sdk": "^1.27.1",
    "baileys": "7.0.0-rc.9",
    "better-sqlite3": "^12.6.2",
    "cors": "^2.8.6",
    "crawlee": "^3.16.0",
    "dotenv": "^17.3.1",
    "eventsource": "^4.1.0",
    "express": "^5.2.1",
    "googleapis": "^171.4.0",
    "grammy": "^1.41.0",
    "gray-matter": "^4.0.3",
    "heic-convert": "^2.1.0",
    "multer": "^2.1.0",
    "node-cron": "^4.2.1",
    "pdf-parse": "^2.4.5",
    "pino": "^9.0.0",
    "pino-pretty": "^13.0.0",
    "playwright": "^1.58.2",
    "qrcode": "^1.5.4",
    "sharp": "^0.34.5",
    "ws": "^8.19.0",
    "zod": "^3.24.0"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["better-sqlite3"],
    "ignoredBuiltDependencies": ["baileys", "protobufjs"]
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.6",
    "@types/multer": "^2.0.0",
    "@types/node-cron": "^3.0.11",
    "@types/pdf-parse": "^1.1.5",
    "@types/qrcode": "^1.5.6",
    "@types/ws": "^8.18.1",
    "tsx": "^4.21.0",
    "typescript": "~5.9.3"
  }
}
```

**Step 3: Update server imports for schemas and validate**

The schemas were moved to `@zync/shared/schemas` in Task 2. Update all 21 server route files:

Pattern: `from '../lib/schemas.js'` -> `from '@zync/shared/schemas'`
Pattern: `from '../lib/validate.js'` -> keep in server if validate depends on Express (see Task 2 Step 5 note)
Pattern: `from '../../lib/schemas.js'` -> `from '@zync/shared/schemas'`

Keep `server/src/lib/errors.ts` and `server/src/lib/logger.ts` in place (server-specific).

**Step 4: Verify server compiles**

Run: `cd packages/server && pnpm install && pnpm typecheck`
Expected: No type errors

**Step 5: Remove old server/ directory**

```bash
rm -rf server/  # should be empty after moves
```

**Step 6: Commit**

```bash
git add packages/server/ -A
git add server/  # track deletion
git commit -m "feat: move backend to packages/server"
```

---

### Task 5: Move Python services to packages

**Files:**
- Move: `server/whisper/` -> `packages/whisper/` (already at server/whisper before Task 4 moved server/)
- Move: `server/wakeword/` -> `packages/wakeword/`
- Move: `server/scripts/run_pr_agent.py` -> `packages/pr-agent/run_pr_agent.py`
- Create: `packages/pr-agent/Dockerfile`
- Create: `packages/pr-agent/requirements.txt`

Note: The `server/whisper/` and `server/wakeword/` directories were NOT moved in Task 4 since they're separate from `server/src`. If they were moved with `server/`, adjust paths accordingly.

**Step 1: Move whisper service**

```bash
mkdir -p packages/whisper
mv server/whisper/server.py packages/whisper/server.py
mv server/whisper/Dockerfile packages/whisper/Dockerfile
mv server/whisper/requirements.txt packages/whisper/requirements.txt
```

**Step 2: Move wakeword service**

```bash
mkdir -p packages/wakeword
mv server/wakeword/server.py packages/wakeword/server.py
mv server/wakeword/Dockerfile packages/wakeword/Dockerfile
mv server/wakeword/requirements.txt packages/wakeword/requirements.txt
```

**Step 3: Create pr-agent package**

```bash
mkdir -p packages/pr-agent
mv packages/server/scripts/run_pr_agent.py packages/pr-agent/run_pr_agent.py
rmdir packages/server/scripts 2>/dev/null || true
```

**Step 4: Create packages/pr-agent/requirements.txt**

```
pr-agent
aiohttp
```

**Step 5: Create packages/pr-agent/Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY run_pr_agent.py .

EXPOSE 8090

CMD ["python", "run_pr_agent.py"]
```

Note: The pr-agent currently runs as a child process spawned by the server. Converting it to an HTTP service is a separate task — for now just move the files. The server's `routes/pr-agent.ts` continues to spawn it via the Python path, which needs to be updated to point to `../../pr-agent/run_pr_agent.py` or use an env var.

**Step 6: Update server's pr-agent route to use new path**

In `packages/server/src/routes/pr-agent.ts`, update:

```typescript
// Old:
const VENV_PYTHON = resolve(import.meta.dirname, '../../.venv/bin/python')
const WRAPPER_SCRIPT = resolve(import.meta.dirname, '../../scripts/run_pr_agent.py')

// New:
const VENV_PYTHON = resolve(import.meta.dirname, '../../../pr-agent/.venv/bin/python')
const WRAPPER_SCRIPT = resolve(import.meta.dirname, '../../../pr-agent/run_pr_agent.py')
```

**Step 7: Commit**

```bash
git add packages/whisper/ packages/wakeword/ packages/pr-agent/ -A
git add server/whisper/ server/wakeword/ packages/server/scripts/  # deletions
git commit -m "feat: move python services to packages/whisper, packages/wakeword, packages/pr-agent"
```

---

### Task 6: Update Docker configuration

**Files:**
- Modify: `Dockerfile.frontend` -> `packages/app/Dockerfile`
- Modify: `Dockerfile.backend` -> `packages/server/Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod.yml`

**Step 1: Create packages/app/Dockerfile**

```dockerfile
ARG MODE=production

# ── Shared base: install deps ──
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable pnpm

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy shared package
COPY packages/shared/ packages/shared/

# Copy app package
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
```

Note: The build context must be the repo root (not packages/app/) because we need access to shared package and workspace config. The `nginx.conf` COPY needs the file accessible from the build context.

**Step 2: Create packages/server/Dockerfile**

```dockerfile
ARG MODE=production

# ── Shared base: install deps + native modules ──
FROM node:20-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ procps && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable pnpm

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy shared package
COPY packages/shared/ packages/shared/

# Copy server package
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
RUN apt-get update && apt-get install -y --no-install-recommends procps && rm -rf /var/lib/apt/lists/*
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
```

**Step 3: Update docker-compose.yml**

```yaml
services:
  frontend:
    build:
      context: .
      dockerfile: packages/app/Dockerfile
      args:
        MODE: development
    ports:
      - "${ZYNC_PORT:-8080}:5173"
    volumes:
      - ./packages/app/src:/app/packages/app/src
      - ./packages/app/public:/app/packages/app/public
      - ./packages/app/index.html:/app/packages/app/index.html
      - ./packages/app/vite.config.ts:/app/packages/app/vite.config.ts
      - ./packages/shared/src:/app/packages/shared/src
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      - VITE_BACKEND_URL=http://backend:3001
      - VITE_WAKEWORD_URL=ws://wakeword:9000
      - VITE_OPENCODE_URL=http://host.docker.internal:4096
    depends_on:
      - backend
    restart: unless-stopped

  backend:
    build:
      context: .
      dockerfile: packages/server/Dockerfile
      args:
        MODE: development
    ports:
      - "3001:3001"
    env_file:
      - path: .env
        required: false
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      - NODE_ENV=development
      - OPENCODE_URL=http://host.docker.internal:4096
      - WHISPER_SERVICE_URL=http://whisper:9100
    volumes:
      - ./packages/server/src:/app/packages/server/src
      - ./packages/server/data:/app/packages/server/data
      - ./data/documents:/app/documents
      - ./packages/shared/src:/app/packages/shared/src
    depends_on:
      whisper:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3001/api/health').then(r=>{if(!r.ok)process.exit(1)})"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 30s
    restart: unless-stopped

  whisper:
    build:
      context: ./packages/whisper
      dockerfile: Dockerfile
    expose:
      - "9100"
    environment:
      - WHISPER_PORT=9100
      - WHISPER_MODEL=${WHISPER_MODEL:-base.en}
      - WHISPER_COMPUTE_TYPE=${WHISPER_COMPUTE_TYPE:-int8}
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:9100/health')"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 60s
    restart: unless-stopped

  wakeword:
    build:
      context: ./packages/wakeword
      dockerfile: Dockerfile
    environment:
      - WAKEWORD_PORT=9000
      - WAKEWORD_MODEL=${WAKEWORD_MODEL:-hey_jarvis}
      - WAKEWORD_THRESHOLD=${WAKEWORD_THRESHOLD:-0.5}
    restart: unless-stopped
```

**Step 4: Update docker-compose.prod.yml**

Update image names and volume paths. Images stay the same (ghcr.io/lawndlwd/zync-*). Volume mounts update:

```yaml
volumes:
  - zync-data:/app/packages/server/data
  - zync-documents:/app/documents
```

**Step 5: Remove old Dockerfiles from root**

```bash
rm Dockerfile.frontend Dockerfile.backend
```

**Step 6: Commit**

```bash
git add packages/app/Dockerfile packages/server/Dockerfile docker-compose.yml docker-compose.prod.yml
git add Dockerfile.frontend Dockerfile.backend  # deletions
git commit -m "feat: update docker config for monorepo layout"
```

---

### Task 7: Install dependencies and verify

**Step 1: Delete old lockfiles and node_modules**

```bash
rm -rf node_modules/
rm -f pnpm-lock.yaml
rm -f packages/server/pnpm-lock.yaml
```

**Step 2: Install all workspace dependencies**

```bash
pnpm install
```

This generates a single root `pnpm-lock.yaml` managing all workspace packages.

**Step 3: Verify typecheck for shared**

```bash
pnpm --filter @zync/shared typecheck
```

Expected: Pass

**Step 4: Verify typecheck for app**

```bash
pnpm --filter @zync/app typecheck
```

Expected: Pass. If there are import errors, fix the `@/types/` -> `@zync/shared/types` replacements.

**Step 5: Verify typecheck for server**

```bash
pnpm --filter @zync/server typecheck
```

Expected: Pass. If there are schema import errors, fix the `../lib/schemas` -> `@zync/shared/schemas` replacements.

**Step 6: Verify dev servers start**

```bash
pnpm dev --filter @zync/app  # should start Vite on :5173
# In another terminal:
pnpm dev --filter @zync/server  # should start Express on :3001
```

**Step 7: Verify turbo orchestration**

```bash
pnpm dev  # should run turbo dev, starting both app and server
```

**Step 8: Commit lockfile**

```bash
git add pnpm-lock.yaml
git commit -m "chore: regenerate lockfile for monorepo workspace"
```

---

### Task 8: Clean up root directory

**Step 1: Remove old root tsconfig.json**

The root no longer needs a tsconfig since each package has its own. Or keep a minimal one for IDE support:

```json
{
  "references": [
    { "path": "packages/shared" },
    { "path": "packages/app" },
    { "path": "packages/server" }
  ],
  "files": []
}
```

**Step 2: Verify final directory structure**

```bash
ls -la packages/
# Expected: app/  server/  shared/  whisper/  wakeword/  pr-agent/
```

```
ai-dashboard/
├── package.json           (workspace root)
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── turbo.json
├── tsconfig.json          (project references)
├── nginx.conf
├── docker-compose.yml
├── docker-compose.prod.yml
├── .gitignore
├── data/                  (runtime data, gitignored)
└── packages/
    ├── app/               (@zync/app - React frontend)
    ├── server/            (@zync/server - Express backend)
    ├── shared/            (@zync/shared - types & schemas)
    ├── whisper/           (Python transcription service)
    ├── wakeword/          (Python wake word service)
    └── pr-agent/          (Python PR review service)
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: finalize monorepo migration cleanup"
```

---

### Post-Migration Notes

**Import replacement cheat sheet (84 frontend files):**
- `from '@/types/ai'` -> `from '@zync/shared/types'`
- `from '@/types/bot'` -> `from '@zync/shared/types'`
- `from '@/types/document'` -> `from '@zync/shared/types'`
- `from '@/types/gitlab'` -> `from '@zync/shared/types'`
- `from '@/types/habit'` -> `from '@zync/shared/types'`
- `from '@/types/jira'` -> `from '@zync/shared/types'`
- `from '@/types/jobs'` -> `from '@zync/shared/types'`
- `from '@/types/journal'` -> `from '@zync/shared/types'`
- `from '@/types/message'` -> `from '@zync/shared/types'`
- `from '@/types/opencode'` -> `from '@zync/shared/types'`
- `from '@/types/project'` -> `from '@zync/shared/types'`
- `from '@/types/settings'` -> `from '@zync/shared/types'`
- `from '@/types/social'` -> `from '@zync/shared/types'`
- `from '@/types/todo'` -> `from '@zync/shared/types'`

**Import replacement (21 server route files):**
- `from '../lib/schemas.js'` -> `from '@zync/shared/schemas'`
- `from '../../lib/schemas.js'` -> `from '@zync/shared/schemas'`

**validate.ts decision:** If it imports Express types, keep it in `packages/server/src/lib/validate.ts` and only import schemas from shared. If it's generic, move to shared.
