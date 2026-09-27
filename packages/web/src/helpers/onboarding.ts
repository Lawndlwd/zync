import type { Step, StepGuide, StepId } from '../types/onboarding'
import type { WorkspaceData } from '../types/workspace'
import { boardUrl, wsUrl } from './urls'

/** The attribute a control carries so the guide can spotlight it: `data-tour="new-page"`. */
const tourTarget = (name: string) => `[data-tour="${name}"]`

type Progress = {
  data: WorkspaceData
  /** Memories saved, global and in this workspace. */
  memories: number
  /** The ⌘K palette was opened at least once. */
  paletteSeen: boolean
}

const STEP_IDS: StepId[] = ['page', 'board', 'ai-card', 'job', 'memory', 'palette']

/** The "Get started" missions, each ticked from what the workspace really contains. */
export function onboardingSteps({ data, memories, paletteSeen }: Progress): Step[] {
  const cardFiles = new Set(data.cards.map((c) => c.ref))
  const done: Record<StepId, boolean> = {
    page: data.recent.some((f) => f.name.endsWith('.md') && !cardFiles.has(f.path) && !f.path.startsWith('Calendar/')),
    board: data.boards.length > 0,
    'ai-card': data.cards.some((c) => c.card.assignee === 'ai'),
    job: data.jobs.some((j) => j.job !== undefined && j.job.card === undefined),
    memory: memories > 0,
    palette: paletteSeen,
  }
  const titles: Record<StepId, string> = {
    page: 'Write your first page',
    board: 'Create a board',
    'ai-card': 'Give a card to @ai',
    job: 'Schedule a job from the chat',
    memory: 'Teach the AI something to remember',
    palette: 'Press ⌘K to go anywhere',
  }
  return STEP_IDS.map((id) => ({ id, title: titles[id], done: done[id] }))
}

/** Where "Show me" takes you for a step, and what it points at there. */
export function stepGuide(id: StepId, ws: string, data: WorkspaceData): StepGuide {
  const board = data.boards[0]
  switch (id) {
    case 'page':
      return {
        to: wsUrl(ws, 'files'),
        tip: {
          target: tourTarget('new-page'),
          title: 'Pages are markdown files',
          body: 'Write notes, plans, anything. Type [[ to link another page and @ to mention someone.',
        },
      }
    case 'board':
      return {
        to: wsUrl(ws, 'boards'),
        tip: {
          target: tourTarget('new-board'),
          title: 'A board is a folder',
          body: 'Name it and pick columns. Every card on it is a page you can open and write in.',
        },
      }
    case 'ai-card':
      return board
        ? {
            to: boardUrl(ws, board.path),
            tip: {
              target: tourTarget('add-card'),
              title: 'Hand work to the AI',
              body: 'Add a card, open it, set the assignee to @ai and a run time. The AI does it and moves the card to Review.',
            },
          }
        : {
            to: wsUrl(ws, 'boards'),
            tip: {
              target: tourTarget('new-board'),
              title: 'First, a board',
              body: 'Cards live on boards. Create one, then add a card and assign it to @ai.',
            },
          }
    case 'job':
      return {
        to: wsUrl(ws, 'overview'),
        tip: {
          target: tourTarget('chat'),
          title: 'Ask for it in the chat',
          body: 'Open the chat (⌘J) and say “every Monday at 9, summarise notes/ into reports/weekly.md”. It becomes a job.',
        },
      }
    case 'memory':
      return {
        to: wsUrl(ws, 'memory'),
        tip: {
          target: tourTarget('new-memory'),
          title: 'What the AI should always know',
          body: 'Rules, preferences, habits, facts. The AI reads them in every chat and job, and saves new ones as it learns.',
        },
      }
    case 'palette':
      return {
        to: wsUrl(ws, 'overview'),
        tip: {
          target: tourTarget('palette'),
          title: 'Everything is one ⌘K away',
          body: 'Find any page, card or job, or run a command. G then O, F, B, C or J jumps between sections; ⌥-click opens a link beside.',
        },
      }
  }
}
