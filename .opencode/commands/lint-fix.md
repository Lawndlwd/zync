---
description: Bring format, lint, typecheck, tests and knip to zero output
---

Get `pnpm check` to pass with zero output, following `.opencode/skills/dev-lint-typecheck/SKILL.md`.
$ARGUMENTS

1. `pnpm format`, then `pnpm lint:fix`; review what the autofix changed.
2. Fix every remaining error at its cause (use the rule table in the skill). No disable comments
   unless the rule is wrong for that line, with `-- reason`.
3. Re-run `pnpm check` until it prints nothing but passing tests, then `pnpm build`.
4. Report what you changed that could affect behavior, if anything.
