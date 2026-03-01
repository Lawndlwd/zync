import cron, { type ScheduledTask } from 'node-cron'
import { getOrCreateSession, sendPromptAsync, getSessionMessages } from '../../opencode/client.js'
import { insertLLMCall } from '../memory/activity.js'
import { getBotInstance } from '../bot.js'
import {
  addSchedule as dbAddSchedule,
  removeSchedule as dbRemoveSchedule,
  getAllEnabledSchedules,
  toggleSchedule as dbToggleSchedule,
  adminRemoveSchedule as dbAdminRemoveSchedule,
  adminToggleSchedule as dbAdminToggleSchedule,
  type Schedule,
} from './db.js'

const TELEGRAM_MAX_LENGTH = 4096
const activeTasks = new Map<number, ScheduledTask>()

function splitMessage(text: string): string[] {
  if (text.length <= TELEGRAM_MAX_LENGTH) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, TELEGRAM_MAX_LENGTH))
    remaining = remaining.slice(TELEGRAM_MAX_LENGTH)
  }
  return chunks
}

async function executeBriefing(schedule: Schedule): Promise<void> {
  try {
    const startTime = Date.now()

    const sessionId = await getOrCreateSession(`schedule-${schedule.chat_id}`)
    const systemPrompt = `You are a personal AI assistant, running a scheduled briefing. The user set this up to receive proactive updates. Execute the task thoroughly using your tools. Be concise but complete.\n\nCurrent Telegram chat_id: ${schedule.chat_id}`

    await sendPromptAsync(sessionId, `${systemPrompt}\n\n---\n\n${schedule.prompt}`)

    // Poll for reply
    let text = 'No response generated.'
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500))
      const msgs = await getSessionMessages(sessionId)
      const last = [...msgs].reverse().find((m: any) => m.info?.role === 'assistant')
      if (last?.parts) {
        const texts = last.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text)
        if (texts.length > 0 && texts.some((t: string) => t.length > 0)) {
          text = texts.join('')
          break
        }
      }
    }

    insertLLMCall({
      source: 'schedule',
      model: 'opencode',
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      tool_names: [],
      duration_ms: Date.now() - startTime,
    })

    const bot = getBotInstance()
    const chunks = splitMessage(text)
    for (const chunk of chunks) {
      await bot.api.sendMessage(schedule.chat_id, chunk)
    }
  } catch (err) {
    console.error(`Heartbeat: failed to execute schedule #${schedule.id}:`, err)
  }
}

function startCronTask(schedule: Schedule): void {
  if (activeTasks.has(schedule.id)) {
    activeTasks.get(schedule.id)!.stop()
  }

  const task = cron.schedule(schedule.cron_expression, () => {
    executeBriefing(schedule)
  }, { timezone: 'Europe/Paris' })

  activeTasks.set(schedule.id, task)
}

export function loadSchedules(): void {
  const schedules = getAllEnabledSchedules()
  for (const schedule of schedules) {
    try {
      startCronTask(schedule)
    } catch (err) {
      console.error(`Heartbeat: failed to start schedule #${schedule.id}:`, err)
    }
  }
  console.log(`Heartbeat: loaded ${schedules.length} schedule(s)`)
}

export function addSchedule(chatId: number, cronExpression: string, prompt: string): Schedule {
  const schedule = dbAddSchedule(chatId, cronExpression, prompt)
  startCronTask(schedule)
  return schedule
}

export function removeSchedule(id: number, chatId: number): boolean {
  const task = activeTasks.get(id)
  if (task) {
    task.stop()
    activeTasks.delete(id)
  }
  return dbRemoveSchedule(id, chatId)
}

export function toggleSchedule(id: number, chatId: number, enabled: boolean): boolean {
  const success = dbToggleSchedule(id, chatId, enabled)
  if (success) {
    const task = activeTasks.get(id)
    if (enabled && !task) {
      const schedules = getAllEnabledSchedules()
      const schedule = schedules.find(s => s.id === id)
      if (schedule) startCronTask(schedule)
    } else if (!enabled && task) {
      task.stop()
      activeTasks.delete(id)
    }
  }
  return success
}

export function adminRemoveSchedule(id: number): boolean {
  const task = activeTasks.get(id)
  if (task) {
    task.stop()
    activeTasks.delete(id)
  }
  return dbAdminRemoveSchedule(id)
}

export function adminToggleSchedule(id: number, enabled: boolean): boolean {
  const success = dbAdminToggleSchedule(id, enabled)
  if (success) {
    const task = activeTasks.get(id)
    if (enabled && !task) {
      const schedules = getAllEnabledSchedules()
      const schedule = schedules.find(s => s.id === id)
      if (schedule) startCronTask(schedule)
    } else if (!enabled && task) {
      task.stop()
      activeTasks.delete(id)
    }
  }
  return success
}

export function stopAllSchedules(): void {
  for (const [id, task] of activeTasks) {
    task.stop()
    activeTasks.delete(id)
  }
  console.log('Heartbeat: all schedules stopped')
}
