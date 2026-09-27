import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { defaultTimezone } from '../../helpers/dates.js'
import {
  deleteJob,
  type JobInput,
  jobPath,
  listJobs,
  readJob,
  requestRun,
  validateJob,
  writeJob,
} from '../../job-file.js'
import { readRuns } from '../../runs.js'
import { listWorkspaces, resolveWorkspace } from '../../workspaces.js'
import { workspaceArg } from '../args.js'
import { definedOnly, describeJob, safe } from '../format.js'

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

export function registerJobTools(server: McpServer): void {
  server.registerTool(
    'list_workspaces',
    { description: 'List registered workspaces (project folders) jobs can run in.' },
    safe(async () => {
      return listWorkspaces()
    }),
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
    safe(async ({ workspace, ...input }) => {
      const ws = await resolveWorkspace(workspace)
      const job = validateJob(input)
      const file = await writeJob(ws.path, job)
      return { created: file, workspace: ws.name, ...describeJob(job) }
    }),
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
    safe(async ({ workspace, name, ...patch }) => {
      const ws = await resolveWorkspace(workspace)
      const current = await readJob(ws.path, name)
      const merged: JobInput = { ...current, ...definedOnly(patch) }
      // Switching between recurring and one-shot clears the other field.
      if (patch.schedule) delete merged.at
      if (patch.at) delete merged.schedule
      const job = validateJob(merged)
      await writeJob(ws.path, job, { overwrite: true })
      return { updated: jobPath(ws.path, name), ...describeJob(job) }
    }),
  )

  server.registerTool(
    'list_jobs',
    {
      description: 'List jobs with their schedule and next runs. Omit workspace to list all workspaces.',
      inputSchema: { workspace: workspaceArg.optional() },
    },
    safe(async ({ workspace }) => {
      const wss = workspace ? [await resolveWorkspace(workspace)] : await listWorkspaces()
      const out = []
      for (const ws of wss) {
        for (const e of await listJobs(ws.path)) {
          out.push(
            e.job
              ? { workspace: ws.name, ...describeJob(e.job) }
              : { workspace: ws.name, name: e.name, error: e.error },
          )
        }
      }
      return out.length ? out : 'No jobs.'
    }),
  )

  server.registerTool(
    'delete_job',
    {
      description: 'Delete a job and its run history. Confirm with the user first.',
      inputSchema: { workspace: workspaceArg, name: z.string() },
    },
    safe(async ({ workspace, name }) => {
      const ws = await resolveWorkspace(workspace)
      await deleteJob(ws.path, name)
      return `Deleted job "${name}" from ${ws.name}.`
    }),
  )

  server.registerTool(
    'run_job_now',
    {
      description: 'Run a job immediately (in addition to its schedule). It starts within a few seconds.',
      inputSchema: { workspace: workspaceArg, name: z.string() },
    },
    safe(async ({ workspace, name }) => {
      const ws = await resolveWorkspace(workspace)
      await requestRun(ws.path, name)
      return `Queued "${name}". A new session titled "[job] ${name} · …" will appear shortly.`
    }),
  )

  server.registerTool(
    'list_runs',
    {
      description: 'Show recent runs of a job (most recent first) with status and summary.',
      inputSchema: { workspace: workspaceArg, name: z.string(), limit: z.number().int().min(1).max(100).optional() },
    },
    safe(async ({ workspace, name, limit }) => {
      const ws = await resolveWorkspace(workspace)
      const runs = await readRuns(ws.path, name, limit ?? 10)
      return runs.length ? runs : 'No runs yet.'
    }),
  )
}
