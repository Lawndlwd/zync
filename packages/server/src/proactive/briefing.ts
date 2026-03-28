import cron, { type ScheduledTask } from 'node-cron'
import { getChannelManager } from '../channels/manager.js'
import type { ChannelType } from '../channels/types.js'
import { getConfig } from '../config/index.js'
import { logger } from '../lib/logger.js'
import { getOrCreateSession } from '../opencode/client.js'
import { waitForResponse } from '../opencode/wait-for-response.js'
import { getDailyLevers, getIdentity, getJournalEntry, getLifeOsComponents, getLifeOsStats } from '../planner/db.js'
import { getGoalRoots } from '../planner/goals.js'
import { loadPromptContent } from '../skills/prompts.js'

let briefingTasks: ScheduledTask[] = []

interface BriefingCheckItem {
  id: string
  label: string
  enabled: boolean
}

function parseFragments(raw: string): Record<string, string> {
  const fragments: Record<string, string> = {}
  const lines = raw.split('\n')
  let currentKey = ''
  let currentValue = ''

  for (const line of lines) {
    const match = line.match(/^(\w+):\s(.+)$/)
    if (match && !line.startsWith('  ')) {
      if (currentKey) fragments[currentKey] = currentValue.trim()
      currentKey = match[1]
      currentValue = match[2]
    } else if (currentKey) {
      currentValue += `\n${line}`
    }
  }
  if (currentKey) fragments[currentKey] = currentValue.trim()
  return fragments
}

function loadFragments(type: 'morning' | 'evening'): Record<string, string> {
  try {
    return parseFragments(loadPromptContent(type === 'morning' ? 'morning-briefing' : 'evening-briefing'))
  } catch {
    return {}
  }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Gather Life OS context from the database to inject into the prompt */
function gatherLifeOsContext(type: 'morning' | 'evening'): string {
  const today = todayStr()
  const sections: string[] = []

  try {
    // Identity statement
    const identity = getIdentity() as { statement: string } | undefined
    if (identity?.statement) {
      sections.push(`[Identity Statement]\n${identity.statement}`)
    }

    // Active components (vision, anti-vision, 1-year goal, 1-month project, constraints)
    const components = getLifeOsComponents() as Array<{
      type: string
      title: string
      content: string
      is_active: number
      target_date: string | null
    }>
    const active = components.filter((c) => c.is_active)
    if (active.length > 0) {
      const lines = active.map((c) => {
        const date = c.target_date ? ` (target: ${c.target_date})` : ''
        return `  - ${c.type}: ${c.title}${date}`
      })
      sections.push(`[Life OS Game Board — Active Components]\n${lines.join('\n')}`)
    }

    // Daily levers for today
    const levers = getDailyLevers(today) as Array<{
      title: string
      completed: number
      completed_at: string | null
    }>
    if (levers.length > 0) {
      const done = levers.filter((l) => l.completed).length
      const lines = levers.map((l) => `  ${l.completed ? '[x]' : '[ ]'} ${l.title}`)
      sections.push(`[Daily Levers — ${done}/${levers.length} completed]\n${lines.join('\n')}`)
    } else {
      sections.push(`[Daily Levers]\nNo levers set for today yet.`)
    }

    // Active goals (top-level)
    const goals = (getGoalRoots('active') ?? []) as Array<{
      title: string
      granularity: string
      progress: number
      endDate: string | null
    } | null>
    const activeGoals = goals.filter(Boolean) as Array<{
      title: string
      granularity: string
      progress: number
      endDate: string | null
    }>
    if (activeGoals.length > 0) {
      const lines = activeGoals.map((g) => {
        const date = g.endDate ? ` (due: ${g.endDate})` : ''
        return `  - [${g.granularity}] ${g.title} — ${g.progress}% done${date}`
      })
      sections.push(`[Active Goals]\n${lines.join('\n')}`)
    } else if (goals.length === 0) {
      sections.push(`[Active Goals]\nNo active goals set. Consider defining a 1-year goal.`)
    }

    // Journal status for today
    const morningJournal = getJournalEntry(today, 'morning') as { completed_at: string | null } | undefined
    const eveningJournal = getJournalEntry(today, 'evening') as { completed_at: string | null } | undefined

    if (type === 'morning') {
      sections.push(
        `[Journal Status]\n  Morning protocol: ${morningJournal?.completed_at ? 'completed' : 'not yet done'}\n  Evening synthesis: ${eveningJournal?.completed_at ? 'completed' : 'pending'}`,
      )
    } else {
      sections.push(
        `[Journal Status]\n  Morning protocol: ${morningJournal?.completed_at ? 'completed' : 'skipped'}\n  Evening synthesis: ${eveningJournal?.completed_at ? 'completed' : 'not yet done'}`,
      )
    }

    // Stats (XP, streak, level)
    const stats = getLifeOsStats() as {
      totalXp: number
      level: number
      currentStreak: number
      bestStreak: number
    }
    sections.push(
      `[Stats] Level ${stats.level} · ${stats.totalXp} XP · Streak: ${stats.currentStreak} days (best: ${stats.bestStreak})`,
    )
  } catch (err) {
    logger.warn({ err }, 'Failed to gather Life OS context for briefing')
  }

  return sections.length > 0
    ? '\n\n--- LIFE OS CONTEXT (pre-fetched from database) ---\n' +
        sections.join('\n\n') +
        '\n--- END LIFE OS CONTEXT ---\n'
    : ''
}

function buildPrompt(type: 'morning' | 'evening', items: BriefingCheckItem[], instructions: string): string {
  const fragments = loadFragments(type)
  const enabledItems = items.filter((i) => i.enabled)
  const hasLifeOs = enabledItems.some((i) => ['lifeos', 'levers', 'goals', 'journal'].includes(i.id))

  const header = type === 'morning' ? 'Generate a morning briefing for today.' : 'Generate an evening recap for today.'

  let prompt = `${header}

FORMAT RULES (strict):
- Total length: MAX 15 lines. This is sent to Telegram — must be glanceable in 30 seconds.
- Use emoji headers (one per section), then 1-3 lines per section. No tables. No markdown headers.
- No explanations, no commentary, no "action needed" blocks. Just the data.
- If something is empty (0 unread, no levers), say so in 3 words max, don't elaborate.

Sections:`
  if (enabledItems.length > 0) {
    prompt += `\n${enabledItems.map((i) => `- ${fragments[i.id] || i.label}`).join('\n')}`
  }

  // Inject Life OS context if any life-os-related items are enabled
  if (hasLifeOs) {
    prompt += gatherLifeOsContext(type)
  }

  if (instructions.trim()) {
    prompt += `\n\nAdditional instructions: ${instructions.trim()}`
  }
  return prompt
}

function getItems(configKey: string, defaults: BriefingCheckItem[]): BriefingCheckItem[] {
  const raw = getConfig(configKey)
  if (!raw) return defaults
  try {
    return JSON.parse(raw)
  } catch {
    return defaults
  }
}

export function scheduleBriefings(): void {
  // Stop existing tasks
  for (const task of briefingTasks) task.stop()
  briefingTasks = []

  const chatId = getChatId()
  const enabled = getConfig('BRIEFING_ENABLED')
  if (!chatId || enabled === 'false') return

  const morningCron = getConfig('BRIEFING_MORNING_CRON') || '0 8 * * 1-5'
  const eveningCron = getConfig('BRIEFING_EVENING_CRON') || '0 18 * * 1-5'
  const tz = getConfig('SCHEDULE_TIMEZONE', 'Europe/Paris') || 'Europe/Paris'

  briefingTasks.push(
    cron.schedule(
      morningCron,
      () => {
        sendMorningBriefing().catch((err) => logger.error({ err }, 'Morning briefing failed'))
      },
      { timezone: tz },
    ),
    cron.schedule(
      eveningCron,
      () => {
        sendEveningRecap().catch((err) => logger.error({ err }, 'Evening recap failed'))
      },
      { timezone: tz },
    ),
  )

  logger.info({ morningCron, eveningCron, tz }, 'Proactive briefings scheduled')
}

function getChannel(): ChannelType {
  return (getConfig('BRIEFING_CHANNEL') || getConfig('DEFAULT_CHANNEL') || 'telegram') as ChannelType
}

function getChatId(): string {
  return getConfig('BRIEFING_CHAT_ID') || getConfig('DEFAULT_CHAT_ID') || ''
}

export async function sendMorningBriefing(): Promise<void> {
  const chatId = getChatId()
  if (!chatId) return

  const defaultItems: BriefingCheckItem[] = [
    { id: 'lifeos', label: 'Life OS snapshot', enabled: true },
    { id: 'levers', label: 'Daily levers', enabled: true },
    { id: 'goals', label: 'Active goals & projects', enabled: true },
    { id: 'calendar', label: 'Calendar events', enabled: true },
    { id: 'emails', label: 'Email digest', enabled: true },
    { id: 'motivation', label: 'Motivational nudge', enabled: true },
  ]

  const items = getItems('BRIEFING_MORNING_ITEMS', defaultItems)
  const instructions = getConfig('BRIEFING_MORNING_INSTRUCTIONS') || ''
  const prompt = buildPrompt('morning', items, instructions)

  const sessionId = await getOrCreateSession('daily-briefing')
  let response: string
  try {
    response = await waitForResponse(sessionId, prompt, { timeoutMs: 60_000 })
  } catch {
    response = 'Could not generate briefing.'
  }

  const manager = getChannelManager()
  await manager.send(getChannel(), chatId, { text: `Morning Briefing\n\n${response}` })
}

export async function sendEveningRecap(): Promise<void> {
  const chatId = getChatId()
  if (!chatId) return

  const defaultItems: BriefingCheckItem[] = [
    { id: 'lifeos', label: 'Life OS daily review', enabled: true },
    { id: 'levers', label: 'Lever completion', enabled: true },
    { id: 'goals', label: 'Goal progress', enabled: true },
    { id: 'journal', label: 'Journal check', enabled: true },
    { id: 'emails', label: 'Email update', enabled: true },
  ]

  const items = getItems('BRIEFING_EVENING_ITEMS', defaultItems)
  const instructions = getConfig('BRIEFING_EVENING_INSTRUCTIONS') || ''
  const prompt = buildPrompt('evening', items, instructions)

  const sessionId = await getOrCreateSession('daily-recap')
  let response: string
  try {
    response = await waitForResponse(sessionId, prompt, { timeoutMs: 60_000 })
  } catch {
    response = 'Could not generate recap.'
  }

  const manager = getChannelManager()
  await manager.send(getChannel(), chatId, { text: `Evening Recap\n\n${response}` })
}
