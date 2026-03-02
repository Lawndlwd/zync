import { Router } from 'express'
import { renderCanvas, clearCanvas } from '../canvas/renderer.js'
import { getDb } from '../bot/memory/db.js'
import { getOrCreateSession, sendPromptAsync, getSessionMessages, isSessionIdle } from '../opencode/client.js'
import { validate } from '../lib/validate.js'
import { CanvasRenderSchema, CanvasPromptSchema } from '../lib/schemas.js'

export const canvasRouter = Router()

let tableInitialized = false

function ensureTable(): void {
  if (tableInitialized) return
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS canvas_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'Untitled',
      html TEXT NOT NULL,
      css TEXT,
      js TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
  // Add title column if upgrading from old schema
  try {
    db.exec(`ALTER TABLE canvas_history ADD COLUMN title TEXT NOT NULL DEFAULT 'Untitled'`)
  } catch {
    // Column already exists
  }
  tableInitialized = true
}

// Debounce everything — broadcast + save. Only the last render within a 500ms window goes through.
let pendingRender: { html: string; css?: string; js?: string; title: string } | null = null
let renderTimer: ReturnType<typeof setTimeout> | null = null
// When a prompt is editing an existing canvas, store its ID so flushRender updates instead of inserts
let editingCanvasId: number | null = null

function flushRender(): void {
  if (!pendingRender) return
  const { html, css, js, title } = pendingRender
  pendingRender = null

  // Broadcast to WebSocket clients
  renderCanvas(html, css, js)

  // Save to DB
  ensureTable()
  const db = getDb()
  if (editingCanvasId) {
    db.prepare('UPDATE canvas_history SET title = ?, html = ?, css = ?, js = ? WHERE id = ?')
      .run(title, html, css || null, js || null, editingCanvasId)
    editingCanvasId = null
  } else {
    db.prepare('INSERT INTO canvas_history (title, html, css, js) VALUES (?, ?, ?, ?)').run(title, html, css || null, js || null)
  }
}

// POST /api/canvas/render — debounced broadcast + save
canvasRouter.post('/render', validate(CanvasRenderSchema), (req, res) => {
  try {
    const { html, css, js, title } = req.body

    // Queue the render — only the last one in a 500ms burst actually fires
    pendingRender = { html, css, js, title: title || 'Untitled' }
    if (renderTimer) clearTimeout(renderTimer)
    renderTimer = setTimeout(flushRender, 500)

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/canvas/clear
canvasRouter.post('/clear', (_req, res) => {
  try {
    clearCanvas()
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/canvas/history — list past canvas renders
canvasRouter.get('/history', (req, res) => {
  try {
    ensureTable()
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const db = getDb()
    const rows = db.prepare('SELECT id, title, created_at FROM canvas_history ORDER BY id DESC LIMIT ?').all(limit)
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/canvas/history/:id — get a specific canvas render
canvasRouter.get('/history/:id', (req, res) => {
  try {
    ensureTable()
    const db = getDb()
    const row = db.prepare('SELECT id, title, html, css, js, created_at FROM canvas_history WHERE id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Not found' })
    res.json(row)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/canvas/history/:id
canvasRouter.delete('/history/:id', (req, res) => {
  try {
    ensureTable()
    const db = getDb()
    db.prepare('DELETE FROM canvas_history WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/canvas/prompt — send a prompt to edit/create canvas content
canvasRouter.post('/prompt', validate(CanvasPromptSchema), async (req, res) => {
  try {
    const { prompt, canvasId } = req.body

    ensureTable()
    const db = getDb()

    // Build context with current canvas content if editing
    let canvasContext = ''
    if (canvasId) {
      const row = db.prepare('SELECT title, html, css, js FROM canvas_history WHERE id = ?').get(canvasId) as any
      if (row) {
        canvasContext = `You are EDITING an existing canvas titled "${row.title}".

CURRENT HTML:
${row.html}

${row.css ? `CURRENT CSS:\n${row.css}\n` : ''}
${row.js ? `CURRENT JS:\n${row.js}\n` : ''}

Modify the above based on the user's request. Keep the same title unless the change warrants a new one.`
      }
    }

    // If editing, store the canvas ID so the render endpoint updates instead of creating new
    editingCanvasId = canvasId ? Number(canvasId) : null

    const instruction = `CRITICAL: You MUST call the zync_render_canvas tool. Do NOT just reply with text. Your ONLY job is to call that tool with title, html, and optionally css and js.

A base dark design system is already injected into the canvas (dark background #09090b, zinc text colors, .card, .grid-2/.grid-3/.grid-4, .badge, .badge-blue/.badge-green/.badge-red/.badge-yellow/.badge-purple, table/thead/tbody auto-styled, .stat+.stat-value+.stat-label, .progress+.progress-bar, h1/h2/h3/p/small pre-styled).

Write clean semantic HTML using these classes. Do NOT add background colors or font-family — it's handled.
For charts: use Chart.js via <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>.
For complex interactive apps: write full HTML+CSS+JS. Body padding is 1.5rem by default — override with css param if you need edge-to-edge.

${canvasContext}

USER REQUEST:
${prompt}`

    // Use a fresh session each time to avoid stale context
    const sessionKey = `canvas-${Date.now()}`
    const sessionId = await getOrCreateSession(sessionKey)
    const msgsBefore = await getSessionMessages(sessionId)

    await sendPromptAsync(sessionId, instruction)

    // Poll for completion
    const deadline = Date.now() + 120_000
    let pollMs = 500
    let checks = 0
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, pollMs))
      checks++
      if (checks > 5) pollMs = 1500

      const idle = await isSessionIdle(sessionId)
      if (!idle) continue

      const msgs = await getSessionMessages(sessionId)
      if (msgs.length <= msgsBefore.length) continue

      const newMsgs = msgs.slice(msgsBefore.length)
      const last = [...newMsgs].reverse().find((m: any) => m.role === 'assistant' || m.info?.role === 'assistant')
      if (last?.parts) {
        const texts = last.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text)
        const reply = texts.join('').trim()
        if (reply.length > 0) {
          return res.json({ success: true, reply })
        }
      }
    }

    res.json({ success: true, reply: 'Timed out waiting for canvas render.' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
