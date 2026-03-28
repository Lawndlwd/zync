import { Loader2, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface CanvasUpdate {
  type: 'render' | 'update' | 'clear'
  html?: string
  css?: string
  js?: string
}

interface HistoryEntry {
  id: number
  title: string
  created_at: string
}

interface HistoryDetail {
  id: number
  title: string
  html: string
  css: string | null
  js: string | null
  created_at: string
}

const BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  background: #09090b; color: #e4e4e7; padding: 1.5rem; line-height: 1.6; min-height: 100vh;
}
h1 { font-size: 1.75rem; font-weight: 700; color: #fafafa; margin-bottom: 0.75rem; }
h2 { font-size: 1.25rem; font-weight: 600; color: #e4e4e7; margin-bottom: 0.5rem; margin-top: 1.25rem; }
h3 { font-size: 1rem; font-weight: 600; color: #a1a1aa; margin-bottom: 0.5rem; margin-top: 1rem; }
p { color: #a1a1aa; margin-bottom: 0.5rem; }
small { color: #71717a; font-size: 0.75rem; }
a { color: #60a5fa; text-decoration: none; }
a:hover { text-decoration: underline; }
code { background: rgba(255,255,255,0.06); padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.875em; }
.card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; }
.card-header { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; margin-bottom: 0.75rem; }
.grid { display: grid; gap: 1rem; }
.grid-2 { grid-template-columns: repeat(2, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-4 { grid-template-columns: repeat(4, 1fr); }
@media (max-width: 640px) { .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; } }
.flex { display: flex; } .flex-col { flex-direction: column; }
.gap-1 { gap: 0.25rem; } .gap-2 { gap: 0.5rem; } .gap-3 { gap: 0.75rem; } .gap-4 { gap: 1rem; }
.items-center { align-items: center; } .justify-between { justify-content: space-between; }
table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
thead th { text-align: left; padding: 0.625rem 0.75rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; border-bottom: 1px solid rgba(255,255,255,0.06); }
tbody td { padding: 0.625rem 0.75rem; color: #d4d4d8; border-bottom: 1px solid rgba(255,255,255,0.03); }
tbody tr:hover { background: rgba(255,255,255,0.02); }
.badge { display: inline-flex; align-items: center; padding: 0.125rem 0.5rem; font-size: 0.75rem; font-weight: 500; border-radius: 9999px; background: rgba(255,255,255,0.06); color: #a1a1aa; }
.badge-blue { background: rgba(96,165,250,0.15); color: #60a5fa; }
.badge-green { background: rgba(74,222,128,0.15); color: #4ade80; }
.badge-yellow { background: rgba(250,204,21,0.15); color: #facc15; }
.badge-red { background: rgba(248,113,113,0.15); color: #f87171; }
.badge-purple { background: rgba(167,139,250,0.15); color: #a78bfa; }
.stat { text-align: center; }
.stat-value { font-size: 2rem; font-weight: 700; color: #fafafa; line-height: 1; }
.stat-label { font-size: 0.75rem; color: #71717a; margin-top: 0.25rem; }
.progress { height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; }
.progress-bar { height: 100%; border-radius: 3px; background: #60a5fa; transition: width 0.3s; }
ul, ol { padding-left: 1.25rem; color: #a1a1aa; } li { margin-bottom: 0.25rem; } li::marker { color: #52525b; }
.chart-container { position: relative; width: 100%; max-height: 400px; } canvas { max-width: 100%; }
::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.animate-in { animation: fadeIn 0.3s ease-out; }
`

function buildDoc(html: string, css?: string | null, js?: string | null): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${BASE_CSS}</style>
<style>${css || ''}</style>
</head>
<body class="animate-in">${html || ''}
<script>${js || ''}</script>
</body>
</html>`
}

export function LiveCanvas() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [connected, setConnected] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'edit' | 'new'>('edit')

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/canvas/history?limit=50')
      if (res.ok) {
        const items = await res.json()
        setHistory(items)
        return items as HistoryEntry[]
      }
    } catch {}
    return []
  }, [])

  // Load history and show latest on mount (run once)
  const mountedRef = useRef(false)
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    loadHistory().then(async (items) => {
      if (items.length > 0 && iframeRef.current) {
        setSelectedId(String(items[0].id))
        const res = await fetch(`/api/canvas/history/${items[0].id}`)
        if (res.ok) {
          const item: HistoryDetail = await res.json()
          iframeRef.current.srcdoc = buildDoc(item.html, item.css, item.js)
        }
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // WebSocket
  useEffect(() => {
    const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const wsUrl = `${wsProto}://${window.location.host}/ws/canvas`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)

    ws.onmessage = (event) => {
      const update: CanvasUpdate = JSON.parse(event.data)
      if (update.type === 'render' && iframeRef.current) {
        iframeRef.current.srcdoc = buildDoc(update.html || '', update.css, update.js)
        setMode('edit')
        // Do NOT reload history here — it causes render loops.
        // History reloads after prompt completes.
      } else if (update.type === 'clear' && iframeRef.current) {
        iframeRef.current.srcdoc = ''
        setSelectedId('live')
      }
    }

    return () => ws.close()
  }, [])

  const handleSelect = async (value: string) => {
    setSelectedId(value)
    const res = await fetch(`/api/canvas/history/${value}`)
    if (res.ok) {
      const item: HistoryDetail = await res.json()
      if (iframeRef.current) iframeRef.current.srcdoc = buildDoc(item.html, item.css, item.js)
    }
  }

  const handleDelete = async () => {
    if (!selectedId) return
    await fetch(`/api/canvas/history/${selectedId}`, { method: 'DELETE' })
    const items = await loadHistory()
    if (items.length > 0) {
      handleSelect(String(items[0].id))
    } else {
      setSelectedId('')
      if (iframeRef.current) iframeRef.current.srcdoc = ''
    }
  }

  const handlePrompt = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)

    try {
      // In edit mode, pass the current canvas ID so the AI gets its content as context
      const canvasId = mode === 'edit' && selectedId ? Number(selectedId) : undefined

      await fetch('/api/canvas/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), canvasId }),
      })
      setPrompt('')
      // Reload history after prompt completes (render already saved by backend)
      const items = await loadHistory()
      // For new canvases, select the latest one that was just created
      if (mode === 'new' && items.length > 0) {
        setSelectedId(String(items[0].id))
        setMode('edit')
      }
    } catch (err) {
      console.error('Canvas prompt failed:', err)
    } finally {
      setLoading(false)
    }
  }

  // Auto-switch to edit mode when a canvas is displayed
  const hasCanvas = history.length > 0

  const formatTime = (dateStr: string) => {
    const d = new Date(`${dateStr}Z`)
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary">
        <div className="flex items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => handleSelect(e.target.value)}
            className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground min-w-[240px] outline-none focus:border-ring transition-colors cursor-pointer appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 10px center',
            }}
          >
            {history.length === 0 && (
              <option value="" className="bg-background text-muted-foreground">
                No canvases yet
              </option>
            )}
            {history.map((entry) => (
              <option key={entry.id} value={String(entry.id)} className="bg-background text-foreground">
                {entry.title} — {formatTime(entry.created_at)}
              </option>
            ))}
          </select>

          {selectedId && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className="text-[11px] text-muted-foreground">{connected ? 'Live' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Canvas iframe */}
      <iframe
        ref={iframeRef}
        className="flex-1 w-full border-0 bg-[#09090b]"
        sandbox="allow-scripts"
        title="AI Canvas"
      />

      {/* Prompt input */}
      <div className="border-t border-border bg-secondary px-3 py-2.5">
        {/* Mode toggle */}
        <div className="flex items-center gap-1 mb-2">
          <button
            onClick={() => setMode('new')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors ${
              mode === 'new'
                ? 'bg-blue-600/15 text-blue-400'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <Plus size={13} />
            New
          </button>
          <button
            onClick={() => setMode('edit')}
            disabled={!hasCanvas}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors ${
              mode === 'edit'
                ? 'bg-amber-500/15 text-amber-400'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-default'
            }`}
          >
            <Pencil size={12} />
            Edit current
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handlePrompt()
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              mode === 'new'
                ? 'Create a dashboard showing my Jira sprint progress...'
                : 'Change the chart colors to blue, add a footer...'
            }
            disabled={loading}
            className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-ring transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || loading}
            className={`flex items-center justify-center w-9 h-9 rounded-lg text-white disabled:opacity-30 disabled:cursor-default transition-colors ${
              mode === 'new' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-amber-600 hover:bg-amber-500'
            }`}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
        {loading && (
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {mode === 'new' ? 'Creating canvas...' : 'Updating canvas...'}
          </p>
        )}
      </div>
    </div>
  )
}
