import { GripHorizontal, Loader2, Mic, X } from 'lucide-react'
import { memo, useEffect, useRef } from 'react'
import { MarkdownContent } from '@/components/ui/markdown'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Status helpers (shared with DynamicIsland)
// ---------------------------------------------------------------------------

export type StatusColor = 'red' | 'green' | 'indigo'

export function getStatusColor(state: string, isStreaming: boolean): StatusColor {
  if (state === 'recording') return 'red'
  if (state === 'responding' && isStreaming) return 'indigo'
  return 'green'
}

export const GLOW_COLORS: Record<StatusColor, string> = {
  red: '0 0 20px 4px rgba(239, 68, 68, 0.3)',
  green: '0 0 20px 4px rgba(34, 197, 94, 0.3)',
  indigo: '0 0 20px 4px rgba(99, 102, 241, 0.3)',
}

export const DOT_CLASSES: Record<StatusColor, string> = {
  red: 'bg-red-500',
  green: 'bg-green-500',
  indigo: 'bg-indigo-500',
}

// ---------------------------------------------------------------------------
// Waveform
// ---------------------------------------------------------------------------

const BAR_COUNT = 24
const BAR_GAP = 2

const Waveform = memo(function Waveform({ data }: { data: Uint8Array }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight

    canvas.width = w * dpr
    canvas.height = h * dpr

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    const barWidth = (w - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT
    const step = Math.max(1, Math.floor(data.length / BAR_COUNT))

    for (let i = 0; i < BAR_COUNT; i++) {
      const value = (data[i * step] ?? 0) / 255
      const barHeight = Math.max(2, value * h)
      const x = i * (barWidth + BAR_GAP)
      const y = (h - barHeight) / 2

      ctx.fillStyle = `rgba(129, 140, 248, ${0.4 + value * 0.6})`
      ctx.beginPath()
      ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2)
      ctx.fill()
    }
  }, [data])

  return <canvas ref={canvasRef} className="h-6 w-28" style={{ imageRendering: 'auto' }} />
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function BouncingDots() {
  return (
    <div className="flex items-center gap-1 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-indigo-400"
          style={{
            animation: 'diBounceDot 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ConversationContent
// ---------------------------------------------------------------------------

interface ConversationContentProps {
  state: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  frequencyData: Uint8Array
  elapsed: number
  isStreaming: boolean
  isListening: boolean
  onCancel: () => void
  onDismiss: () => void
  onFollowUp: () => void
  onDragStart: (e: React.PointerEvent) => void
}

export function ConversationContent({
  state,
  messages,
  frequencyData,
  elapsed,
  isStreaming,
  isListening,
  onCancel,
  onDismiss,
  onFollowUp,
  onDragStart,
}: ConversationContentProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const statusColor = getStatusColor(state, isStreaming)

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          {state === 'recording' ? (
            <span className="relative h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
              <span className="absolute inset-0 rounded-full bg-red-500" />
            </span>
          ) : (
            <span className={cn('h-2 w-2 rounded-full', DOT_CLASSES[statusColor])} />
          )}
          <span className="text-sm font-medium text-foreground">Jarvis</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            onPointerDown={onDragStart}
            className="text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing p-0.5 rounded-md hover:bg-accent transition-colors touch-none"
          >
            <GripHorizontal size={16} />
          </div>
          <button
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-md hover:bg-accent"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div
        ref={scrollRef}
        className="max-h-[50vh] overflow-y-auto px-4 py-3 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-muted-foreground/20"
      >
        {/* Recording indicator (first utterance) */}
        {state === 'recording' && messages.length === 0 && (
          <button onClick={onCancel} className="flex items-center gap-3 py-1 w-full cursor-pointer self-center">
            <Mic size={18} className="text-red-400 shrink-0" />
            <Waveform data={frequencyData} />
            <span className="text-xs text-muted-foreground font-mono tabular-nums tracking-wide">
              {formatElapsed(elapsed)}
            </span>
          </button>
        )}

        {/* Transcribing (first utterance) */}
        {state === 'transcribing' && messages.length === 0 && (
          <div className="flex items-center gap-2.5 py-1">
            <Loader2 size={16} className="animate-spin text-primary" />
            <span className="text-sm text-foreground/80">Processing...</span>
          </div>
        )}

        {/* Conversation messages */}
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex flex-col gap-1', msg.role === 'user' ? 'items-end' : 'items-start')}>
            {msg.role === 'user' ? (
              <div className="bg-primary/15 text-foreground text-sm px-3 py-1.5 rounded-2xl rounded-br-md max-w-[85%]">
                {msg.content}
              </div>
            ) : (
              <div className="text-sm text-foreground/90 max-w-[95%]">
                <MarkdownContent raw>{msg.content}</MarkdownContent>
                {isStreaming && i === messages.length - 1 && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-indigo-400 animate-pulse rounded-sm align-middle" />
                )}
              </div>
            )}
          </div>
        ))}

        {/* Waiting for first token */}
        {state === 'responding' && (messages.length === 0 || messages[messages.length - 1]?.role === 'user') && (
          <BouncingDots />
        )}

        {/* Transcribing follow-up */}
        {state === 'transcribing' && messages.length > 0 && (
          <div className="flex items-center gap-2 py-1">
            <Loader2 size={14} className="animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Processing...</span>
          </div>
        )}

        {/* Recording follow-up */}
        {state === 'recording' && messages.length > 0 && (
          <div className="flex items-center gap-2 py-1 self-end">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <Waveform data={frequencyData} />
            <span className="text-xs text-muted-foreground font-mono tabular-nums">{formatElapsed(elapsed)}</span>
          </div>
        )}
      </div>

      {/* Follow-up bar */}
      {!isStreaming && state === 'responding' && (
        <div className="flex items-center justify-center gap-2 px-4 py-2.5 border-t border-border">
          {isListening ? (
            <div className="flex items-center gap-2 text-xs text-primary px-3 py-1.5">
              <Mic size={14} className="animate-pulse" />
              <span>Listening...</span>
            </div>
          ) : (
            <button
              onClick={onFollowUp}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-full hover:bg-accent"
            >
              <Mic size={14} />
              <span>Speak again</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
