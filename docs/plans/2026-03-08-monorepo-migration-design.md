# Monorepo Migration Design

**Date:** 2026-03-08
**Status:** Approved

## Overview

Migrate the ai-dashboard project from a loosely-coupled root+server structure to a proper pnpm monorepo with Turborepo, where each service is its own package.

## Tooling

- **pnpm workspaces** for dependency management
- **Turborepo** for build orchestration, caching, and parallel task execution
- Each package gets its own Dockerfile (self-contained)

## Package Structure

```
ai-dashboard/
├── package.json              # Root: pnpm workspaces + turborepo scripts
├── pnpm-workspace.yaml       # Declares packages/*
├── turbo.json                # Build pipeline config
├── packages/
│   ├── app/                  # React frontend
│   │   ├── package.json      # @zync/app
│   │   ├── Dockerfile
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── index.html
│   │   └── src/
│   ├── server/               # Express backend
│   │   ├── package.json      # @zync/server
│   │   ├── Dockerfile
│   │   ├── tsconfig.json
│   │   └── src/
│   ├── shared/               # Shared types, Zod schemas, constants
│   │   ├── package.json      # @zync/shared
│   │   ├── tsconfig.json
│   │   └── src/
│   ├── whisper/              # Python whisper transcription service
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── server.py
│   ├── wakeword/             # Python wake word detection service
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── server.py
│   └── pr-agent/             # Python PR review service
│       ├── Dockerfile
│       ├── requirements.txt
│       └── run_pr_agent.py
├── docker-compose.yml
├── docker-compose.prod.yml
├── nginx.conf
├── data/                     # Persistent runtime data (mounted into server)
└── .env.example
```

## File Migration Map

| Current Location | New Location |
|---|---|
| `src/` | `packages/app/src/` |
| `public/` | `packages/app/public/` |
| `index.html` | `packages/app/index.html` |
| `vite.config.ts` | `packages/app/vite.config.ts` |
| `tsconfig.json` (frontend) | `packages/app/tsconfig.json` |
| `Dockerfile.frontend` | `packages/app/Dockerfile` |
| `components.json` | `packages/app/components.json` |
| `server/src/` | `packages/server/src/` |
| `server/package.json` | `packages/server/package.json` |
| `server/tsconfig.json` | `packages/server/tsconfig.json` |
| `Dockerfile.backend` | `packages/server/Dockerfile` |
| `server/data/` | `packages/server/data/` |
| `server/whisper/` | `packages/whisper/` |
| `server/wakeword/` | `packages/wakeword/` |
| `server/scripts/run_pr_agent.py` | `packages/pr-agent/run_pr_agent.py` |
| Shared types from `src/types/` | `packages/shared/src/` |

## Shared Package (`@zync/shared`)

Contains TypeScript types, Zod schemas, and constants used by both `@zync/app` and `@zync/server`:

- Common type definitions (bot, settings, social, document types)
- Zod validation schemas (currently in server, reusable by frontend)
- Shared constants (API paths, event names)

Both `@zync/app` and `@zync/server` declare `@zync/shared` as a workspace dependency.

## Turborepo Pipeline

```jsonc
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

Build order: `shared` first (no deps), then `server` and `app` in parallel (both depend on `shared`).

## PR-Agent Containerization

Currently the backend spawns `run_pr_agent.py` as a child process using a local Python venv. After migration:

- PR-Agent becomes its own Docker service
- Gets a Dockerfile that installs `pr-agent` pip package
- Exposes an HTTP API (replacing the child process spawn pattern)
- The server calls it over HTTP instead of `spawn()`
- Benefits: no venv management on server, independent scaling, cleaner separation

## Docker Compose Changes

- Build contexts point to `packages/<name>/` directories
- Root context used where monorepo deps are needed (app and server need access to shared)
- Python services (whisper, wakeword, pr-agent) use their package dir as sole build context
- Volume mounts updated: `./data` stays at root, mapped into server container
- Image names unchanged: `ghcr.io/lawndlwd/zync-{frontend,backend,whisper,wakeword}`
- New image: `ghcr.io/lawndlwd/zync-pr-agent`

## Root package.json

Simplified to workspace orchestration:

```jsonc
{
  "name": "zync",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck"
  },
  "devDependencies": {
    "turbo": "^2.x",
    "typescript": "^5.9"
  }
}
```

All app/server-specific deps move to their respective package.json files.

## Data & Persistence

- `data/` directory stays at project root (not inside any package)
- Docker volumes mount `./data` into the server container
- SQLite databases, auth state, documents all remain in `data/`
