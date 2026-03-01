import { z } from 'zod'
import { renderCanvas, clearCanvas } from '../../canvas/renderer.js'

export const renderCanvasSchema = z.object({
  html: z.string().describe('HTML content to render in the canvas'),
  css: z.string().optional().describe('CSS styles for the canvas'),
  js: z.string().optional().describe('JavaScript to execute in the canvas (sandboxed)'),
})

export const clearCanvasSchema = z.object({})

export async function renderCanvasTool(args: z.infer<typeof renderCanvasSchema>): Promise<string> {
  renderCanvas(args.html, args.css, args.js)
  return 'Canvas rendered successfully'
}

export async function clearCanvasTool(): Promise<string> {
  clearCanvas()
  return 'Canvas cleared'
}
