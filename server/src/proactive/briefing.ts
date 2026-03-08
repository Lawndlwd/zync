import cron from 'node-cron'
import { getOrCreateSession } from '../opencode/client.js'
import { waitForResponse } from '../opencode/wait-for-response.js'
import { getChannelManager } from '../channels/manager.js'
import { getConfig } from '../config/index.js'
import { logger } from '../lib/logger.js'
import type { ChannelType } from '../channels/types.js'
import { loadPromptContent } from '../skills/prompts.js'

let briefingTasks: cron.ScheduledTask[] = []

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
      currentValue += '\n' + line
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

function buildPrompt(type: 'morning' | 'evening', items: BriefingCheckItem[], instructions: string): string {
  const fragments = loadFragments(type)
  const enabledItems = items.filter(i => i.enabled)
  const header = type === 'morning'
    ? 'Generate a morning briefing for today.'
    : 'Generate an evening recap for today.'

  let prompt = header
  if (enabledItems.length > 0) {
    prompt += ' Include:\n' + enabledItems.map(i => `- ${fragments[i.id] || i.label}`).join('\n')
  }
  prompt += '\nKeep it concise but useful.'
  if (instructions.trim()) {
    prompt += `\n\nAdditional instructions: ${instructions.trim()}`
  }
  return prompt
}

function getItems(configKey: string, defaults: BriefingCheckItem[]): BriefingCheckItem[] {
  const raw = getConfig(configKey)
  if (!raw) return defaults
  try { return JSON.parse(raw) } catch { return defaults }
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
    cron.schedule(morningCron, () => {
      sendMorningBriefing().catch(err => logger.error({ err }, 'Morning briefing failed'))
    }, { timezone: tz }),
    cron.schedule(eveningCron, () => {
      sendEveningRecap().catch(err => logger.error({ err }, 'Evening recap failed'))
    }, { timezone: tz }),
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
    { id: 'jira', label: 'Jira issues', enabled: true },
    { id: 'todos', label: 'To-do items', enabled: true },
    { id: 'calendar', label: 'Calendar events', enabled: true },
    { id: 'emails', label: 'Email digest', enabled: true },
    { id: 'gtasks', label: 'Google Tasks', enabled: true },
    { id: 'motivation', label: 'Motivational message', enabled: true },
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
    { id: 'completed', label: 'Completed tasks', enabled: true },
    { id: 'messages', label: 'Messages handled', enabled: true },
    { id: 'pending', label: 'Pending items', enabled: true },
    { id: 'blockers', label: 'Blockers', enabled: true },
    { id: 'emails', label: 'Email update', enabled: true },
    { id: 'gtasks', label: 'Google Tasks', enabled: true },
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
