import type { Task, TaskAssignee, TaskPriority, TaskStatus } from '@zync/shared/types'
import { Bot, Check, Loader2, User, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Input } from '@/components/ui/input'
import { MilkdownEditor } from '@/components/ui/milkdown-editor'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useUpdateTask } from '@/hooks/useTasks'
import { cn } from '@/lib/utils'

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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const taskIdRef = useRef<string | null>(null)
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
      requestAnimationFrame(() => {
        initializedRef.current = true
      })
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

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
  }, [])

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

  if (!task || !open) return null

  return (
    <div className="fixed inset-0 z-50">
      <ResizablePanelGroup orientation="horizontal">
        {/* Invisible spacer — clicking it closes the panel */}
        <ResizablePanel
          defaultSize="60%"
          minSize="15%"
          onClick={onClose}
          className="cursor-pointer bg-black/40 backdrop-blur-sm"
        />
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="40%" minSize="320px" maxSize="85%">
          <div className="flex h-full flex-col bg-background">
            {/* Close button + save status */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-b border-border">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
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
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto flex flex-col">
              {/* Title */}
              <div className="px-8 pt-6 pb-4">
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
                    className="text-2xl font-bold text-foreground cursor-text hover:text-foreground/80 transition-colors leading-tight"
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
                  <span className="w-28 text-[13px] text-muted-foreground shrink-0">Status</span>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn('w-2.5 h-2.5 rounded-full', STATUS_OPTIONS.find((s) => s.value === status)?.color)}
                    />
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as TaskStatus)}
                      className="h-8 rounded-md border border-border bg-muted px-2.5 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
                  <span className="w-28 text-[13px] text-muted-foreground shrink-0">Assignee</span>
                  <div className="flex items-center bg-foreground/[0.04] rounded-lg border border-foreground/[0.1] overflow-hidden">
                    <button
                      onClick={() => setAssignee('@me')}
                      className={cn(
                        'flex items-center gap-1.5 px-3 h-8 text-[13px] transition-colors',
                        assignee === '@me'
                          ? 'bg-accent text-foreground'
                          : 'text-muted-foreground hover:text-foreground',
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
                          ? 'bg-accent text-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Bot size={14} />
                      <span>AI</span>
                    </button>
                  </div>
                </div>

                {/* Priority */}
                <div className="flex items-center">
                  <span className="w-28 text-[13px] text-muted-foreground shrink-0">Priority</span>
                  <div className="flex items-center bg-foreground/[0.04] rounded-lg border border-foreground/[0.1] overflow-hidden">
                    {PRIORITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setPriority(opt.value)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 h-8 text-[13px] transition-colors capitalize',
                          priority === opt.value
                            ? 'bg-accent text-foreground'
                            : 'text-muted-foreground hover:text-foreground',
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
                  <span className="w-28 text-[13px] text-muted-foreground shrink-0">Project</span>
                  <span className="inline-flex items-center rounded-md bg-muted border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {task.project}
                  </span>
                </div>
              </div>

              {/* Separator */}
              <div className="mx-8 my-5 border-t border-border" />

              {/* Description — borderless editor */}
              <div className="flex-1 pb-8 px-5">
                <p className="pb-2 text-[13px] text-muted-foreground">Description</p>
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
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
