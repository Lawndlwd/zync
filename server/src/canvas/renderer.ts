import { WebSocketServer, type WebSocket } from 'ws'
import type { Server } from 'http'

interface CanvasUpdate {
  type: 'render' | 'update' | 'clear'
  html?: string
  css?: string
  js?: string
  data?: unknown
}

let wss: WebSocketServer | null = null
const clients = new Set<WebSocket>()

export function initCanvasWebSocket(server: Server): void {
  wss = new WebSocketServer({ server, path: '/ws/canvas' })

  wss.on('connection', (ws) => {
    clients.add(ws)
    console.log('Canvas client connected')

    ws.on('close', () => {
      clients.delete(ws)
    })

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())
        console.log('Canvas interaction:', msg)
      } catch {}
    })
  })

  console.log('Canvas WebSocket server initialized on /ws/canvas')
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
