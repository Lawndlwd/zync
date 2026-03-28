import { Ear, EarOff } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useVoiceConversation } from '@/hooks/useVoiceConversation'
import { cn } from '@/lib/utils'
import { ConversationContent, DOT_CLASSES, GLOW_COLORS, getStatusColor } from './ConversationContent'

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
  const [detachedPos, setDetachedPos] = useState({ x: 0, y: 12 })
  const [isDragging, setIsDragging] = useState(false)
  const draggingRef = useRef(false)
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 })

  // Track content fade-in for expansion
  const [contentVisible, setContentVisible] = useState(false)

  // When voice activates, expand the island
  useEffect(() => {
    if (voice.isActive && mode === 'idle') {
      setMode('expanded')
      requestAnimationFrame(() => requestAnimationFrame(() => setContentVisible(true)))
    }
    if (!voice.isActive && mode !== 'idle') {
      setMode('idle')
      setContentVisible(false)
      setDetachedPos({ x: 0, y: 12 })
    }
  }, [voice.isActive, mode])

  // ---------------------------------------------------------------------------
  // Drag system — uses a full-viewport overlay so pointer capture survives
  // the DOM restructure when expanded → detached
  // ---------------------------------------------------------------------------
  const clampPos = useCallback(
    (rawX: number, rawY: number) => ({
      x: Math.max(-window.innerWidth / 2 + 220, Math.min(window.innerWidth / 2 - 220, rawX)),
      y: Math.max(12, Math.min(window.innerHeight - 100, rawY)),
    }),
    [],
  )

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      draggingRef.current = true
      setIsDragging(true)
      const currentMode = modeRef.current

      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        posX: currentMode === 'detached' ? detachedPos.x : 0,
        posY: currentMode === 'detached' ? detachedPos.y : 12,
      }
    },
    [detachedPos],
  )

  // These run on the overlay, so they never lose the element
  const onOverlayMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return
      const dx = e.clientX - dragStartRef.current.mouseX
      const dy = e.clientY - dragStartRef.current.mouseY
      const currentMode = modeRef.current

      if (currentMode === 'expanded') {
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > DRAG_DETACH_THRESHOLD) {
          modeRef.current = 'detached'
          setMode('detached')
          setDetachedPos(clampPos(dragStartRef.current.posX + dx, dragStartRef.current.posY + dy))
        }
      } else {
        setDetachedPos(clampPos(dragStartRef.current.posX + dx, dragStartRef.current.posY + dy))
      }
    },
    [clampPos],
  )

  const onOverlayUp = useCallback(() => {
    draggingRef.current = false
    setIsDragging(false)
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
          'fixed z-[100] border border-border backdrop-blur-[40px]',
          'left-1/2 -translate-x-1/2',
          'flex items-center justify-center gap-2',
          'cursor-pointer select-none',
          isExpanded ? 'rounded-2xl' : 'rounded-full',
        )}
        style={{
          top: 12,
          width: pillWidth,
          ...(isExpanded ? { maxHeight: '70vh' } : { height: PILL_HEIGHT }),
          backgroundColor: 'hsl(var(--card) / 0.8)',
          boxShadow: pillGlow,
          transition: `width ${TRANSITION_DURATION} ${TRANSITION_EASING}, border-radius ${TRANSITION_DURATION} ${TRANSITION_EASING}, box-shadow ${TRANSITION_DURATION} ${TRANSITION_EASING}`,
        }}
      >
        {/* Idle pill content (shown when NOT expanded) */}
        {!isExpanded && (
          <div className="flex items-center gap-2 px-4 w-full justify-center">
            {isDetached ? (
              // Detached: show status dot
              <>
                <span className={cn('h-2.5 w-2.5 rounded-full', DOT_CLASSES[statusColor])} />
                <span className="text-xs text-muted-foreground truncate">
                  {voice.state === 'recording'
                    ? 'Recording'
                    : voice.state === 'responding'
                      ? 'Responding'
                      : 'Listening'}
                </span>
              </>
            ) : voice.wakeWordEnabled ? (
              // Idle + wake word ON
              <>
                <Ear
                  size={16}
                  className="text-emerald-400/80 shrink-0"
                  style={{ animation: 'diEarPulse 2s ease-in-out infinite' }}
                />
                <span className="text-xs text-muted-foreground truncate">Hey Jarvis...</span>
              </>
            ) : (
              // Idle + wake word OFF
              <>
                <EarOff size={16} className="text-muted-foreground/50 shrink-0" />
                <span className="text-xs text-muted-foreground/50 truncate">Voice Off</span>
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
            />
          </div>
        )}
      </div>

      {/* Detached floating card */}
      {isDetached && (
        <div
          className="fixed z-[99] w-[400px] rounded-2xl border border-border shadow-2xl shadow-black/40 backdrop-blur-[40px]"
          style={{
            top: detachedPos.y,
            left: `calc(50% + ${detachedPos.x}px)`,
            transform: 'translateX(-50%)',
            backgroundColor: 'hsl(var(--card) / 0.8)',
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
          />
        </div>
      )}

      {/* Drag overlay — captures pointer events during drag so we never lose them */}
      {isDragging && (
        <div
          onPointerMove={onOverlayMove}
          onPointerUp={onOverlayUp}
          className="fixed inset-0 z-[200] cursor-grabbing"
          style={{ touchAction: 'none' }}
        />
      )}
    </>,
    document.body,
  )
}
