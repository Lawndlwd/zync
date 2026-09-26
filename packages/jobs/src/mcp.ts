#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
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

await server.connect(new StdioServerTransport())
