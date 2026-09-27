---
name: calendar
description: 'Read and change the user''s calendar: what''s planned this week, add a meeting or time block, move or resize things ("what do I have on Thursday?", "block 2h tomorrow morning for the report", "move the sync to 3pm", "plan my week around these cards"). Use whenever the user talks about their schedule, agenda, meetings, events or when something happens.'
---

# Calendar

The calendar in Zync shows everything with a time, all in local wall-clock time:

- **Events**: markdown pages in the workspace's `Calendar/` folder. The file name is the title and
  the body holds the notes:

  ```md
  ---
  start: 2026-09-28T14:00   # or 2026-09-28 for all-day
  end: 2026-09-28T15:30     # optional: 1 hour (all-day: same day) when unset
  people: [me, sara]        # person ids (list_people)
  repeat:                   # optional: a recurring event (start = first occurrence)
    every: week             # day | week | month | year
    days: [mon, fri]        # weekly only (default: the start's weekday)
    interval: 2             # optional: every 2 weeks
    until: 2026-12-31       # optional: last day
    except: [2026-10-09]    # optional: skipped days
  ---
  Agenda, links to other pages, @mentions…
  ```

- **Cards**: a card with a `due` date-time is a block of `duration` minutes (default 60), and a
  date-only `due` shows as all-day. An `ai` card with `runAt` also shows as an AI run.
- **Jobs**: one-shot jobs (`at`), each occurrence of recurring jobs (cron), and past runs with their
  result.

Prefer the `zync-jobs` MCP tools:

- `list_calendar` (from, to) lists everything in a range. Call it before adding or moving things, to
  see what's already there and avoid overlaps.
- `create_event`, `update_event`, `delete_event`, `list_events` manage events. For something that
  repeats ("gym every Monday and Friday at 5am"), create one event with `repeat` — never one event
  per occurrence. Each occurrence shows in `list_calendar` with `recurring: true`; changing `start`,
  `end` or `repeat` with `update_event` changes the whole series. To cancel a single occurrence,
  add its day to `repeat.except`; to stop the series from a date, set `repeat.until`.
- To move or resize a card, use `update_card` with `due` / `duration` (or `runAt` for the AI).
- To move a one-shot job, use `update_job` with `at`. Recurring jobs change only by editing their
  `schedule`, which moves every occurrence, so say so before doing it.

## Guidelines

- Resolve relative dates ("tomorrow", "Friday 3pm") to absolute `YYYY-MM-DD` / `YYYY-MM-DDTHH:MM`,
  and repeat the resolved time back to the user.
- Something the user will *do* (a task) is a card. Something that *happens* at a time (a meeting,
  a call, a focus block, a trip) is an event. If it's unclear, ask.
- When planning a day or week, read `list_calendar` first and fit things into free slots. Summarize
  the plan, then create it.
- Delete only after the user confirms.
