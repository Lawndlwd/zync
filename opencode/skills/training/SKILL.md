---
name: training
description: 'The user''s training (gym, home workouts): build or change a weekly plan of routines from their training profile, find exercises, log a workout they did, and read their progress. Use when the user asks for a workout plan or program, wants to change a routine ("swap squats", "make Monday shorter"), says they trained ("did legs today", "benched 80 kg for 5"), or asks how their training is going.'
---

# Training

Zync's Training area keeps everything as pages in `Training/`: the profile (`training_profile`),
routines in `Training/Routines/` (`list_routines`, `save_routine`, `delete_routine`), the workout log
in `Training/Log/` (`list_workouts`, `log_workout`) and progress (`training_progress`). Exercise ids
come from a catalog of 1,300+ exercises with instructions and GIFs (`search_exercises`), plus the
user's custom ones. Weights are always stored in **kg**; the profile's `units` is only how the app
shows them, so convert lb (× 0.4536) before saving.

## Building a plan

1. **Read first.** `training_profile` (goal, experience, equipment, injuries, days per week, session
   length) and `list_routines`. No profile yet: ask for the missing essentials one question at a
   time (goal, days per week, equipment, injuries), save them with `save_training_profile`, or point
   the user to Training → Set up.
2. **Split by days per week** (`daysPerWeek`):
   - 2–3 days: full body (A/B alternating), beginners always full body;
   - 4 days: upper / lower × 2;
   - 5–6 days: push / pull / legs (+ upper/lower or a repeat), intermediate and advanced only;
   - 7 days: 6 training days plus one light session (mobility, easy cardio, core).
   The `days` of all routines together total exactly `daysPerWeek`, weekdays `Mon`…`Sun`, **no
   weekday used twice** across routines. Spread them: never three hard days in a row when it can be
   avoided; put a rest day between two sessions hitting the same muscles.
3. **Pick exercises only with `search_exercises`** — never invent an id or reuse one from memory.
   Use `owned: true` to stay within the user's equipment, and search by plain names ("goblet squat",
   "dumbbell row", "push-up"). If nothing fits, choose the closest owned variant; create nothing.
   - **Only owned equipment.** `bodyweight` and `pull_up_bar` alone means body-weight moves only.
   - **Respect injuries**: leave out anything loading the injured area (knee → no deep squats, jumps,
     lunges; lower back → no deadlifts, good mornings, heavy bent rows; shoulder → no overhead
     press, dips, upright rows) and pick a safer variant. Say what you avoided and why, in one line.
   - **Compound first**, isolation after; 4–7 exercises per session, fewer when `sessionMinutes` is
     short (about 8–10 min per exercise with rest).
   - Balance the week: push and pull, knee- and hip-dominant legs, some core.
4. **Schemes by goal** (`scheme` is sets × rep range · rest; the rep range drives progression):
   | Goal | Compounds | Isolation |
   |---|---|---|
   | strength | `4×3-6 · 180s` | `3×8-10 · 90s` |
   | build_muscle | `3×6-10 · 120s` | `3×10-15 · 60s` |
   | lose_fat | `3×8-12 · 60s` | `3×12-15 · 45s` |
   | endurance | `3×12-20 · 45s` | `2×15-20 · 30s` |
   | general_fitness | `3×8-12 · 90s` | `2×10-15 · 60s` |
   Beginners: one set fewer. `rest` = the seconds in the scheme. `sets` = one target per set with
   `reps` at the bottom of the range; **`kg` stays empty unless you truly know** a sensible weight
   (the user said it, or a past workout shows it).
5. **Save** each routine with `save_routine` (name like "Full Body A", "Push Day"; saving the same
   name replaces it). Before replacing routines the user already has, ask. If a save is rejected for
   an unknown id, search again and retry with a real id.
6. **Answer in a few lines**: the split, one line per routine (days · main lifts), what you avoided
   for injuries, how progression works ("when you hit the top of the range on every set, Zync adds
   weight next time"). Then ask what they want to change.

## Refining

Change only what the user asks ("swap squats for leg press", "Monday is too long", "no Fridays"):
`list_routines`, adjust, `save_routine` the routines that changed. Keep weekdays unique. When they
say something lasting ("I hate burpees", "only 45 minutes on weekdays"), also save it with
`memory_save` (type preference).

## Linking Becoming

After the plan, offer once: "Want this to count for Becoming — 'I am someone who trains'?" If yes,
use the becoming skill: `create_identity` (or `update_identity` on an existing one) with the signal
`{workout: {minMinutes: 20}}` (use a smaller number for short sessions), action "Train", small
version "10 minutes of anything". Each finished workout then votes automatically.

## Logging from chat

When the user says they trained, record it with `log_workout`: `date` (default today), `time`,
`minutes`, `routine` when it matches one, and per exercise the id (from `search_exercises` or the
routine) with the sets as done (`kg`, `reps`; `warmup: true` for warm-ups). Answer in one line with
any personal record it set and the Becoming vote it counted for. Don't log a workout the app is
already tracking live (`list_workouts` shows `active: true`).

## Progress

`training_progress` (8w, 6m, all) gives volume per week or month, personal records (best estimated
1RM, Epley, with the gain) and body weight; `list_workouts` the sessions. Report plain facts with the
numbers in **bold** ("Bench e1RM **+5.8 kg** in 3 weeks; volume **down 20%** since you moved to 3
days"). Never scold a gap; suggest the smallest next step (a short session, the 2-minute version).
