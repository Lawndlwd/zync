You are an expert full-stack developer. Build me a personal AI agent dashboard as a React application (Vite + TypeScript) tailored to a frontend developer working at Scaleway with the following specifications:

---

## PROJECT OVERVIEW

A unified personal productivity dashboard that connects to my tools (Jira, messaging, tasks), uses an LLM backend to help me manage, prioritize, and act on my work — all in one place.

---

## TECH STACK

- Frontend: React 18 + TypeScript + Vite
- UI: Tailwind CSS + shadcn/ui components
- State management: Zustand
- Data fetching: React Query (TanStack Query)
- Routing: React Router v6
- Backend: Node.js + Express (or Hono for edge-ready) serving as a proxy/API layer
- AI: OpenAI-compatible API (configurable base URL + model, supports local LLMs via Ollama)
- Auth: API key stored in .env, no OAuth for now

---

## CORE MODULES TO BUILD

### 1. 📥 Inbox / Messages Panel
- Connect to a configurable source (Slack webhook or email via IMAP/SMTP or a custom messages API endpoint)
- Display messages with sender, timestamp, content preview
- AI can summarize unread threads and suggest a reply draft
- Mark as read / archive
- Filter by channel / priority

### 2. 🎯 Jira Tasks Panel
- Connect to Jira REST API v3 (base URL + API token configurable in .env)
- Fetch issues assigned to me (JQL: `assignee = currentUser() ORDER BY updated DESC`)
- Display: issue key, summary, status, priority, labels, sprint
- Actions: transition status (To Do → In Progress → Done), add comment, open in Jira
- AI: parse the issue description and auto-generate a structured TODO checklist for me

### 3. ✅ Personal To-Do List
- Local persistent to-dos (stored in localStorage or a small SQLite via backend)
- Each to-do can be linked to a Jira issue key
- Fields: title, description, linked issue, priority (P1–P4), due date, status (open/in-progress/done)
- Bulk actions: mark done, delete, reorder
- AI: given a Jira issue, auto-create a set of actionable sub-tasks

### 4. 🤖 AI Agent Chat Panel
- A side panel or modal with a chat interface
- The agent has context of: currently open Jira issues, my to-do list, recent messages
- Capabilities (tool calls):
  - `get_my_jira_issues()` – fetch assigned issues
  - `create_todo(title, description, linked_issue)` – add to personal list
  - `mark_todo_done(id)` – complete a to-do
  - `transition_jira_issue(issue_key, status)` – update Jira status
  - `draft_reply(message_id)` – draft a reply to a message
  - `summarize_sprint()` – summarize current sprint status
- Use OpenAI function calling / tool use format
- Stream responses (SSE or streaming fetch)

### 5. 📊 Daily Digest / Overview Widget
- Top of the dashboard
- Shows: number of open Jira issues, unread messages, pending to-dos, blockers
- AI-generated daily briefing: "You have 3 P1 issues, 2 messages awaiting reply, your sprint ends in 4 days"
- Refresh button to regenerate

### 6. ⚙️ Settings Panel
- Configure: Jira base URL, Jira email, Jira API token, project key, default JQL
- Configure: LLM base URL (e.g. https://api.openai.com or local Ollama), model name, API key
- Configure: message source (Slack webhook URL, IMAP settings, or custom endpoint)
- All stored in localStorage or a .env file, never exposed to frontend directly (proxy via backend)

### 7. 📓 Daily Journal
- One document per day, auto-created when you first open the journal on that date
- Rich text editor using TipTap (lightweight, React-native, fully extensible)
- Left sidebar lists all past days as a calendar or scrollable date list (most recent first)
- Each day's entry is a full-page freeform document: supports markdown shortcuts,
  headings, bullet lists, code blocks, checkboxes
- Auto-populated daily template when a new day is opened:
    ## 🗓️ [Today's Date]

    ### 🎯 Focus for today
    (linked from open Jira issues — AI pre-fills this based on sprint)

    ### 📝 Notes
    (free writing)

    ### 🔁 EOD Reflection
    - What did I complete?
    - What's blocked?
    - What carries over to tomorrow?

- AI features:
  - "Fill Focus" button: queries your open Jira issues and pre-fills
    the "Focus for today" section
  - "Generate standup" button: reads yesterday's and today's
    entries + Jira transitions to write a standup summary
  - "Summarize week" button: reads Mon–Fri entries and produces
    a weekly recap
  - Free-text prompt inside the editor: select any text → right-click
    → "Ask AI about this"

- Storage:
  - Entries saved as JSON blobs (content + date + metadata) in localStorage
    OR in a SQLite file via the backend
  - Optional: sync to Scaleway Object Storage as Markdown files
    (one file per day: YYYY-MM-DD.md) so entries are portable
  - Export: download a day or a date range as a single .md or .pdf file

- Cross-module links:
  - Tag a journal entry with a Jira issue key → shows a backlink
    in the Jira panel ("📓 You wrote about this on Feb 27")
  - Completed to-dos from the day auto-appear at the bottom of
    the journal entry as a "Done today" summary
  - Journal entries searchable by keyword across all dates

- Keyboard shortcuts:
  - Cmd/Ctrl + J → open today's journal from anywhere in the app
  - Cmd/Ctrl + Shift + F → full-screen writing mode (distraction-free)

---

## LAYOUT

- Sidebar navigation with icons (Inbox, Jira, To-Do, AI Agent, Settings)
- Main content area split into a primary panel (left 60%) and context panel (right 40%)
- AI chat panel slides in from the right or bottom
- Dark mode by default, toggle available
- Responsive: works on laptop, not required on mobile

---

## SCALEWAY-SPECIFIC CONSIDERATIONS

- The app should be deployable as a static frontend + Node backend on Scaleway Container or Serverless
- Include a `Dockerfile` for both frontend (nginx) and backend (node)
- Include a `docker-compose.yml` for local dev
- API proxy in the backend to avoid CORS issues with Jira and LLM APIs
- Add an optional Scaleway Object Storage adapter to persist to-dos and settings as JSON blobs

---

## ADDITIONAL DEVELOPER-SPECIFIC USE CASES TO INCLUDE

- **PR Review Queue**: List open GitLab/GitHub PRs assigned to me or requesting my review, with AI summary of the diff and suggested review notes
- **Standup Generator**: Based on Jira transitions from yesterday + today, auto-generate a standup text I can copy-paste
- **Blocker Detector**: AI scans open issues and flags ones with no activity for 48h+ as blockers
- **Code Snippet Scratchpad**: Quick notes panel where I can save code snippets with tags, searchable
- **Sprint Burndown Hint**: Simple visual showing remaining issues vs. sprint days left (no full chart lib needed, CSS-based)

---

## CODE QUALITY REQUIREMENTS

- All components typed with TypeScript interfaces
- Custom hooks for each integration (useJiraIssues, useTodos, useAIAgent, useMessages)
- Error boundaries on each panel
- Loading skeletons for all async data
- Environment variables validated on app start with Zod
- Modular folder structure:
  src/
  ├── components/
  │   ├── jira/
  │   ├── todos/
  │   ├── messages/
  │   ├── ai-agent/
  │   └── ui/
  ├── hooks/
  ├── store/
  ├── services/
  │   ├── jira.ts
  │   ├── llm.ts
  │   └── messages.ts
  ├── types/
  └── pages/

---

## DELIVERABLES

1. Full project scaffold with all files
2. Backend Express server with proxy routes for Jira, LLM, and messages
3. `.env.example` with all required variables documented
4. `README.md` with setup steps, how to connect Jira, how to swap the LLM
5. Start with the Jira panel and AI agent chat as the two most critical features

Begin by scaffolding the full folder structure and the Jira panel with working API calls.




❯
