import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import {
  BECOMING_DIR,
  becomingToday,
  castVote,
  createIdentity,
  externalBusy,
  GuardSchema,
  IdentityInputSchema,
  IdentityPatchSchema,
  becomingWeek,
  isoWeek,
  listIdentities,
  MirrorInputSchema,
  writeMirror,
  SignalSchema,
  today,
  updateIdentity,
  weekMonday,
} from '../../becoming/index.js'
import { addDays } from '../../helpers/dates.js'
import { resolveWorkspace } from '../../workspaces.js'
import { workspaceArg } from '../args.js'
import { safe } from '../format.js'

const fileArg = z.string().describe(`Identity file name in ${BECOMING_DIR}/, from list_identities, e.g. "writer.md".`)
const signalsArg = z
  .array(SignalSchema)
  .describe(
    'What Zync can see when the user does it: {files: "Writing/"} (time spent editing files in a folder), ' +
      '{event: "run"} (a calendar event whose title contains the word), {card: {label: "essay"}} or {card: {board: "Blog"}} ' +
      '(a card reaching Done), {workout: {minMinutes: 20}} (a finished workout in Training; shorter = small vote), ' +
      'or {manual: true} (only the user can tell: they vote with a tap).',
  )
const guardsArg = z
  .array(GuardSchema)
  .describe(
    'Time the whole app keeps free for this identity, e.g. {label: "Present at home", from: "19:00", to: "24:00"}; ' +
      'days optional (["mon","tue",…]). An identity with guards and no signals is voted when its guards hold.',
  )

/** A week's numbers with the connected calendars of that week (default: this week). */
async function weekStats(wsPath: string, week?: string) {
  const w = week ?? isoWeek(today())
  const monday = weekMonday(w) ?? today()
  return becomingWeek(wsPath, w, await externalBusy(monday, addDays(monday, 7)))
}

export function registerBecomingTools(server: McpServer): void {
  server.registerTool(
    'list_identities',
    {
      description:
        `Who the user is becoming: the identity pages in ${BECOMING_DIR}/ (statement, action, 2-minute version, ` +
        'when, signals, guards, stage) with their proof. Respect every guard when you schedule anything.',
      inputSchema: { workspace: workspaceArg },
    },
    safe(async ({ workspace }) => listIdentities((await resolveWorkspace(workspace)).path)),
  )

  server.registerTool(
    'create_identity',
    {
      description:
        `Create an identity page in ${BECOMING_DIR}/ from what the user told you, following the becoming skill. ` +
        'statement: "I am a writer" (who, not what); action: the full version; small: the 2-minute version for heavy days. ' +
        'Only one identity may be in the experiment stage at a time.',
      inputSchema: {
        workspace: workspaceArg,
        ...IdentityInputSchema.shape,
        when: z.string().optional().describe('morning | midday | evening, or a time "HH:MM" when the user has one.'),
        signals: signalsArg.optional(),
        guards: guardsArg.optional(),
        why: z.string().optional().describe('Why the user wants this, in their words (markdown).'),
      },
    },
    safe(async ({ workspace, ...input }) => createIdentity((await resolveWorkspace(workspace)).path, input)),
  )

  server.registerTool(
    'update_identity',
    {
      description:
        'Change an identity page: its wording, versions, when, signals, guards or stage. null clears small / when. ' +
        'Move the stage only when the user agrees.',
      inputSchema: {
        workspace: workspaceArg,
        file: fileArg,
        ...IdentityPatchSchema.shape,
        signals: signalsArg.optional(),
        guards: guardsArg.optional(),
      },
    },
    safe(async ({ workspace, file, ...patch }) =>
      updateIdentity((await resolveWorkspace(workspace)).path, file, patch),
    ),
  )

  server.registerTool(
    'vote',
    {
      description:
        'Record that the user did it today (or on `date`): "full", "small" (the 2-minute version, still a vote) or ' +
        '"clear" to undo. Use it when the user tells you ("I ran this morning"). Things Zync can see are counted on their own.',
      inputSchema: {
        workspace: workspaceArg,
        file: fileArg,
        kind: z.enum(['full', 'small', 'clear']),
        date: z.string().optional().describe('The day, "YYYY-MM-DD" (default today).'),
        note: z.string().optional().describe('What the user said they did, short: "ran 5k by the river".'),
      },
    },
    safe(async ({ workspace, file, kind, date, note }) =>
      castVote((await resolveWorkspace(workspace)).path, file, date ?? today(), kind, 'ai', note),
    ),
  )

  server.registerTool(
    'becoming_today',
    {
      description:
        'A day seen through the identities: heavy or open (and why), what each identity asks today (full or the ' +
        '2-minute version), its free slot, whether it was voted (and what Zync saw), who missed yesterday, the one card ' +
        'that votes for an identity. Use it for the "Becoming today" section of the daily brief.',
      inputSchema: {
        workspace: workspaceArg,
        date: z.string().optional().describe('The day, "YYYY-MM-DD" (default today).'),
      },
    },
    safe(async ({ workspace, date }) => {
      const ws = await resolveWorkspace(workspace)
      const day = date ?? today()
      return becomingToday(ws.path, day, await externalBusy(addDays(day, -1), addDays(day, 1)))
    }),
  )

  const weekArg = z.string().optional().describe('ISO week "2026-W39" (default: the current week).')

  server.registerTool(
    'becoming_week',
    {
      description:
        'The numbers behind the Mirror: per identity the minutes Zync saw (files, calendar), votes (full / small), ' +
        'cards closed, when it happened (spans per day), guard days kept; plus unclaimed meeting time and which of it ' +
        'recurs. daysTracked < 5 means too little to judge.',
      inputSchema: { workspace: workspaceArg, week: weekArg },
    },
    safe(async ({ workspace, week }) => weekStats((await resolveWorkspace(workspace)).path, week)),
  )

  server.registerTool(
    'write_mirror',
    {
      description:
        `Write the week's Mirror page (${BECOMING_DIR}/Mirror/<week>.md), following the becoming skill. Zync adds the ` +
        'numbers itself; you give plain facts (one per identity, plus unclaimed time, no scores), exactly three ' +
        'questions drawn from this week, and at most one change (an identity patch: add guards, move `when`, set the ' +
        'small version). Rewriting keeps answers the user already gave.',
      inputSchema: { workspace: workspaceArg, week: weekArg, ...MirrorInputSchema.shape },
    },
    safe(async ({ workspace, week, ...input }) => {
      const ws = await resolveWorkspace(workspace)
      return writeMirror(ws.path, await weekStats(ws.path, week), input)
    }),
  )
}
