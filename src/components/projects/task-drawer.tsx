import { useState, useEffect, useCallback, useRef } from 'react'
import { X, User, Bot, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { MilkdownEditor } from '@/components/ui/milkdown-editor'
import { MentionPopover } from '@/components/projects/mention-popover'
import { useUpdateTask } from '@/hooks/useTasks'
import type { Task, TaskStatus, TaskAssignee, TaskPriority } from '@/types/project'
import toast from 'react-hot-toast'

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

  // Mention popover state
  const [mentionVisible, setMentionVisible] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionPosition, _setMentionPosition] = useState({ top: 0, left: 0 })
  const [mentionMatchStart, setMentionMatchStart] = useState(-1)
  const editorWrapperRef = useRef<HTMLDivElement>(null)

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

  // Detect @mention patterns in content
  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent)
      // TODO: Re-implement @mention detection with Milkdown's ProseMirror API
      setMentionVisible(false)
    },
    []
  )

  // Handle mention selection
  const handleMentionSelect = useCallback(
    (mention: string) => {
      if (mentionMatchStart >= 0) {
        const before = content.slice(0, mentionMatchStart)
        const afterMatchEnd = mentionMatchStart + 1 + mentionQuery.length // 1 for @
        const after = content.slice(afterMatchEnd)
        const newContent = before + mention + ' ' + after
        setContent(newContent)
      }
      setMentionVisible(false)
      setMentionQuery('')
      setMentionMatchStart(-1)

      // Refocus textarea
      const textarea = editorWrapperRef.current?.querySelector('textarea')
      if (textarea) {
        requestAnimationFrame(() => textarea.focus())
      }
    },
    [content, mentionMatchStart, mentionQuery]
  )

  const handleMentionClose = useCallback(() => {
    setMentionVisible(false)
    setMentionQuery('')
    setMentionMatchStart(-1)
  }, [])

  // Escape key to close (only when mention popover is not visible)
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !mentionVisible) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, mentionVisible])

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
          'fixed inset-0 z-50 bg-black/50 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 h-full w-full sm:w-[45%] min-w-[400px] bg-zinc-950 border-l border-white/[0.06] flex flex-col transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] p-4">
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setEditingTitle(false)
                }}
                autoFocus
                className="text-lg font-semibold border-indigo-500/50"
              />
            ) : (
              <h2
                className="text-lg font-semibold text-zinc-100 truncate cursor-text hover:text-white transition-colors"
                onClick={() => setEditingTitle(true)}
                title="Click to edit"
              >
                {title}
              </h2>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Save status */}
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

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Metadata bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.08] p-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-2 h-2 rounded-full',
              STATUS_OPTIONS.find((s) => s.value === status)?.color
            )} />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="h-8 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Assignee */}
          <div className="flex items-center bg-white/[0.04] rounded-lg border border-white/[0.1] overflow-hidden">
            <button
              onClick={() => setAssignee('@me')}
              className={cn(
                'flex items-center gap-1.5 px-3 h-8 text-sm transition-colors',
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
                'flex items-center gap-1.5 px-3 h-8 text-sm transition-colors',
                assignee === '@ai'
                  ? 'bg-white/[0.1] text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <Bot size={14} />
              <span>AI</span>
            </button>
          </div>

          {/* Priority */}
          <div className="flex items-center bg-white/[0.04] rounded-lg border border-white/[0.1] overflow-hidden">
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPriority(opt.value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 h-8 text-sm transition-colors capitalize',
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

          {/* Project badge */}
          <span className="inline-flex items-center rounded-md bg-white/[0.06] border border-white/[0.08] px-2.5 py-1 text-xs font-medium text-zinc-400">
            {task.project}
          </span>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-4" ref={editorWrapperRef}>
          <MilkdownEditor
            value={content}
            onChange={handleContentChange}
            placeholder="Write task details in markdown..."
            minHeight="calc(100vh - 220px)"
          />
          <MentionPopover
            query={mentionQuery}
            position={mentionPosition}
            onSelect={handleMentionSelect}
            onClose={handleMentionClose}
            visible={mentionVisible}
          />
        </div>
      </div>
    </>
  )
}
