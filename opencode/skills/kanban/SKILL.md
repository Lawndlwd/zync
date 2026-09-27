---
name: kanban
description: 'Manage kanban boards and cards: create tasks, move them between columns, assign them to people (@me, @ai, or others), set due dates, and have the AI do a card at a given time ("put X on the board", "assign this to the AI for Friday 9:00", "what''s in review?", "move the report card to done"). Use whenever the user talks about boards, cards, tasks, a todo list or who is doing what.'
---

# Kanban boards

A board is an ordinary folder in the workspace, marked by a hidden `.board.json` that lists its
columns (default ids: `backlog`, `todo`, `doing`, `review`, `done`). Each markdown file directly
inside the folder is a card. The file name is the title, and the frontmatter holds the fields:

```md
---
title: Write the report
status: todo            # column id
assignee: me            # person id: me, ai, or a created person
due: 2026-10-01T14:00   # date, or date-time to put it on the calendar
duration: 90            # minutes on the calendar (default 60)
labels: [q3]
runAt: 2026-09-30T09:00 # ai cards only
context: [notes/]       # ai cards only
order: 2
---
Description / task.
```

People are global: `me` is the user, `ai` is you, and the user can add others.

Prefer the `zync-jobs` MCP tools: `list_boards`, `create_board`, `list_cards`, `create_card`,
`update_card`, `run_card_now`, `delete_card`, `list_people`, `add_person`. They keep the linked
`@ai` jobs in sync, which hand edits don't. Reading card files directly is fine.

## Finding things

- Unsure which board? Call `list_boards`. If there's only one, use it. If there are none, offer to create one.
- "What's on my plate?" → `list_cards` with `assignee: "me"`. "What's in review?" → `status: "review"`.
- Resolve names to person ids with `list_people`. If the user names someone who doesn't exist, ask
  whether to add them, then call `add_person`.

## Cards for humans

Create cards directly, with little back-and-forth. The title is short and imperative, and details go
in `description`. Set `due` only when the user gives a date. Resolve relative dates ("Friday") to an
absolute `YYYY-MM-DD`.

## Cards for the AI (`assignee: "ai"`)

An `ai` card is run by you later, unattended, in a new session. Nobody will be there to answer
questions, so the card must be complete. Before creating it, settle the details with the **question
tool** in one round, offering defaults:

- **What exactly:** the goal, the steps, and what "done" means.
- **Output:** which file or folder to write to, and whether to overwrite or append.
- **Context:** the files or folders to read first (the `context` field).
- **When:** a `runAt` local date-time `YYYY-MM-DDTHH:MM`, or run it now with `run_card_now`.

Write `description` as self-contained instructions for an AI that hasn't seen this conversation.
Never write "as discussed".

What happens next: at `runAt`, the card moves to **In progress**, a session titled `[job] card-…`
runs it, and then the card moves to **Review** with your summary (or back to **To do** if the run
failed). The user gets a notification. Tell them this after creating the card, including the run time.

For work that **repeats** ("every Monday"), use the `schedule-job` skill instead. Cards run once.

## Changing cards

- Move: `update_card` with `status`. Reassign: `assignee`. Reschedule: `runAt`, or `null` to cancel.
- Reassigning an `ai` card to someone else cancels its scheduled run.
- Delete: confirm with the user first.
