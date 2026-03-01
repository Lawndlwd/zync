import { useEffect, useRef, useState } from 'react'

interface CanvasUpdate {
  type: 'render' | 'update' | 'clear'
  html?: string
  css?: string
  js?: string
  data?: unknown
}

export function LiveCanvas() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname}:3001/ws/canvas`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)

    ws.onmessage = (event) => {
      const update: CanvasUpdate = JSON.parse(event.data)

      if (update.type === 'render' && iframeRef.current) {
        const doc = `<!DOCTYPE html>
<html>
<head><style>${update.css || ''}</style></head>
<body>${update.html || ''}
<script>${update.js || ''}<\/script>
</body>
</html>`
        iframeRef.current.srcdoc = doc
      } else if (update.type === 'clear' && iframeRef.current) {
        iframeRef.current.srcdoc = ''
      }
    }

    return () => ws.close()
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-2 border-b">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm text-muted-foreground">
          Live Canvas {connected ? 'connected' : 'disconnected'}
        </span>
      </div>
      <iframe
        ref={iframeRef}
        className="flex-1 w-full border-0"
        sandbox="allow-scripts"
        title="AI Canvas"
      />
    </div>
  )
}
