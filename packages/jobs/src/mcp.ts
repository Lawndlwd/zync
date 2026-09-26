#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
  type Card,
  type CardPatch,
  createBoard,
  createCard,
  deleteCard,
  listBoards,
  readBoard,
  runCardNow,
  updateCard,
} from './boards.js'
import {
  defaultTimezone,
  deleteJob,
  errorMessage,
  type Job,
  type JobInput,
  jobPath,
  listJobs,
  nextRuns,
  readJob,
  requestRun,
  validateJob,
  writeJob,
} from './job-file.js'
import { createPerson, listPeople } from './people.js'
import { readRuns } from './runs.js'
import { listWorkspaces, resolveWorkspace } from './workspaces.js'

const server = new McpServer({ name: 'zync-jobs', version: '0.1.0' })

const workspaceArg = z
  .string()
  .describe(
    'Workspace name, or the absolute path of the current project directory (use your working directory when the user means "this project").',
  )

const jobFields = {
  schedule: z
    .string()
    .optional()
    .describe('Cron expression for recurring jobs, e.g. "14 15 * * 1" = every Monday 15:14. Omit when using "at".'),
  at: z.string().optional().describe('One-shot local date-time, e.g. "2026-09-28T15:14". Omit when using "schedule".'),
  timezone: z.string().optional().describe(`IANA timezone. Defaults to ${defaultTimezone()}.`),
  agent: z
    .string()
    .optional()
    .describe(
      'opencode agent to run the job with. Defaults to the unattended "job" agent; only set when the user asks.',
    ),
  model: z.string().optional().describe('Model as provider/model-id. Omit to use the default model.'),
  context: z
    .array(z.string())
    .optional()
    .describe('Paths (relative to the workspace) the AI must read before doing the task.'),
  notify: z.enum(['always', 'failure', 'never']).optional().describe('When to push a notification. Default: always.'),
  enabled: z.boolean().optional(),
}

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] }
}

function fail(err: unknown) {
  return { isError: true, content: [{ type: 'text' as const, text: errorMessage(err) }] }
}

function describe(job: Job) {
  const tz = job.timezone || defaultTimezone()
  const runs = nextRuns(job).map((d) =>
    d.toLocaleString('en-GB', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' }),
  )
  return {
    name: job.name,
    when: job.schedule ? `cron "${job.schedule}"` : `once at ${job.at}`,
    timezone: tz,
    enabled: job.enabled,
    nextRuns: runs,
    warning: job.enabled && runs.length === 0 ? 'This job will never run (date in the past?)' : undefined,
  }
}

server.registerTool(
  'list_workspaces',
  { description: 'List registered workspaces (project folders) jobs can run in.' },
  async () => {
    try {
      return ok(await listWorkspaces())
    } catch (err) {
      return fail(err)
    }
  },
)

server.registerTool(
  'create_job',
  {
    description:
      'Create a scheduled AI job. The job runs unattended in a new opencode session inside the workspace. ' +
      'Only call this after clarifying the details with the user. Returns the next run times: show them to the user.',
    inputSchema: {
      workspace: workspaceArg,
      name: z.string().describe('Short kebab-case id, e.g. "weekly-report".'),
      instructions: z
        .string()
        .describe('Complete, self-contained instructions: goal, steps, where to write output, definition of done.'),
      ...jobFields,
    },
  },
  async ({ workspace, ...input }) => {
    try {
      const ws = await resolveWorkspace(workspace)
      const job = validateJob(input as JobInput)
      const file = await writeJob(ws.path, job)
      return ok({ created: file, workspace: ws.name, ...describe(job) })
    } catch (err) {
      return fail(err)
    }
  },
)

server.registerTool(
  'update_job',
  {
    description: 'Update fields of an existing job. Unspecified fields keep their value.',
    inputSchema: {
      workspace: workspaceArg,
      name: z.string(),
      instructions: z.string().optional(),
      ...jobFields,
    },
  },
  async ({ workspace, name, ...patch }) => {
    try {
      const ws = await resolveWorkspace(workspace)
      const current = await readJob(ws.path, name)
      const merged: Record<string, unknown> = { ...current }
      for (const [k, v] of Object.entries(patch)) if (v !== undefined) merged[k] = v
      // Switching between recurring and one-shot clears the other field.
      if (patch.schedule) delete merged.at
      if (patch.at) delete merged.schedule
      const job = validateJob(merged as unknown as JobInput)
      await writeJob(ws.path, job, { overwrite: true })
      return ok({ updated: jobPath(ws.path, name), ...describe(job) })
    } catch (err) {
      return fail(err)
    }
  },
)

server.registerTool(
  'list_jobs',
  {
    description: 'List jobs with their schedule and next runs. Omit workspace to list all workspaces.',
    inputSchema: { workspace: workspaceArg.optional() },
  },
  async ({ workspace }) => {
    try {
      const wss = workspace ? [await resolveWorkspace(workspace)] : await listWorkspaces()
      const out = []
      for (const ws of wss) {
        for (const e of await listJobs(ws.path)) {
          out.push(
            e.job ? { workspace: ws.name, ...describe(e.job) } : { workspace: ws.name, name: e.name, error: e.error },
          )
        }
      }
      return ok(out.length ? out : 'No jobs.')
    } catch (err) {
      return fail(err)
    }
  },
)

server.registerTool(
  'delete_job',
  {
    description: 'Delete a job and its run history. Confirm with the user first.',
    inputSchema: { workspace: workspaceArg, name: z.string() },
  },
  async ({ workspace, name }) => {
    try {
      const ws = await resolveWorkspace(workspace)
      await deleteJob(ws.path, name)
      return ok(`Deleted job "${name}" from ${ws.name}.`)
    } catch (err) {
      return fail(err)
    }
  },
)

server.registerTool(
  'run_job_now',
  {
    description: 'Run a job immediately (in addition to its schedule). It starts within a few seconds.',
    inputSchema: { workspace: workspaceArg, name: z.string() },
  },
  async ({ workspace, name }) => {
    try {
      const ws = await resolveWorkspace(workspace)
      await requestRun(ws.path, name)
      return ok(`Queued "${name}". A new session titled "[job] ${name} · …" will appear shortly.`)
    } catch (err) {
      return fail(err)
    }
  },
)

server.registerTool(
  'list_runs',
  {
    description: 'Show recent runs of a job (most recent first) with status and summary.',
    inputSchema: { workspace: workspaceArg, name: z.string(), limit: z.number().int().min(1).max(100).optional() },
  },
  async ({ workspace, name, limit }) => {
    try {
      const ws = await resolveWorkspace(workspace)
      const runs = await readRuns(ws.path, name, limit ?? 10)
      return ok(runs.length ? runs : 'No runs yet.')
    } catch (err) {
      return fail(err)
    }
  },
)

// ── kanban ─────────────────────────────────────────────────────────────────

const boardArg = z.string().describe('Board folder path from list_boards, e.g. "Sprint 1".')
const fileArg = z.string().describe('Card file name from list_cards, e.g. "Write the report.md".')

const cardFields = {
  status: z.string().optional().describe('Column id, e.g. backlog, todo, doing, review, done (see list_boards).'),
  assignee: z
    .string()
    .nullable()
    .optional()
    .describe('Person id from list_people: "me", "ai", or a created person. null to unassign.'),
  due: z.string().nullable().optional().describe('Due date "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM". null to clear.'),
  labels: z.array(z.string()).optional(),
  runAt: z
    .string()
    .nullable()
    .optional()
    .describe(
      `For assignee "ai" only: local date-time "YYYY-MM-DDTHH:MM" (${defaultTimezone()}) when the AI runs the card. null to clear.`,
    ),
  context: z
    .array(z.string())
    .optional()
    .describe('Workspace-relative paths the AI must read before working the card.'),
  description: z
    .string()
    .optional()
    .describe('Markdown. For "ai" cards this is the complete, self-contained task: goal, steps, output path, done.'),
}

function cardSummary(c: Card) {
  return {
    file: c.file,
    title: c.title,
    status: c.status,
    assignee: c.assignee ?? null,
    due: c.due,
    labels: c.labels.length ? c.labels : undefined,
    runAt: c.runAt,
    ai: c.ai,
  }
}

server.registerTool(
  'list_people',
  { description: 'List people cards can be assigned to. "me" is the user, "ai" makes the AI run the card.' },
  async () => {
    try {
      return ok(await listPeople())
    } catch (err) {
      return fail(err)
    }
  },
)

server.registerTool(
  'add_person',
  {
    description: 'Create a person to assign cards to. Returns their id.',
    inputSchema: { name: z.string(), color: z.string().optional().describe('Hex color like #22c55e') },
  },
  async (input) => {
    try {
      return ok(await createPerson(input))
    } catch (err) {
      return fail(err)
    }
  },
)

server.registerTool(
  'list_boards',
  {
    description:
      'List kanban boards in a workspace, with their columns. A board is a folder; each .md file in it is a card.',
    inputSchema: { workspace: workspaceArg },
  },
  async ({ workspace }) => {
    try {
      const ws = await resolveWorkspace(workspace)
      const boards = await listBoards(ws.path)
      return ok(boards.length ? boards : 'No boards yet.')
    } catch (err) {
      return fail(err)
    }
  },
)

server.registerTool(
  'create_board',
  {
    description:
      'Create a kanban board: a folder named after the board (or an existing folder) with the default columns ' +
      '(Backlog, To do, In progress, Review, Done).',
    inputSchema: {
      workspace: workspaceArg,
      name: z.string().describe('Board (and folder) name.'),
      parent: z.string().optional().describe('Workspace-relative folder to create it in. Default: workspace root.'),
    },
  },
  async ({ workspace, name, parent }) => {
    try {
      const ws = await resolveWorkspace(workspace)
      return ok(await createBoard(ws.path, { name, parent }))
    } catch (err) {
      return fail(err)
    }
  },
)

server.registerTool(
  'list_cards',
  {
    description: 'List cards on a board, optionally filtered by status (column) or assignee.',
    inputSchema: {
      workspace: workspaceArg,
      board: boardArg,
      status: z.string().optional(),
      assignee: z.string().optional(),
    },
  },
  async ({ workspace, board, status, assignee }) => {
    try {
      const ws = await resolveWorkspace(workspace)
      const data = await readBoard(ws.path, board)
      const cards = data.cards
        .filter(
          (c) =>
            (!status || (c.status ?? data.board.columns[0].id) === status) && (!assignee || c.assignee === assignee),
        )
        .map(cardSummary)
      return ok({ board: data.board, cards })
    } catch (err) {
      return fail(err)
    }
  },
)

server.registerTool(
  'create_card',
  {
    description:
      'Create a card (a markdown file named after the title in the board folder). Assign to "ai" with runAt to have the AI do it at that time (a linked job is created). ' +
      'Clarify the task with the user first when assigning to "ai".',
    inputSchema: { workspace: workspaceArg, board: boardArg, title: z.string(), ...cardFields },
  },
  async ({ workspace, board, ...input }) => {
    try {
      const ws = await resolveWorkspace(workspace)
      return ok(cardSummary(await createCard(ws.path, board, input as CardPatch & { title: string })))
    } catch (err) {
      return fail(err)
    }
  },
)

server.registerTool(
  'update_card',
  {
    description:
      'Update a card: move it (status), assign it, reschedule it (runAt), rename it (title, renames the file) or edit it. ' +
      'Unspecified fields keep their value.',
    inputSchema: {
      workspace: workspaceArg,
      board: boardArg,
      file: fileArg,
      title: z.string().optional(),
      ...cardFields,
    },
  },
  async ({ workspace, board, file, ...patch }) => {
    try {
      const ws = await resolveWorkspace(workspace)
      return ok(cardSummary(await updateCard(ws.path, board, file, patch as CardPatch)))
    } catch (err) {
      return fail(err)
    }
  },
)

server.registerTool(
  'run_card_now',
  {
    description: 'Assign a card to "ai" and run it immediately. It moves to In progress, then Review when done.',
    inputSchema: { workspace: workspaceArg, board: boardArg, file: fileArg },
  },
  async ({ workspace, board, file }) => {
    try {
      const ws = await resolveWorkspace(workspace)
      return ok(cardSummary(await runCardNow(ws.path, board, file)))
    } catch (err) {
      return fail(err)
    }
  },
)

server.registerTool(
  'delete_card',
  {
    description: 'Delete a card (and its linked job). Confirm with the user first.',
    inputSchema: { workspace: workspaceArg, board: boardArg, file: fileArg },
  },
  async ({ workspace, board, file }) => {
    try {
      const ws = await resolveWorkspace(workspace)
      await deleteCard(ws.path, board, file)
      return ok(`Deleted card ${file}.`)
    } catch (err) {
      return fail(err)
    }
  },
)

await server.connect(new StdioServerTransport())
