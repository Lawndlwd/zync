import { useState, useEffect, useCallback, useRef } from 'react'
import { X, User, Bot, Loader2, Check, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { MilkdownEditor } from '@/components/ui/milkdown-editor'
import { useUpdateTask } from '@/hooks/useTasks'
import type { Task, TaskStatus, TaskAssignee, TaskPriority } from '@/types/project'
import toast from 'react-hot-toast'

const PANEL_MIN_WIDTH = 420
const PANEL_MAX_WIDTH_RATIO = 0.75
const PANEL_STORAGE_KEY = 'zync-task-panel-width'

interface TaskDrawerProps {
  task: Task | null
  open: boolean
  onClose: () => void
}

const STATUS_OPTIONS: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'todo', label: 'Todo', color: 'bg-zinc-500' },
  { value: 'in-progress', label: 'In Progress', color: 'bg-blue-500' },
  { value: 'completed', label: 'Completed', color: 'bg-emerald-500' },
]

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-zinc-400' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-400' },
  { value: 'high', label: 'High', color: 'bg-red-400' },
]

export function TaskDrawer({ task, open, onClose }: TaskDrawerProps) {
  const updateTask = useUpdateTask()

  // Local editable state
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [assignee, setAssignee] = useState<TaskAssignee>('@me')
  const [priority, setPriority] = useState<TaskPriority>('low')
  const [content, setContent] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  // Resizable panel width
  const [panelWidth, setPanelWidth] = useState(() => {
    const stored = localStorage.getItem(PANEL_STORAGE_KEY)
    return stored ? Math.max(PANEL_MIN_WIDTH, parseInt(stored, 10)) : Math.round(window.innerWidth * 0.45)
  })
  const isDragging = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const taskIdRef = useRef<string | null>(null)
  // Track whether the init effect has applied — prevents auto-save on first render
  const initializedRef = useRef(false)

  // Reset local state when a new task is selected
  useEffect(() => {
    if (task && task.id !== taskIdRef.current) {
      initializedRef.current = false
      taskIdRef.current = task.id
      setTitle(task.metadata.title)
      setStatus(task.metadata.status)
      setAssignee(task.metadata.assignee)
      setPriority(task.metadata.priority)
      setContent(task.content)
      setSaveStatus('idle')
      setEditingTitle(false)
      // Mark initialized after state is set — the next render will have correct values
      requestAnimationFrame(() => { initializedRef.current = true })
    }
  }, [task])

  // Keep a ref to the save function so the effect never depends on it
  const saveRef = useRef<() => void>(() => {})
  saveRef.current = () => {
    if (!task) return
    setSaveStatus('saving')
    updateTask.mutate(
      {
        projectName: task.project,
        taskFile: task.fileName,
        title,
        status,
        assignee,
        priority,
        content,
      },
      {
        onSuccess: () => setSaveStatus('saved'),
        onError: () => {
          setSaveStatus('idle')
          toast.error('Failed to save task')
        },
      },
    )
  }

  // Auto-save: only fires when the actual field values change
  useEffect(() => {
    if (!initializedRef.current) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveRef.current(), 800)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [title, status, assignee, priority, content])

  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent)
    },
    []
  )

  // Resize drag handler
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    const startX = e.clientX
    const startWidth = panelWidth
    const maxWidth = window.innerWidth * PANEL_MAX_WIDTH_RATIO

    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX
      const newWidth = Math.min(maxWidth, Math.max(PANEL_MIN_WIDTH, startWidth + delta))
      setPanelWidth(newWidth)
    }

    const onUp = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      // Persist
      localStorage.setItem(PANEL_STORAGE_KEY, String(panelWidth))
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [panelWidth])

  // Persist width after drag ends (panelWidth may have changed during drag)
  useEffect(() => {
    if (!isDragging.current) {
      localStorage.setItem(PANEL_STORAGE_KEY, String(panelWidth))
    }
  }, [panelWidth])

  // Escape key to close
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Prevent body scrolling when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!task) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'fixed right-0 top-0 z-50 h-full bg-zinc-950 border-l border-white/[0.06] flex transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{ width: panelWidth }}
      >
        {/* Resize handle — left edge */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-20 group flex items-center justify-center hover:bg-indigo-500/30 active:bg-indigo-500/50 transition-colors"
          onMouseDown={handleResizeStart}
        >
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical size={12} className="text-zinc-500" />
          </div>
        </div>

        {/* Close button + save status */}
        <div className="absolute top-5 right-5 z-10 flex items-center gap-3">
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            {saveStatus === 'saving' && (
              <>
                <Loader2 size={12} className="animate-spin" />
                Saving...
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <Check size={12} className="text-emerald-400" />
                Saved
              </>
            )}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Title */}
          <div className="px-8 pt-8 pb-4 pr-28">
            {editingTitle ? (
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setEditingTitle(false)
                }}
                autoFocus
                className="text-2xl font-bold border-indigo-500/50 bg-transparent px-0 h-auto py-1"
              />
            ) : (
              <h2
                className="text-2xl font-bold text-zinc-100 cursor-text hover:text-white transition-colors leading-tight"
                onClick={() => setEditingTitle(true)}
              >
                {title}
              </h2>
            )}
          </div>

          {/* Metadata properties */}
          <div className="px-8 space-y-3">
            {/* Status */}
            <div className="flex items-center">
              <span className="w-28 text-[13px] text-zinc-500 shrink-0">Status</span>
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-2.5 h-2.5 rounded-full',
                  STATUS_OPTIONS.find((s) => s.value === status)?.color
                )} />
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="h-8 rounded-md border border-white/[0.1] bg-white/[0.04] px-2.5 text-[13px] text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assignee */}
            <div className="flex items-center">
              <span className="w-28 text-[13px] text-zinc-500 shrink-0">Assignee</span>
              <div className="flex items-center bg-white/[0.04] rounded-lg border border-white/[0.1] overflow-hidden">
                <button
                  onClick={() => setAssignee('@me')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 h-8 text-[13px] transition-colors',
                    assignee === '@me'
                      ? 'bg-white/[0.1] text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  <User size={14} />
                  <span>Me</span>
                </button>
                <button
                  onClick={() => setAssignee('@ai')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 h-8 text-[13px] transition-colors',
                    assignee === '@ai'
                      ? 'bg-white/[0.1] text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  <Bot size={14} />
                  <span>AI</span>
                </button>
              </div>
            </div>

            {/* Priority */}
            <div className="flex items-center">
              <span className="w-28 text-[13px] text-zinc-500 shrink-0">Priority</span>
              <div className="flex items-center bg-white/[0.04] rounded-lg border border-white/[0.1] overflow-hidden">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPriority(opt.value)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 h-8 text-[13px] transition-colors capitalize',
                      priority === opt.value
                        ? 'bg-white/[0.1] text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    <div className={cn('w-2 h-2 rounded-full', opt.color)} />
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Project */}
            <div className="flex items-center">
              <span className="w-28 text-[13px] text-zinc-500 shrink-0">Project</span>
              <span className="inline-flex items-center rounded-md bg-white/[0.06] border border-white/[0.08] px-2.5 py-1 text-xs font-medium text-zinc-400">
                {task.project}
              </span>
            </div>
          </div>

          {/* Separator */}
          <div className="mx-8 my-5 border-t border-white/[0.08]" />

          {/* Description — borderless editor, flush with panel */}
          <div className="flex-1 px-4 pb-8">
            <p className="px-4 pb-2 text-[13px] text-zinc-500">Description</p>
            <MilkdownEditor
              value={content}
              onChange={handleContentChange}
              placeholder="Add a description..."
              minHeight="calc(100vh - 420px)"
              variant="borderless"
            />
          </div>
        </div>
      </div>
    </>
  )
}
