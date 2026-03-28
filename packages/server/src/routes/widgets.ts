import { Router } from 'express'
import { logger } from '../lib/logger.js'
import {
  createWidget,
  deleteWidget,
  getWidget,
  getWidgets,
  updateWidgetCache,
  updateWidgetSettings,
} from '../widgets/db.js'
import { fetchFinanceTips } from '../widgets/fetchers/finance.js'
import { fetchLeagueScores, LEAGUES, searchTeams } from '../widgets/fetchers/football.js'
import { fetchNews } from '../widgets/fetchers/news.js'
import { fetchWeather } from '../widgets/fetchers/weather.js'
import type { WidgetType } from '../widgets/types.js'

export const widgetsRouter = Router()

// List all widgets
widgetsRouter.get('/', (_req, res) => {
  try {
    res.json(getWidgets())
  } catch (err) {
    logger.error({ err }, 'Failed to list widgets')
    res.status(500).json({ error: 'Failed to list widgets' })
  }
})

// Add a widget
widgetsRouter.post('/', (req, res) => {
  try {
    const { type, settings } = req.body as { type: WidgetType; settings: Record<string, any> }
    if (!type || !settings) return res.status(400).json({ error: 'type and settings required' })
    const widget = createWidget(type, settings)
    res.json(widget)
  } catch (err) {
    logger.error({ err }, 'Failed to create widget')
    res.status(500).json({ error: 'Failed to create widget' })
  }
})

// Update widget settings
widgetsRouter.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    const { settings } = req.body
    if (!settings) return res.status(400).json({ error: 'settings required' })
    updateWidgetSettings(id, settings)
    updateWidgetCache(id, null)
    res.json(getWidget(id))
  } catch (err) {
    logger.error({ err }, 'Failed to update widget')
    res.status(500).json({ error: 'Failed to update widget' })
  }
})

// Delete a widget
widgetsRouter.delete('/:id', (req, res) => {
  try {
    deleteWidget(parseInt(req.params.id, 10))
    res.json({ ok: true })
  } catch (err) {
    logger.error({ err }, 'Failed to delete widget')
    res.status(500).json({ error: 'Failed to delete widget' })
  }
})

// Refresh a single widget's data
widgetsRouter.post('/:id/refresh', async (req, res) => {
  try {
    const widget = getWidget(parseInt(req.params.id, 10))
    if (!widget) return res.status(404).json({ error: 'Widget not found' })
    const data = await refreshWidget(widget.type, widget.settings)
    updateWidgetCache(widget.id, data)
    res.json({ ...widget, cached_data: data, last_refreshed: new Date().toISOString() })
  } catch (err) {
    logger.error({ err }, 'Failed to refresh widget')
    res.status(500).json({ error: 'Failed to refresh widget' })
  }
})

// Refresh all widgets
widgetsRouter.post('/refresh-all', async (_req, res) => {
  try {
    const widgets = getWidgets()
    const results = await Promise.allSettled(
      widgets.map(async (w) => {
        const data = await refreshWidget(w.type, w.settings)
        updateWidgetCache(w.id, data)
        return { id: w.id, status: 'ok' }
      }),
    )
    res.json({ refreshed: results.length })
  } catch (err) {
    logger.error({ err }, 'Failed to refresh all widgets')
    res.status(500).json({ error: 'Failed to refresh widgets' })
  }
})

// List available football leagues
widgetsRouter.get('/football/leagues', (_req, res) => {
  res.json(LEAGUES)
})

// Search football teams within a league
widgetsRouter.get('/football/search', async (req, res) => {
  try {
    const q = (req.query.q as string) || ''
    const league = (req.query.league as string) || 'eng.1'
    if (!q) return res.json([])
    const teams = await searchTeams(q, league)
    res.json(teams)
  } catch (err) {
    logger.error({ err }, 'Failed to search teams')
    res.status(500).json({ error: 'Failed to search teams' })
  }
})

export async function refreshWidget(type: string, settings: Record<string, any>): Promise<any> {
  switch (type) {
    case 'weather':
      return fetchWeather(settings.city || 'Paris')
    case 'football':
      return fetchLeagueScores(settings.league || 'eng.1')
    case 'news':
      return fetchNews(settings.topics || ['technology', 'world'])
    case 'finance':
      return fetchFinanceTips(settings.focus || ['savings', 'investing'])
    default:
      throw new Error(`Unknown widget type: ${type}`)
  }
}
