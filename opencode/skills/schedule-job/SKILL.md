---
name: schedule-job
description: 'Schedule work for the AI to do later or on a recurring basis ("do X on Monday at 15:14", "every morning summarize…", "remind/run/check … at …"). Use whenever the user asks for a task at a specific time or on a schedule, or wants to list, change, run or delete scheduled jobs.'
---

# Scheduling AI jobs

Jobs are stored as markdown files in `<workspace>/.opencode/jobs/<name>.md` and run by the scheduler
service: at the scheduled time it opens a **new, unattended opencode session** in the workspace, sends
the job instructions, and notifies the user when the run finishes. Use the `zync-jobs` MCP tools
(`create_job`, `update_job`, `list_jobs`, `delete_job`, `run_job_now`, `list_runs`, `list_workspaces`).
Do not write job files by hand.

## 1. Clarify before creating

The job runs without a human, so its instructions must be complete. Use the **question tool** to ask
about anything the user did not already make clear. Ask everything in one round when you can, and
offer sensible defaults as options. Things to settle:

- **What exactly:** the goal, the steps, and what "done" looks like.
- **Output:** which file or folder to write to (e.g. `reports/2026-W40.md`), and whether to overwrite or append.
- **Context:** which files or folders the AI must read first.
- **When:** one-off (`at`) or recurring (`schedule`), the exact time, and the timezone. Default to the
  current timezone and confirm it. Resolve relative dates ("next Monday", "tomorrow") to an absolute date.
- **Workspace:** default to the current project (your working directory). Call `list_workspaces` if unsure.
- **Notify:** `always` (default), `failure`, or `never`.

Skip questions the user already answered. Don't ask more than needed.

## 2. Create

Call `create_job`:

- `name`: short kebab-case, e.g. `weekly-report`.
- `instructions`: self-contained, written for an AI that has none of this conversation. Include the
  goal, the steps, the output path, and the definition of done. Never write "as discussed".
- `schedule`: 5-field cron, `min hour day-of-month month day-of-week`:
  - `14 15 * * 1` = Mondays 15:14
  - `0 8 * * 1-5` = weekdays 08:00
  - `30 18 1 * *` = the 1st of each month at 18:30
- `at`: local date-time `YYYY-MM-DDTHH:MM`, for one-off jobs. It turns itself off after running.
- `context`: workspace-relative paths.

## 3. Confirm

Show the user the name, the next run times returned by the tool, and where the results will go.
Offer `run_job_now` if they want to test it immediately.

## Managing jobs

- "What's scheduled?" → `list_jobs`.
- Change the time or task → `update_job`, which only needs the changed fields.
- "Did it run?" / "what happened?" → `list_runs`. Each run has a `sessionId` whose full transcript is
  in the session list.
- Delete → confirm with the user first, then `delete_job`.

Jobs named `card-…` belong to kanban cards. Manage them through the card (`kanban` skill), not
with `update_job` or `delete_job`. For a one-off task the user tracks on a board, prefer an `ai`
card over a job.
