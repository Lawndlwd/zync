import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { BRIEFS_DIR, readBrief, TodoInputSchema, writeBrief } from '../../briefs/index.js'
import { resolveWorkspace } from '../../workspaces.js'
import { workspaceArg } from '../args.js'
import { safe } from '../format.js'

const dateArg = z.string().describe('The day, "YYYY-MM-DD".')

export function registerBriefTools(server: McpServer): void {
  server.registerTool(
    'write_brief',
    {
      description:
        `Write the daily brief of a day: ${BRIEFS_DIR}/<date>.md, shown on that day in the calendar and on the overview. ` +
        'The to-dos become a checklist at the top of the page ("## To-do", one "- [ ] title — source · [open](link)" line each): ' +
        'do not write that section in the markdown yourself. ' +
        'Rewriting a day replaces it, but to-dos the user already ticked or turned into cards keep that (matched by title). ' +
        'The to-dos are suggestions: the user turns the ones they want into cards.',
      inputSchema: {
        workspace: workspaceArg,
        date: dateArg,
        markdown: z
          .string()
          .describe(
            'The brief, in markdown: short sections (## Meetings, ## Mail, ## Messages, ## Cards…), links to the sources.',
          ),
        todos: z
          .array(TodoInputSchema)
          .describe(
            'Suggested to-dos for the day, most important first. title: an action ("Reply to Sara about the offer"); source: e.g. "Gmail · work"; link: to the message or event.',
          ),
        sources: z
          .array(z.string())
          .optional()
          .describe(
            'What was checked, e.g. ["Gmail · work", "Slack · acme", "Calendar"], including those that failed.',
          ),
      },
    },
    safe(async ({ workspace, date, markdown, todos, sources }) => {
      const ws = await resolveWorkspace(workspace)
      return writeBrief(ws.path, date, { body: markdown, todos, ...(sources ? { sources } : {}) })
    }),
  )

  server.registerTool(
    'read_brief',
    {
      description: "A day's brief: its markdown and to-dos (with `card` for those already turned into cards).",
      inputSchema: { workspace: workspaceArg, date: dateArg },
    },
    safe(async ({ workspace, date }) => {
      const ws = await resolveWorkspace(workspace)
      return readBrief(ws.path, date)
    }),
  )
}
