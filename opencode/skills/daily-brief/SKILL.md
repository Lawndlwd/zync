---
name: daily-brief
description: 'Write the user''s daily brief: today''s meetings, mail and messages that need an answer, cards due, turned into a short list of suggested to-dos, saved with write_brief. Use for the daily-brief job and whenever the user asks for "my brief", "what''s on today", "morning report", "what do I need to do today".'
---

# Daily brief

The brief is one page per day, `Briefs/<YYYY-MM-DD>.md`, shown on that day in the calendar and on
the overview. Its to-dos are **suggestions**: the user turns the ones they want into cards with one
click. You never create cards, events, or send anything yourself.

## 1. Gather (all read-only)

Use the `zync-jobs` MCP tools. Today is in the user's time zone; "since" defaults to the last 24 h.

1. `list_connections`: which accounts exist. Skip what isn't connected; mention accounts with an
   `error` under *Couldn't check* (they need reconnecting in Settings → Connections).
2. **Meetings**: `list_calendar` (today → tomorrow) for zync's own events and cards with a time, and
   `external_events` (same days) for Google calendars.
3. **Mail**: `search_mail` with `query: "is:unread"` (then `"is:important"` if that's a lot). Read a
   mail in full with `read_mail` only when the snippet doesn't tell whether it needs an answer.
4. **Messages**: `unread_messages`. Telegram gives every chat its unread badge counts (people, bots,
   groups, channels; muted and archived chats only when they mention the user), with `chatUnread` per
   chat and its latest messages. Slack gives direct and group messages since `since`, and mentions.
   To look at one conversation in full, `list_chats` then `read_chat`.
5. **Cards**: `list_calendar` from 7 days ago → tomorrow gives cards due (overdue ones are still in
   an open column); `list_boards` + `list_cards` if you need their columns.

Every call reports accounts it couldn't read under `failed`: list them, don't retry in a loop.

## 2. Decide

- A to-do is something the user must **do**: reply, decide, prepare, pay, book, review. Newsletters,
  notifications, receipts, automated mail and chit-chat are not to-dos.
- Prefer fewer, sharper to-dos (3–10). Most important first: deadlines today, people waiting, then
  meetings to prepare.
- Title = the action, with who/what: "Reply to Sara about the offer (Acme)", "Prepare the 14:00
  design review". Max ~80 characters.
- `source`: where it came from, e.g. `Gmail · work`, `Slack · #design`, `Telegram · Mom`,
  `Calendar`, `Board · Launch`. Use the connection's label.
- `link`: the mail/message/event link from the tool, or the card's file for cards.
- Don't repeat a card that already exists as a to-do: mention it under *Cards* instead.
- Channel posts (`kind: channel`) are news, not requests: summarise them in one line per channel under
  *FYI* ("Dev news: 140 unread, latest about the 2.0 release"), and make a to-do only when a post asks
  the user for something. People, bots and groups come first under *Needs an answer*.

## 3. Write

Call `write_brief` with `date` (today), `todos`, `sources` (everything you checked, failed ones too)
and `markdown`, in this shape (drop empty sections):

```md
## Meetings
- **09:30–10:00** Standup (Google · work) · [open](link)
- **14:00** Design review, prepare the mockups

## Needs an answer
- **Sara (Gmail · work)**: offer for the Q4 contract, wants a reply today · [open](link)
- **#design (Slack)**: Tom asks which logo version to ship · [open](link)

## Cards
- Overdue: *Write the report* (Launch board, due Fri)
- Due today: *Pay the invoice*

## FYI
- 12 newsletters and notifications skipped.

## Couldn't check
- Gmail · perso: Google access expired, reconnect in Settings → Connections.

Checked: Google Calendar ✓ · Gmail · work ✓ · Gmail · perso ✗ · Telegram ✓ 151 unread (3 chats) · Slack ✓ 2 mentions
```

Always end with the **Checked** line: every connection from `list_connections` plus zync's calendar
and boards, each ✓ (with "nothing unread" / "no meetings" when empty) or ✗ with the short reason.
A source that had nothing still appears there, so the user knows it was read.

Keep it scannable: one line per item, no greetings, no summary of the summary. Quote nobody at
length: a few words are enough to know what it's about. Writing the brief again the same day
replaces it; to-dos already turned into cards stay linked.
