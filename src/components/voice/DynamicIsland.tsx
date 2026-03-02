import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { createPortal } from 'react-dom'
import { Mic, Loader2, X, GripHorizontal, Ear, EarOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarkdownContent } from '@/components/ui/markdown'
import { useVoiceConversation } from '@/hooks/useVoiceConversation'

// ---------------------------------------------------------------------------
// Waveform (copied from VoicePill)
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
// Status helpers
// ---------------------------------------------------------------------------

type StatusColor = 'red' | 'green' | 'indigo'

function getStatusColor(state: string, isStreaming: boolean): StatusColor {
  if (state === 'recording') return 'red'
  if (state === 'responding' && isStreaming) return 'indigo'
  return 'green'
}

const GLOW_COLORS: Record<StatusColor, string> = {
  red: '0 0 20px 4px rgba(239, 68, 68, 0.3)',
  green: '0 0 20px 4px rgba(34, 197, 94, 0.3)',
  indigo: '0 0 20px 4px rgba(99, 102, 241, 0.3)',
}

const DOT_CLASSES: Record<StatusColor, string> = {
  red: 'bg-red-500',
  green: 'bg-green-500',
  indigo: 'bg-indigo-500',
}

// ---------------------------------------------------------------------------
// Conversation Content (shared between attached & detached)
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
  onDragMove: (e: React.PointerEvent) => void
  onDragEnd: (e: React.PointerEvent) => void
}

function ConversationContent({
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
  onDragMove,
  onDragEnd,
}: ConversationContentProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const statusColor = getStatusColor(state, isStreaming)

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          {state === 'recording' ? (
            <span className="relative h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
              <span className="absolute inset-0 rounded-full bg-red-500" />
            </span>
          ) : (
            <span className={cn('h-2 w-2 rounded-full', DOT_CLASSES[statusColor])} />
          )}
          <span className="text-sm font-medium text-zinc-200">Jarvis</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            className="text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing p-0.5 rounded-md hover:bg-white/[0.06] transition-colors touch-none"
          >
            <GripHorizontal size={16} />
          </div>
          <button
            onClick={onDismiss}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5 rounded-md hover:bg-white/[0.06]"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div
        ref={scrollRef}
        className="max-h-[50vh] overflow-y-auto px-4 py-3 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-white/10"
      >
        {/* Recording indicator (first utterance) */}
        {state === 'recording' && messages.length === 0 && (
          <button
            onClick={onCancel}
            className="flex items-center gap-3 py-1 w-full cursor-pointer self-center"
          >
            <Mic size={18} className="text-red-400 shrink-0" />
            <Waveform data={frequencyData} />
            <span className="text-xs text-zinc-400 font-mono tabular-nums tracking-wide">
              {formatElapsed(elapsed)}
            </span>
          </button>
        )}

        {/* Transcribing (first utterance) */}
        {state === 'transcribing' && messages.length === 0 && (
          <div className="flex items-center gap-2.5 py-1">
            <Loader2 size={16} className="animate-spin text-indigo-400" />
            <span className="text-sm text-zinc-300">Processing...</span>
          </div>
        )}

        {/* Conversation messages */}
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex flex-col gap-1', msg.role === 'user' ? 'items-end' : 'items-start')}>
            {msg.role === 'user' ? (
              <div className="bg-indigo-500/15 text-zinc-200 text-sm px-3 py-1.5 rounded-2xl rounded-br-md max-w-[85%]">
                {msg.content}
              </div>
            ) : (
              <div className="text-sm text-zinc-300 max-w-[95%]">
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
            <Loader2 size={14} className="animate-spin text-indigo-400" />
            <span className="text-xs text-zinc-400">Processing...</span>
          </div>
        )}

        {/* Recording follow-up */}
        {state === 'recording' && messages.length > 0 && (
          <div className="flex items-center gap-2 py-1 self-end">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
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
  )
}

// ---------------------------------------------------------------------------
// DynamicIsland
// ---------------------------------------------------------------------------

const PILL_WIDTH_IDLE = 160
const PILL_HEIGHT = 40
const EXPANDED_WIDTH = 400
const DRAG_DETACH_THRESHOLD = 20
const TRANSITION_DURATION = '400ms'
const TRANSITION_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)'

export function DynamicIsland() {
  const voice = useVoiceConversation()

  // UI modes: 'idle' | 'expanded' | 'detached'
  const [mode, setMode] = useState<'idle' | 'expanded' | 'detached'>('idle')
  const modeRef = useRef(mode)
  modeRef.current = mode

  // Detached card position
  const [detachedPos, setDetachedPos] = useState({ x: 0, y: 200 })
  const draggingRef = useRef(false)
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 })
  const dragDistanceRef = useRef(0)

  // Track content fade-in for expansion
  const [contentVisible, setContentVisible] = useState(false)

  // When voice activates, expand the island
  useEffect(() => {
    if (voice.isActive && mode === 'idle') {
      setMode('expanded')
      // Delay content visibility for the expansion animation
      const timer = setTimeout(() => setContentVisible(true), 200)
      return () => clearTimeout(timer)
    }
    if (!voice.isActive && mode !== 'idle') {
      setMode('idle')
      setContentVisible(false)
      setDetachedPos({ x: 0, y: 200 })
    }
  }, [voice.isActive, mode])

  // ---------------------------------------------------------------------------
  // Drag handlers — used in expanded mode to detach
  // ---------------------------------------------------------------------------
  const onDragStart = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true
    dragDistanceRef.current = 0
    const currentMode = modeRef.current

    if (currentMode === 'expanded') {
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        posX: 0,
        posY: Math.min(200, window.innerHeight * 0.3),
      }
    } else if (currentMode === 'detached') {
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        posX: detachedPos.x,
        posY: detachedPos.y,
      }
    }

    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }, [detachedPos])

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return
    const dx = e.clientX - dragStartRef.current.mouseX
    const dy = e.clientY - dragStartRef.current.mouseY
    const distance = Math.sqrt(dx * dx + dy * dy)
    dragDistanceRef.current = distance
    const currentMode = modeRef.current

    const clampPos = (rawX: number, rawY: number) => ({
      x: Math.max(-window.innerWidth / 2 + 220, Math.min(window.innerWidth / 2 - 220, rawX)),
      y: Math.max(60, Math.min(window.innerHeight - 100, rawY)),
    })

    if (currentMode === 'expanded' && distance > DRAG_DETACH_THRESHOLD) {
      modeRef.current = 'detached'
      setMode('detached')
      setDetachedPos(clampPos(
        dragStartRef.current.posX + dx,
        dragStartRef.current.posY + dy,
      ))
    } else if (currentMode === 'detached') {
      setDetachedPos(clampPos(
        dragStartRef.current.posX + dx,
        dragStartRef.current.posY + dy,
      ))
    }
  }, [])

  const onDragEnd = useCallback((e: React.PointerEvent) => {
    draggingRef.current = false
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }, [])

  // ---------------------------------------------------------------------------
  // Pill click behavior
  // ---------------------------------------------------------------------------
  const onPillClick = useCallback(() => {
    if (mode === 'detached') {
      // Re-attach the card
      setMode('expanded')
      setContentVisible(true)
    } else if (!voice.isActive) {
      // Toggle wake word
      voice.toggleWakeWord()
    }
  }, [mode, voice])

  // ---------------------------------------------------------------------------
  // Dismiss handler
  // ---------------------------------------------------------------------------
  const onDismiss = useCallback(() => {
    voice.closeConversation()
    setMode('idle')
    setContentVisible(false)
  }, [voice])

  // ---------------------------------------------------------------------------
  // Determine pill visual state
  // ---------------------------------------------------------------------------
  const isExpanded = mode === 'expanded'
  const isDetached = mode === 'detached'
  const statusColor = getStatusColor(voice.state, voice.isStreaming)

  const pillWidth = isExpanded ? EXPANDED_WIDTH : PILL_WIDTH_IDLE
  const pillGlow = isDetached
    ? GLOW_COLORS[statusColor]
    : !voice.isActive && voice.wakeWordEnabled
      ? '0 0 12px 2px rgba(34, 197, 94, 0.15)'
      : 'none'

  return createPortal(
    <>
      {/* Keyframe styles */}
      <style>{`
        @keyframes diBounceDot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes diEarPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Island Pill — always visible at top-center */}
      <div
        onClick={onPillClick}
        className={cn(
          'fixed z-[100] border border-white/[0.08] backdrop-blur-2xl',
          'left-1/2 -translate-x-1/2',
          'flex items-center justify-center gap-2',
          'cursor-pointer select-none',
          isExpanded
            ? 'rounded-2xl'
            : 'rounded-full',
        )}
        style={{
          top: 12,
          width: pillWidth,
          height: isExpanded ? 'auto' : PILL_HEIGHT,
          minHeight: PILL_HEIGHT,
          backgroundColor: '#0a0a0a',
          boxShadow: pillGlow,
          transition: `width ${TRANSITION_DURATION} ${TRANSITION_EASING}, height ${TRANSITION_DURATION} ${TRANSITION_EASING}, border-radius ${TRANSITION_DURATION} ${TRANSITION_EASING}, box-shadow ${TRANSITION_DURATION} ${TRANSITION_EASING}`,
          overflow: 'hidden',
        }}
      >
        {/* Idle pill content (shown when NOT expanded) */}
        {!isExpanded && (
          <div className="flex items-center gap-2 px-4 w-full justify-center">
            {isDetached ? (
              // Detached: show status dot
              <>
                <span className={cn('h-2.5 w-2.5 rounded-full', DOT_CLASSES[statusColor])} />
                <span className="text-xs text-zinc-400 truncate">
                  {voice.state === 'recording' ? 'Recording' : voice.state === 'responding' ? 'Responding' : 'Listening'}
                </span>
              </>
            ) : voice.wakeWordEnabled ? (
              // Idle + wake word ON
              <>
                <Ear size={16} className="text-emerald-400/80 shrink-0" style={{ animation: 'diEarPulse 2s ease-in-out infinite' }} />
                <span className="text-xs text-zinc-500 truncate">Hey Jarvis...</span>
              </>
            ) : (
              // Idle + wake word OFF
              <>
                <EarOff size={16} className="text-zinc-600 shrink-0" />
                <span className="text-xs text-zinc-600 truncate">Voice Off</span>
              </>
            )}
          </div>
        )}

        {/* Expanded content (conversation card morphed into pill) */}
        {isExpanded && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              opacity: contentVisible ? 1 : 0,
              transition: `opacity 200ms ease-out`,
              width: '100%',
            }}
          >
            <ConversationContent
              state={voice.state}
              messages={voice.messages}
              frequencyData={voice.frequencyData}
              elapsed={voice.elapsed}
              isStreaming={voice.isStreaming}
              isListening={voice.isListening}
              onCancel={voice.handleCancel}
              onDismiss={onDismiss}
              onFollowUp={voice.startCapture}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
            />
          </div>
        )}
      </div>

      {/* Detached floating card */}
      {isDetached && (
        <div
          className="fixed z-[99] w-[400px] rounded-2xl border border-white/[0.08] shadow-2xl shadow-black/40"
          style={{
            top: detachedPos.y,
            left: `calc(50% + ${detachedPos.x}px)`,
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(10, 10, 10, 0.95)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
          }}
        >
          <ConversationContent
            state={voice.state}
            messages={voice.messages}
            frequencyData={voice.frequencyData}
            elapsed={voice.elapsed}
            isStreaming={voice.isStreaming}
            isListening={voice.isListening}
            onCancel={voice.handleCancel}
            onDismiss={onDismiss}
            onFollowUp={voice.startCapture}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
          />
        </div>
      )}
    </>,
    document.body
  )
}
