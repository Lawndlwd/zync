import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import {
  CALENDAR_DIR,
  calendarRange,
  createEvent,
  deleteEvent,
  listEvents,
  RepeatSchema,
  updateEvent,
} from '../../calendar/index.js'
import { defaultTimezone } from '../../helpers/dates.js'
import { resolveWorkspace } from '../../workspaces.js'
import { workspaceArg } from '../args.js'
import { safe } from '../format.js'

const whenArg = (what: string) =>
  z.string().describe(`${what}: "YYYY-MM-DD" (all-day) or local "YYYY-MM-DDTHH:MM" (${defaultTimezone()}).`)
const repeatArg = RepeatSchema.describe(
  'Make it a recurring event: the start (date and time) is the first occurrence and every occurrence keeps its time and length. ' +
    'every: day | week | month | year; days: weekdays for weekly, e.g. ["mon","fri"] (default: the start\'s weekday); ' +
    'interval: every N (default 1); until: last day "YYYY-MM-DD"; except: skipped days "YYYY-MM-DD".',
)
const eventFileArg = z
  .string()
  .describe(`Event file name in ${CALENDAR_DIR}/, from list_calendar, e.g. "Team sync.md".`)

export function registerCalendarTools(server: McpServer): void {
  server.registerTool(
    'list_calendar',
    {
      description:
        'Everything with a time between two dates: calendar events, cards (due / AI runAt, with their duration), scheduled job runs and past runs. ' +
        'Use it to see what the user has planned before adding or moving things. ' +
        'A recurring event shows once per occurrence (recurring: true); change the series with update_event (start, end, repeat). Events are moved with update_event, cards with update_card (due, duration, runAt), one-shot jobs with update_job (at). Recurring job occurrences cannot be moved one by one.',
      inputSchema: {
        workspace: workspaceArg,
        from: z.string().describe('First day, "YYYY-MM-DD".'),
        to: z.string().describe('Day after the last day, "YYYY-MM-DD" (exclusive).'),
      },
    },
    safe(async ({ workspace, from, to }) => {
      const ws = await resolveWorkspace(workspace)
      return calendarRange(ws.path, from, to)
    }),
  )

  server.registerTool(
    'create_event',
    {
      description:
        `Add an event to the calendar. It is a markdown page ${CALENDAR_DIR}/<title>.md (start/end/people in the frontmatter, notes in the body), ` +
        'so it can also be written or edited as a file directly.',
      inputSchema: {
        workspace: workspaceArg,
        title: z.string(),
        start: whenArg('Start'),
        end: whenArg('End (optional; defaults to 1 hour, or the same day when all-day). Same form as start').optional(),
        people: z.array(z.string()).optional().describe('Person ids from list_people.'),
        repeat: repeatArg.optional(),
        description: z.string().optional().describe('Markdown notes.'),
      },
    },
    safe(async ({ workspace, ...input }) => {
      const ws = await resolveWorkspace(workspace)
      return createEvent(ws.path, input)
    }),
  )

  server.registerTool(
    'update_event',
    {
      description: 'Move, resize, rename or edit a calendar event. Unspecified fields keep their value.',
      inputSchema: {
        workspace: workspaceArg,
        file: eventFileArg,
        title: z.string().optional(),
        start: whenArg('Start').optional(),
        end: whenArg('End').nullable().optional(),
        people: z.array(z.string()).optional(),
        repeat: repeatArg.nullable().optional().describe('The full new rule, or null to stop repeating.'),
        description: z.string().optional(),
      },
    },
    safe(async ({ workspace, file, ...patch }) => {
      const ws = await resolveWorkspace(workspace)
      return updateEvent(ws.path, file, patch)
    }),
  )

  server.registerTool(
    'list_events',
    { description: `List all calendar events (pages in ${CALENDAR_DIR}/).`, inputSchema: { workspace: workspaceArg } },
    safe(async ({ workspace }) => {
      const ws = await resolveWorkspace(workspace)
      return (await listEvents(ws.path)).map(({ extra: _, ...e }) => e)
    }),
  )

  server.registerTool(
    'delete_event',
    {
      description: 'Delete a calendar event (its page). Confirm with the user first.',
      inputSchema: { workspace: workspaceArg, file: eventFileArg },
    },
    safe(async ({ workspace, file }) => {
      const ws = await resolveWorkspace(workspace)
      await deleteEvent(ws.path, file)
      return `Deleted event ${file}.`
    }),
  )
}
