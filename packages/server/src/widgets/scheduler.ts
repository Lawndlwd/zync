import * as cron from 'node-cron'
import { getWidgets, updateWidgetCache } from './db.js'
import { refreshWidget } from '../routes/widgets.js'
import { getConfig } from '../config/index.js'
import { logger } from '../lib/logger.js'

let task: cron.ScheduledTask | null = null

export function scheduleWidgetRefresh(): void {
  stopWidgetRefresh()
  const cronExpr = getConfig('WIDGET_REFRESH_CRON') || '0 8,20 * * *'
  const tz = getConfig('SCHEDULE_TIMEZONE', 'Europe/Paris') || 'Europe/Paris'

  task = cron.schedule(cronExpr, () => {
    runWidgetRefresh().catch(err => logger.error({ err }, 'Scheduled widget refresh failed'))
  }, { timezone: tz })

  logger.info({ cronExpr, tz }, 'Widget refresh scheduled')
}

export function stopWidgetRefresh(): void {
  if (task) {
    task.stop()
    task = null
  }
}

async function runWidgetRefresh(): Promise<void> {
  const widgets = getWidgets()
  const llmWidgets = widgets.filter(w => w.type === 'news' || w.type === 'finance')
  if (llmWidgets.length === 0) return

  logger.info({ count: llmWidgets.length }, 'Refreshing LLM widgets')

  for (const w of llmWidgets) {
    try {
      const data = await refreshWidget(w.type, w.settings)
      updateWidgetCache(w.id, data)
      logger.info({ widgetId: w.id, type: w.type }, 'Widget refreshed')
    } catch (err) {
      logger.error({ err, widgetId: w.id }, 'Widget refresh failed')
    }
  }
}
