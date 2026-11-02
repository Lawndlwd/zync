---
name: becoming
description: 'Who the user is becoming (Atomic Habits identities): turn "I want to be a writer / run / be present at home" into identity pages in Becoming/ with create_identity, record votes when the user says they did one, and write the weekly Mirror. Use when the user talks about habits, goals, routines, who they want to be, "I want to start…", "I did my run", or asks for their Mirror.'
---

# Becoming

An **identity** is who the user wants to become ("I am a writer"), not a goal ("write a book").
Every time they act like that person is a **vote** for it. A vote is `full` (the real action) or
`small` (the 2-minute version on a hard day): a small vote still counts. Missing a day is normal;
missing two in a row is what to avoid.

Each identity is a page `Becoming/<name>.md` (tools: `list_identities`, `create_identity`,
`update_identity`, `vote`, `becoming_today`). Zync counts most votes on its own from what it sees
(files edited, calendar events, cards done); the user only votes by hand for what Zync can't see.

## Creating an identity (the interview)

Ask **one question at a time**, short, in the user's language:

1. **Who do you want to be in a year?** Turn the answer into a statement starting with "I am":
   "I am a writer", "I am a runner", "I am present at home". One identity per page; if they list
   several, start with the one they care most about and offer the others after.
2. **What does a tiny vote for that look like?** Get the full action ("Write 300 words", "Run 5k")
   and the 2-minute version ("One sentence", "Put on shoes and walk out"). If they only give a big
   action, propose the small one yourself.
3. **What would Zync see when you do it?** Pick the signals:
   - writing, coding, notes → `{files: "<folder>/"}` (look at the workspace to name the real folder);
   - a sport or appointment they put in the calendar → `{event: "<word in the title>"}`;
   - work tracked on a board → `{card: {label: "<label>"}}` or `{card: {board: "<board>"}}`;
   - training logged in Zync's Training area → `{workout: {minMinutes: 20}}` (a finished workout;
     shorter than `minMinutes` counts as the small version). Votes are cast when the workout ends;
   - nothing visible (reading a paper book, meditating) → `{manual: true}`: they tap to vote.
   - "not doing something" (no laptop after 19:00, no phone in bed) → no signals, a **guard**
     instead: `{label, from, to, days?}`. Zync then votes each day the guard holds.

Also ask **when** it fits (morning, midday, evening or a time) if they didn't say, and write their
reasons in `why`, in their words. Then call `create_identity` and answer in two or three lines:
the statement, the full / small versions, what Zync will watch. Mention they can change anything on
the Becoming page.

Stages: a new identity starts as an **experiment** (28 days, only one at a time). If one already
runs, create the new one as `stage: "trying"` only when the user already does it regularly;
otherwise suggest waiting and note it in memory.

## Votes from chat

When the user says they did it ("ran this morning", "wrote a bit"), call `vote` with `full` or
`small` and a short `note` in their words. Answer in one line ("Counted: small vote for runner.").
Never scold for a miss; offer the 2-minute version instead.

## Guards

Guards are standing rules for every chat and job: never schedule anything inside one. If the user
asks for a time inside a guard, move it just before and say so in one line; keep their time only if
they insist.

## The Mirror (weekly)

The Mirror is a page a week, `Becoming/Mirror/<week>.md`: **who the user actually was** next to who
they say they are. Not a score. Get the numbers with `becoming_week`, then call `write_mirror`.

- If `daysTracked` < 5, write only one fact ("Not enough evidence yet — N days tracked") and no
  questions or change.
- **facts**: one per identity plus one for unclaimed time, each a plain sentence built from the
  numbers, with the pattern that explains it. Put key numbers in **bold**. Examples:
  - "You say writer. You lived **2h10 of writing**, all before 9:00 — on the three days your first
    meeting started at 9:30 or later."
  - "Runner **1 of 4**. Every miss was on a day with a meeting after 18:00."
  - "**14h of meetings** belong to no identity; **5h are recurring** and declinable."
  Look for the *why* in `spans` (time of day), the calendar (`list_calendar`, `external_events`),
  and guard days kept. Never moralise, never praise empty-handed.
- **questions**: exactly three, each drawn from a pattern of *this* week, answerable in one tap:
  give 2–3 `options` ("Yes, guard mornings" / "Not yet"). One free question (no options) at most.
- **change**: at most one, the smallest change that removes the biggest obstacle, as an identity
  patch: add a guard (`guards: [{label, from, to, days}]`), move `when`, or set `small`. `label`
  says it plainly ("Add guard: Mornings 7–9 are for writing"), `detail` what it does, and
  `alternative` a second, lighter idea in a few words.

Save one memory (`memory_save`, type preference or fact) only for a lasting insight, e.g. "Writes
only before 9:00", never the week's numbers.
