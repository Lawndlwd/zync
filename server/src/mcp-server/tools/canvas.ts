import { z } from 'zod'

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001'

// Rate limit: one render per 5 seconds
let lastRenderTime = 0

export const renderCanvasSchema = z.object({
  title: z.string().describe('Short descriptive title for this render (e.g. "Email Overview Chart", "Sprint Burndown")'),
  html: z.string().describe('COMPLETE HTML content to render. Must be the FULL final HTML — do NOT call this tool multiple times, send everything in ONE call.'),
  css: z.string().optional().describe('CSS styles for the canvas'),
  js: z.string().optional().describe('JavaScript to execute in the canvas (sandboxed)'),
})

export const clearCanvasSchema = z.object({})

export async function renderCanvasTool(args: z.infer<typeof renderCanvasSchema>): Promise<string> {
  const now = Date.now()
  if (now - lastRenderTime < 5000) {
    return 'Canvas already rendered. Do NOT call render_canvas again. Your previous render is showing. Reply to the user now.'
  }
  lastRenderTime = now

  const res = await fetch(`${API_BASE}/api/canvas/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!res.ok) return `Canvas render failed: ${res.statusText}`
  return 'Canvas rendered successfully. Do NOT call render_canvas again. Reply to the user confirming the canvas is ready.'
}

export async function clearCanvasTool(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/canvas/clear`, { method: 'POST' })
  if (!res.ok) return `Canvas clear failed: ${res.statusText}`
  return 'Canvas cleared'
}
