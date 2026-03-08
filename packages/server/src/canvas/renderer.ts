import { WebSocketServer, type WebSocket } from 'ws'
import type { Server } from 'http'
import type { IncomingMessage } from 'http'
import { URL } from 'url'
import { logger } from '../lib/logger.js'
import { getConfig } from '../config/index.js'

interface CanvasUpdate {
  type: 'render' | 'update' | 'clear'
  html?: string
  css?: string
  js?: string
  data?: unknown
}

let wss: WebSocketServer | null = null
const clients = new Set<WebSocket>()

const ALLOWED_ORIGINS = new Set([
  ...(getConfig('CANVAS_ALLOWED_ORIGINS')?.split(',').map(s => s.trim()).filter(Boolean) || []),
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
])

function isConnectionAllowed(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  if (origin && !ALLOWED_ORIGINS.has(origin)) return false

  // Check for auth token in query string
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`)
    const token = url.searchParams.get('token')
    const expectedToken = getConfig('CANVAS_WS_TOKEN')
    // If a token is configured, require it
    if (expectedToken && token !== expectedToken) return false
  } catch {
    return false
  }

  return true
}

export function initCanvasWebSocket(server: Server): void {
  wss = new WebSocketServer({ server, path: '/ws/canvas' })

  wss.on('connection', (ws, req) => {
    if (!isConnectionAllowed(req)) {
      ws.close(4401, 'Unauthorized')
      return
    }

    clients.add(ws)
    logger.info('Canvas client connected')

    ws.on('close', () => {
      clients.delete(ws)
    })

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())
        logger.info({ msg }, 'Canvas interaction')
      } catch {}
    })
  })

  logger.info('Canvas WebSocket server initialized on /ws/canvas')
}

export function broadcastCanvas(update: CanvasUpdate): void {
  const msg = JSON.stringify(update)
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(msg)
    }
  }
}

export function renderCanvas(html: string, css?: string, js?: string): void {
  broadcastCanvas({ type: 'render', html, css, js })
}

export function updateCanvasData(data: unknown): void {
  broadcastCanvas({ type: 'update', data })
}

export function clearCanvas(): void {
  broadcastCanvas({ type: 'clear' })
}
