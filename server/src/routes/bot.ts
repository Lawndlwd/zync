import { Router } from 'express'
import { searchMemory, saveMemory, deleteMemory, listAllMemories, getMemoryCount } from '../bot/memory/index.js'
import { getAllSchedules } from '../bot/heartbeat/db.js'
import { addSchedule, adminRemoveSchedule, adminToggleSchedule } from '../bot/heartbeat/scheduler.js'
import { getOrCreateSession, sendPromptAsync, getSessionMessages } from '../opencode/client.js'

export const botRouter = Router()

// GET /api/bot/status
botRouter.get('/status', async (_req, res) => {
  try {
    const memoryCount = getMemoryCount()
    const schedules = getAllSchedules()
    const activeSchedules = schedules.filter((s: any) => s.enabled === 1).length

    res.json({
      memoryCount,
      toolCount: 12,
      activeSchedules,
      totalSchedules: schedules.length,
      modelName: 'opencode',
      providerName: 'OpenCode',
      isLocal: false,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/bot/memories?q=&limit=50
botRouter.get('/memories', (req, res) => {
  try {
    const query = req.query.q as string | undefined
    const limit = parseInt(req.query.limit as string) || 50

    if (query && query.trim()) {
      const results = searchMemory(query.trim(), limit)
      res.json(results)
    } else {
      const results = listAllMemories(limit)
      res.json(results)
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/bot/memories
botRouter.post('/memories', (req, res) => {
  try {
    const { content, category } = req.body
    if (!content) {
      return res.status(400).json({ error: 'content is required' })
    }
    const result = saveMemory(content, category || 'general')
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/bot/memories/:id
botRouter.delete('/memories/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const success = deleteMemory(id)
    res.json({ success })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/bot/schedules
botRouter.get('/schedules', (_req, res) => {
  try {
    const schedules = getAllSchedules()
    res.json(schedules)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/bot/schedules
botRouter.post('/schedules', (req, res) => {
  try {
    const { cron_expression, prompt, chat_id } = req.body
    if (!cron_expression || !prompt || !chat_id) {
      return res.status(400).json({ error: 'cron_expression, prompt, and chat_id are required' })
    }
    const schedule = addSchedule(Number(chat_id), cron_expression, prompt)
    res.json(schedule)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/bot/schedules/:id
botRouter.delete('/schedules/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const success = adminRemoveSchedule(id)
    res.json({ success })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/bot/schedules/:id
botRouter.patch('/schedules/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { enabled } = req.body
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled (boolean) is required' })
    }
    const success = adminToggleSchedule(id, enabled)
    res.json({ success })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/bot/tools
botRouter.get('/tools', async (_req, res) => {
  const mcpTools = [
    'get_my_jira_issues', 'transition_jira_issue', 'summarize_sprint',
    'create_todo', 'mark_todo_done',
    'save_memory', 'search_memory', 'delete_memory',
    'create_schedule', 'list_schedules', 'delete_schedule', 'toggle_schedule',
  ]
  res.json(mcpTools.map(name => ({ name, description: '' })))
})

// POST /api/bot/chat
botRouter.post('/chat', async (req, res) => {
  try {
    const { message } = req.body
    if (!message) {
      return res.status(400).json({ error: 'message is required' })
    }
    const sessionId = await getOrCreateSession('bot-web')
    await sendPromptAsync(sessionId, message)

    // Poll for reply
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500))
      const msgs = await getSessionMessages(sessionId)
      const last = [...msgs].reverse().find((m: any) => m.info?.role === 'assistant')
      if (last?.parts) {
        const texts = last.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text)
        if (texts.length > 0 && texts.some((t: string) => t.length > 0)) {
          return res.json({ response: texts.join('') })
        }
      }
    }
    res.status(504).json({ error: 'Timeout waiting for response' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
