import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import {
  createBoard,
  createCard,
  deleteCard,
  firstColumn,
  listBoards,
  readBoard,
  runCardNow,
  updateCard,
} from '../../boards/index.js'
import { defaultTimezone } from '../../helpers/dates.js'
import { resolveWorkspace } from '../../workspaces.js'
import { workspaceArg } from '../args.js'
import { cardSummary, safe } from '../format.js'

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
  duration: z
    .number()
    .int()
    .nullable()
    .optional()
    .describe('Minutes the card takes on the calendar, starting at its due time (default 60). null to clear.'),
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

export function registerBoardTools(server: McpServer): void {
  server.registerTool(
    'list_boards',
    {
      description:
        'List kanban boards in a workspace, with their columns. A board is a folder; each .md file in it is a card.',
      inputSchema: { workspace: workspaceArg },
    },
    safe(async ({ workspace }) => {
      const ws = await resolveWorkspace(workspace)
      const boards = await listBoards(ws.path)
      return boards.length ? boards : 'No boards yet.'
    }),
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
    safe(async ({ workspace, name, parent }) => {
      const ws = await resolveWorkspace(workspace)
      return createBoard(ws.path, { name, parent })
    }),
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
    safe(async ({ workspace, board, status, assignee }) => {
      const ws = await resolveWorkspace(workspace)
      const data = await readBoard(ws.path, board)
      const cards = data.cards
        .filter(
          (c) =>
            (!status || (c.status ?? firstColumn(data.board)) === status) && (!assignee || c.assignee === assignee),
        )
        .map(cardSummary)
      return { board: data.board, cards }
    }),
  )

  server.registerTool(
    'create_card',
    {
      description:
        'Create a card (a markdown file named after the title in the board folder). Assign to "ai" with runAt to have the AI do it at that time (a linked job is created). ' +
        'Clarify the task with the user first when assigning to "ai".',
      inputSchema: { workspace: workspaceArg, board: boardArg, title: z.string(), ...cardFields },
    },
    safe(async ({ workspace, board, ...input }) => {
      const ws = await resolveWorkspace(workspace)
      return cardSummary(await createCard(ws.path, board, input))
    }),
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
    safe(async ({ workspace, board, file, ...patch }) => {
      const ws = await resolveWorkspace(workspace)
      return cardSummary(await updateCard(ws.path, board, file, patch))
    }),
  )

  server.registerTool(
    'run_card_now',
    {
      description: 'Assign a card to "ai" and run it immediately. It moves to In progress, then Review when done.',
      inputSchema: { workspace: workspaceArg, board: boardArg, file: fileArg },
    },
    safe(async ({ workspace, board, file }) => {
      const ws = await resolveWorkspace(workspace)
      return cardSummary(await runCardNow(ws.path, board, file))
    }),
  )

  server.registerTool(
    'delete_card',
    {
      description: 'Delete a card (and its linked job). Confirm with the user first.',
      inputSchema: { workspace: workspaceArg, board: boardArg, file: fileArg },
    },
    safe(async ({ workspace, board, file }) => {
      const ws = await resolveWorkspace(workspace)
      await deleteCard(ws.path, board, file)
      return `Deleted card ${file}.`
    }),
  )
}
