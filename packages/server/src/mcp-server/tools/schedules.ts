import { z } from 'zod'
import cron from 'node-cron'
import { listSchedules as dbListSchedules } from '../../bot/heartbeat/db.js'
import {
  addSchedule,
  removeSchedule,
  toggleSchedule,
} from '../../bot/heartbeat/scheduler.js'

export const createScheduleSchema = z.object({
  cron_expression: z
    .string()
    .describe(
      'Cron expression (e.g. "0 8 * * *" for daily at 8am, "*/5 * * * *" for every 5 min)'
    ),
  prompt: z.string().describe('The prompt/task to execute on each trigger'),
  chat_id: z.number().describe('Telegram chat ID to send results to'),
})

export async function createScheduleHandler(input: z.infer<typeof createScheduleSchema>) {
  if (!cron.validate(input.cron_expression)) {
    return `Invalid cron expression: "${input.cron_expression}". Use standard 5-field cron format.`
  }
  const schedule = addSchedule(input.chat_id, input.cron_expression, input.prompt)
  return `Schedule #${schedule.id} created. Cron: "${input.cron_expression}", Prompt: "${input.prompt}". Timezone: Europe/Paris.`
}

export const listSchedulesSchema = z.object({
  chat_id: z.number().describe('Telegram chat ID'),
})

export async function listSchedulesHandler(input: z.infer<typeof listSchedulesSchema>) {
  const schedules = dbListSchedules(input.chat_id)
  if (schedules.length === 0) return 'No schedules found.'
  return schedules
    .map(
      (s) =>
        `#${s.id} | ${s.enabled ? 'ON' : 'OFF'} | ${s.cron_expression} | ${s.prompt} | created ${s.created_at}`
    )
    .join('\n')
}

export const deleteScheduleSchema = z.object({
  id: z.number().describe('Schedule ID to delete'),
  chat_id: z.number().describe('Telegram chat ID (for ownership check)'),
})

export async function deleteScheduleHandler(input: z.infer<typeof deleteScheduleSchema>) {
  const removed = removeSchedule(input.id, input.chat_id)
  return removed
    ? `Schedule #${input.id} deleted.`
    : `Schedule #${input.id} not found or not yours.`
}

export const toggleScheduleSchema = z.object({
  id: z.number().describe('Schedule ID'),
  chat_id: z.number().describe('Telegram chat ID (for ownership check)'),
  enabled: z.boolean().describe('true to enable, false to disable'),
})

export async function toggleScheduleHandler(input: z.infer<typeof toggleScheduleSchema>) {
  const success = toggleSchedule(input.id, input.chat_id, input.enabled)
  if (!success) return `Schedule #${input.id} not found or not yours.`
  return `Schedule #${input.id} ${input.enabled ? 'enabled' : 'disabled'}.`
}
