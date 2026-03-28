import { format } from 'date-fns'
import { ArrowRight, BookOpen, Calendar, Gamepad2, Mic, Moon, Sun, Target } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EveningSynthesis } from '@/components/planner/evening-synthesis'
import { GameBoard } from '@/components/planner/game-board'
import { JournalView } from '@/components/planner/journal-view'
import { MorningProtocol } from '@/components/planner/morning-protocol'

const ProjectsView = lazy(() => import('@/components/planner/projects-view').then((m) => ({ default: m.ProjectsView })))

import { ConversationContent } from '@/components/voice/ConversationContent'
import { useVoiceConversation } from '@/hooks/useVoiceConversation'
import { cn } from '@/lib/utils'
import type { LifeOsView } from '@/store/life-os'
import { useLifeOsStore } from '@/store/life-os'

const SLUG_TO_VIEW: Record<string, LifeOsView> = {
  'game-board': 'game-board',
  morning: 'morning',
  evening: 'evening',
  journal: 'journal',
  projects: 'projects',
  planning: 'game-board',
}

const NAV_ITEMS: { view: LifeOsView; label: string; icon: typeof Gamepad2 }[] = [
  { view: 'game-board', label: 'Game Board', icon: Gamepad2 },
  { view: 'morning', label: 'Morning', icon: Sun },
  { view: 'evening', label: 'Evening', icon: Moon },
  { view: 'journal', label: 'Journal', icon: BookOpen },
  { view: 'projects', label: 'Projects', icon: Target },
]

export function PlannerPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { activeView, setActiveView } = useLifeOsStore()

  useEffect(() => {
    const view = SLUG_TO_VIEW[slug || ''] || 'game-board'
    if (activeView !== view) setActiveView(view)
  }, [slug])

  const [askInput, setAskInput] = useState('')
  const [showAssistant, setShowAssistant] = useState(false)
  const voice = useVoiceConversation()

  // Drag state for voice overlay
  const [boxPos, setBoxPos] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 })

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
      const rect = (e.currentTarget.closest('[data-voice-box]') as HTMLElement)?.getBoundingClientRect()
      const currentX = boxPos?.x ?? rect?.left ?? 0
      const currentY = boxPos?.y ?? rect?.top ?? 0
      dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, posX: currentX, posY: currentY }
      if (!boxPos && rect) setBoxPos({ x: rect.left, y: rect.top })
    },
    [boxPos],
  )

  const onDragMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      const dx = e.clientX - dragStart.current.mouseX
      const dy = e.clientY - dragStart.current.mouseY
      setBoxPos({
        x: Math.max(0, Math.min(window.innerWidth - 400, dragStart.current.posX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 100, dragStart.current.posY + dy)),
      })
    },
    [isDragging],
  )

  const onDragEnd = useCallback(() => setIsDragging(false), [])
  const now = new Date()
  const dayNum = format(now, 'd')
  const dayName = format(now, 'EEE,')
  const month = format(now, 'MMMM')

  return (
    <div className="flex flex-col gap-5 py-6 h-full min-h-0 ">
      {/* Navigation Tabs */}
      <div className="sticky top-0 z-30 flex gap-1 rounded-full bg-card border border-border p-1.5">
        {NAV_ITEMS.map(({ view, label, icon: Icon }) => (
          <button
            key={view}
            onClick={() => navigate(`/s/${view}`)}
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
              activeView === view ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Hero Row: Date Strip + AI Greeting — only on Game Board */}
      {activeView === 'game-board' && (
        <div className="flex items-center gap-5 px-6 py-6 lg:py-8">
          {/* Date circle */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 lg:h-20 lg:w-20 items-center justify-center rounded-full border-2 border-muted">
              <span className="text-3xl lg:text-4xl font-display font-bold text-foreground">{dayNum}</span>
            </div>
            <div className="border-l border-border pl-4">
              <p className="text-sm font-medium text-foreground">{dayName}</p>
              <p className="text-sm text-muted-foreground">{month}</p>
            </div>
          </div>

          {/* Show my Tasks button */}
          <Link
            to="/tasks"
            className="bg-primary text-white rounded-full px-6 py-3 text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            Show my Tasks <ArrowRight size={16} />
          </Link>

          {/* Calendar icon */}
          <button
            aria-label="Calendar"
            className="hidden sm:flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:bg-accent transition-colors"
          >
            <Calendar size={18} />
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* AI Greeting + Input */}
          <div className="flex-1 min-w-0 relative">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-foreground leading-tight">
              Hey, Need help? 👋
            </h1>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (askInput.trim()) {
                  navigate(`/chat?q=${encodeURIComponent(askInput.trim())}`)
                  setAskInput('')
                  setShowAssistant(true)
                }
              }}
              className="mt-1"
            >
              <input
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                placeholder="Just ask me anything!"
                className="w-full bg-transparent text-lg sm:text-xl lg:text-2xl font-display text-foreground placeholder:text-muted-foreground/50 outline-none border-none"
              />
            </form>

            {/* Voice conversation overlay */}
            {(voice.isActive || showAssistant) && (
              <div
                data-voice-box
                className={cn(
                  'z-50 w-[400px] rounded-2xl border border-border bg-card shadow-ambient-lg',
                  boxPos ? 'fixed' : 'absolute right-0 top-full mt-3',
                )}
                style={boxPos ? { left: boxPos.x, top: boxPos.y } : undefined}
              >
                <ConversationContent
                  state={voice.state}
                  messages={voice.messages}
                  frequencyData={voice.frequencyData}
                  elapsed={voice.elapsed}
                  isStreaming={voice.isStreaming}
                  isListening={voice.isListening}
                  onCancel={voice.handleCancel}
                  onDismiss={() => {
                    voice.closeConversation()
                    setShowAssistant(false)
                    setBoxPos(null)
                  }}
                  onFollowUp={voice.startCapture}
                  onDragStart={onDragStart}
                />
              </div>
            )}
            {isDragging && (
              <div
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                className="fixed inset-0 z-[200] cursor-grabbing"
                style={{ touchAction: 'none' }}
              />
            )}
          </div>

          {/* Mic button — large white circle */}
          <button
            onClick={() => {
              voice.openConversation()
              setShowAssistant(true)
            }}
            className={cn(
              'shrink-0 flex h-16 w-16 lg:h-28 lg:w-28 items-center justify-center rounded-full transition-colors',
              voice.isActive
                ? 'bg-primary text-white'
                : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
            title="Open Jarvis"
          >
            <Mic size={26} />
          </button>
        </div>
      )}

      {/* Active View — white cards zone */}
      <div className="bg-card rounded-2xl p-4 -mx-4">
        {activeView === 'game-board' && <GameBoard />}
        {activeView === 'morning' && <MorningProtocol />}
        {activeView === 'evening' && <EveningSynthesis />}
        {activeView === 'journal' && <JournalView />}
        {activeView === 'projects' && (
          <Suspense>
            <ProjectsView />
          </Suspense>
        )}
      </div>
    </div>
  )
}
