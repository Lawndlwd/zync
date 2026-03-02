import { useRef, useEffect, memo } from 'react'
import { createPortal } from 'react-dom'
import { Mic, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarkdownContent } from '@/components/ui/markdown'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VoiceState = 'hidden' | 'recording' | 'transcribing' | 'responding'

export interface VoiceMessage {
  role: 'user' | 'assistant'
  content: string
}

interface VoicePillProps {
  state: VoiceState
  frequencyData: Uint8Array
  elapsed: number
  messages: VoiceMessage[]
  isStreaming?: boolean
  isListening?: boolean
  onCancel: () => void
  onDismiss: () => void
  onFollowUp: () => void
}

// ---------------------------------------------------------------------------
// Waveform (internal canvas component)
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

  return (
    <canvas
      ref={canvasRef}
      className="h-6 w-28"
      style={{ imageRendering: 'auto' }}
    />
  )
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Bouncing dots loading indicator
// ---------------------------------------------------------------------------

function BouncingDots() {
  return (
    <div className="flex items-center gap-1 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-indigo-400"
          style={{
            animation: 'voicePillBounce 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes voicePillBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// VoicePill
// ---------------------------------------------------------------------------

export function VoicePill({
  state,
  frequencyData,
  elapsed,
  messages,
  isStreaming,
  isListening,
  onCancel,
  onDismiss,
  onFollowUp,
}: VoicePillProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  if (state === 'hidden') return null

  const isExpanded = state === 'responding' || (state === 'transcribing' && messages.length > 0) || (state === 'recording' && messages.length > 0)

  return createPortal(
    <div
      className={cn(
        'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100]',
        'transition-all duration-500 ease-out',
        isExpanded
          ? 'rounded-2xl w-[400px] border border-white/8 bg-black/60 backdrop-blur-2xl shadow-2xl shadow-black/40'
          : 'rounded-full border border-white/8 bg-black/60 backdrop-blur-2xl shadow-2xl shadow-black/40'
      )}
    >
      {/* ---- Recording state (no prior messages) ---- */}
      {state === 'recording' && messages.length === 0 && (
        <button
          onClick={onCancel}
          className="flex items-center gap-3 px-4 py-2.5 w-full cursor-pointer"
        >
          <span className="relative flex items-center justify-center shrink-0">
            <span className="absolute inset-0 m-auto h-3 w-3 rounded-full bg-red-500 animate-ping opacity-75" />
            <span className="absolute inset-0 m-auto h-2.5 w-2.5 rounded-full bg-red-500" />
            <Mic size={18} className="relative text-zinc-100" />
          </span>
          <Waveform data={frequencyData} />
          <span className="text-xs text-zinc-400 font-mono tabular-nums tracking-wide">
            {formatElapsed(elapsed)}
          </span>
        </button>
      )}

      {/* ---- Transcribing state (no prior messages) ---- */}
      {state === 'transcribing' && messages.length === 0 && (
        <div className="flex items-center gap-2.5 px-5 py-2.5">
          <Loader2 size={16} className="animate-spin text-indigo-400" />
          <span className="text-sm text-zinc-300">Processing...</span>
        </div>
      )}

      {/* ---- Expanded card (has messages, or responding/transcribing with history) ---- */}
      {isExpanded && (
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              <span className="text-sm font-medium text-zinc-200">Claw</span>
            </div>
            <button
              onClick={onDismiss}
              className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5 rounded-md hover:bg-white/[0.06]"
            >
              <X size={16} />
            </button>
          </div>

          {/* Conversation thread */}
          <div
            ref={scrollRef}
            className="max-h-[50vh] overflow-y-auto px-4 py-3 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-white/10"
          >
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex flex-col gap-1', msg.role === 'user' ? 'items-end' : 'items-start')}>
                {msg.role === 'user' ? (
                  <div className="bg-indigo-500/15 text-zinc-200 text-sm px-3 py-1.5 rounded-2xl rounded-br-md max-w-[85%]">
                    {msg.content}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-300 max-w-[95%]">
                    <MarkdownContent raw>{msg.content}</MarkdownContent>
                    {/* Show cursor on last assistant message if streaming */}
                    {isStreaming && i === messages.length - 1 && (
                      <span className="inline-block w-1.5 h-4 ml-0.5 bg-indigo-400 animate-pulse rounded-sm align-middle" />
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Show dots when waiting for first token of new response */}
            {state === 'responding' && (messages.length === 0 || messages[messages.length - 1]?.role === 'user') && (
              <BouncingDots />
            )}

            {/* Show processing indicator when transcribing a follow-up */}
            {state === 'transcribing' && messages.length > 0 && (
              <div className="flex items-center gap-2 py-1">
                <Loader2 size={14} className="animate-spin text-indigo-400" />
                <span className="text-xs text-zinc-400">Processing...</span>
              </div>
            )}

            {/* Show inline recording indicator when recording a follow-up */}
            {state === 'recording' && messages.length > 0 && (
              <div className="flex items-center gap-2 py-1 self-end">
                <span className="relative flex items-center justify-center shrink-0">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                </span>
                <Waveform data={frequencyData} />
                <span className="text-xs text-zinc-400 font-mono tabular-nums">
                  {formatElapsed(elapsed)}
                </span>
              </div>
            )}
          </div>

          {/* Follow-up bar */}
          {!isStreaming && state === 'responding' && (
            <div className="flex items-center justify-center gap-2 px-4 py-2.5 border-t border-white/[0.06]">
              {isListening ? (
                <div className="flex items-center gap-2 text-xs text-indigo-400 px-3 py-1.5">
                  <Mic size={14} className="animate-pulse" />
                  <span>Listening...</span>
                </div>
              ) : (
                <button
                  onClick={onFollowUp}
                  className="flex items-center gap-2 text-xs text-zinc-400 hover:text-indigo-400 transition-colors px-3 py-1.5 rounded-full hover:bg-white/[0.06]"
                >
                  <Mic size={14} />
                  <span>Speak again</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  )
}
