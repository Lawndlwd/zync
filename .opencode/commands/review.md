---
description: Review the working-tree diff against AGENTS.md and the dev-* skills
---

Review the current changes (`git diff` and untracked files under `packages/`, plus $ARGUMENTS if
given) as a strict senior reviewer of this repo.

1. Read `AGENTS.md`. For each changed file, load the matching skill(s) from `.opencode/skills/`
   (TypeScript → `dev-typescript`; effects/refs/timers → `dev-react-effects`; components →
   `dev-react-components`; queries/api.ts → `dev-data-fetching`; api routes → `dev-api-routes`;
   tests → `dev-testing`).
2. Look for, in this order: correctness bugs (races, stale closures, missing cleanup, wrong document
   saved, path traversal, unvalidated input), behavior changes the task didn't ask for, rule
   violations from the skills, missing tests for new logic, dead code.
3. Run `pnpm check` and `pnpm build`; include any output.

Answer with a list, most severe first, one item per finding: `path:line — problem — fix`. Say
"no findings" if there are none. Don't edit files.
