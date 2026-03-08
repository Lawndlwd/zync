import cron, { type ScheduledTask } from 'node-cron'
import { getOrCreateSession } from '../../opencode/client.js'
import { waitForResponse } from '../../opencode/wait-for-response.js'
import { insertLLMCall } from '../memory/activity.js'
import { getChannelManager } from '../../channels/manager.js'
import { logger } from '../../lib/logger.js'
import { getConfig } from '../../config/index.js'
import { loadPromptContent, interpolate } from '../../skills/prompts.js'
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

    const sessionId = await getOrCreateSession('chat')
    const systemPrompt = interpolate(loadPromptContent('scheduled-briefing'), {
      chatId: String(schedule.chat_id),
    })

    const text = await waitForResponse(sessionId, `${systemPrompt}\n\n---\n\n${schedule.prompt}`, { timeoutMs: 60_000 }) || 'No response generated.'

    insertLLMCall({
      source: 'schedule',
      model: 'opencode',
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      tool_names: [],
      duration_ms: Date.now() - startTime,
    })

    const manager = getChannelManager()
    const chunks = splitMessage(text)
    for (const chunk of chunks) {
      await manager.send('telegram', String(schedule.chat_id), { text: chunk })
    }
  } catch (err) {
    logger.error({ err, scheduleId: schedule.id }, 'Heartbeat: failed to execute schedule')
  }
}

function startCronTask(schedule: Schedule): void {
  if (activeTasks.has(schedule.id)) {
    activeTasks.get(schedule.id)!.stop()
  }

  const task = cron.schedule(schedule.cron_expression, () => {
    executeBriefing(schedule)
  }, { timezone: getConfig('SCHEDULE_TIMEZONE', 'Europe/Paris') || 'Europe/Paris' })

  activeTasks.set(schedule.id, task)
}

export function loadSchedules(): void {
  const schedules = getAllEnabledSchedules()
  for (const schedule of schedules) {
    try {
      startCronTask(schedule)
    } catch (err) {
      logger.error({ err, scheduleId: schedule.id }, 'Heartbeat: failed to start schedule')
    }
  }
  logger.info({ count: schedules.length }, 'Heartbeat: schedules loaded')
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
  logger.info('Heartbeat: all schedules stopped')
}
