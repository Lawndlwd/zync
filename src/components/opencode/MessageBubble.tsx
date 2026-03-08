import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  ChevronDown,
  ChevronRight,
  Terminal,
  CheckCircle2,
  Loader2,
  Copy,
  Check,
  User,
  Circle,
  Clock,
  Send,
} from 'lucide-react'
import { MarkdownContent } from '@/components/ui/markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { OpenCodeMessage, OpenCodePart } from '@/types/opencode'

// --- TodoWrite interactive renderer ---
interface TodoItem {
  content: string
  priority?: string
  status: string
}

function TodoListCard({ todos }: { todos: TodoItem[] }) {
  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
      case 'in_progress':
        return <Clock size={15} className="text-amber-400 shrink-0 animate-pulse" />
      default:
        return <Circle size={15} className="text-zinc-600 shrink-0" />
    }
  }

  const priorityBadge = (priority?: string) => {
    if (!priority || priority === 'medium') return null
    return (
      <span className={cn(
        'text-[10px] px-1.5 py-0.5 rounded font-medium',
        priority === 'high' ? 'bg-red-500/10 text-red-400' :
        priority === 'low' ? 'bg-zinc-500/10 text-zinc-500' :
        'bg-zinc-500/10 text-zinc-500'
      )}>
        {priority}
      </span>
    )
  }

  const completed = todos.filter(t => t.status === 'completed').length

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
        <span className="text-xs font-medium text-zinc-400">Tasks</span>
        <span className="text-[11px] text-zinc-600">
          {completed}/{todos.length} done
        </span>
      </div>
      <div className="divide-y divide-white/[0.03]">
        {todos.map((todo, i) => (
          <div key={i} className={cn(
            'flex items-start gap-2.5 px-3 py-2',
            todo.status === 'completed' && 'opacity-60'
          )}>
            <div className="mt-0.5">{statusIcon(todo.status)}</div>
            <span className={cn(
              'text-sm text-zinc-300 flex-1',
              todo.status === 'completed' && 'line-through text-zinc-500'
            )}>
              {todo.content}
            </span>
            {priorityBadge(todo.priority)}
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Question interactive renderer ---
interface QuestionOption {
  label: string
  description?: string
}

interface QuestionData {
  header?: string
  question: string
  multiple: boolean
  options: QuestionOption[]
}

function QuestionCard({
  questions,
  onSubmit,
}: {
  questions: QuestionData[]
  onSubmit?: (answer: string) => void
}) {
  const [selections, setSelections] = useState<Record<number, Set<number>>>({})
  const [submitted, setSubmitted] = useState(false)

  const toggle = useCallback((qIdx: number, oIdx: number, multiple: boolean) => {
    if (submitted) return
    setSelections(prev => {
      const next = { ...prev }
      const current = new Set(next[qIdx] || [])
      if (multiple) {
        if (current.has(oIdx)) current.delete(oIdx)
        else current.add(oIdx)
      } else {
        current.clear()
        current.add(oIdx)
      }
      next[qIdx] = current
      return next
    })
  }, [submitted])

  const hasSelection = Object.values(selections).some(s => s.size > 0)

  const handleSubmit = useCallback(() => {
    if (!hasSelection || submitted || !onSubmit) return
    setSubmitted(true)
    const parts: string[] = []
    for (let qi = 0; qi < questions.length; qi++) {
      const q = questions[qi]
      const sel = selections[qi]
      if (!sel || sel.size === 0) continue
      const labels = [...sel].map(i => q.options[i]?.label).filter(Boolean)
      if (questions.length > 1) {
        parts.push(`${q.header || q.question}: ${labels.join(', ')}`)
      } else {
        parts.push(labels.join(', '))
      }
    }
    onSubmit(parts.join('\n'))
  }, [hasSelection, submitted, onSubmit, questions, selections])

  return (
    <div className="space-y-4">
      {questions.map((q, qi) => (
        <div key={qi} className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          {q.header && (
            <div className="px-3 py-2 border-b border-white/[0.04]">
              <span className="text-xs font-medium text-zinc-400">{q.header}</span>
            </div>
          )}
          <div className="px-3 py-2">
            <p className="text-sm text-zinc-300 mb-3">{q.question}</p>
            <div className="space-y-1.5">
              {q.options.map((opt, oi) => {
                const selected = selections[qi]?.has(oi) ?? false
                return (
                  <button
                    key={oi}
                    onClick={() => toggle(qi, oi, q.multiple)}
                    disabled={submitted}
                    className={cn(
                      'flex items-start gap-3 w-full rounded-lg border px-3 py-2.5 text-left transition-all',
                      selected
                        ? 'border-indigo-500/40 bg-indigo-500/10'
                        : 'border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.04]',
                      submitted && 'cursor-default',
                      submitted && !selected && 'opacity-40'
                    )}
                  >
                    <div className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded',
                      q.multiple ? 'rounded' : 'rounded-full',
                      selected
                        ? 'bg-indigo-500 text-white'
                        : 'border border-zinc-600'
                    )}>
                      {selected && <Check size={10} strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm font-medium',
                        selected ? 'text-zinc-200' : 'text-zinc-400'
                      )}>
                        {opt.label}
                      </p>
                      {opt.description && (
                        <p className="text-xs text-zinc-600 mt-0.5">{opt.description}</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          {!submitted && onSubmit && (
            <div className="px-3 py-2 border-t border-white/[0.04] flex justify-end">
              <Button
                size="sm"
                className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-30"
                onClick={handleSubmit}
                disabled={!hasSelection}
              >
                <Send size={12} />
                Submit
              </Button>
            </div>
          )}
          {submitted && (
            <div className="px-3 py-1.5 border-t border-white/[0.04]">
              <span className="text-[11px] text-emerald-400">Submitted</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ToolInvocationCard({
  part,
}: {
  part: Extract<OpenCodePart, { type: 'tool-invocation' }>
}) {
  const [open, setOpen] = useState(false)
  const { toolName, state, args, result } = part.toolInvocation

  const isComplete = state === 'result'
  const isRunning = state === 'call'

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left text-sm hover:bg-white/[0.04] transition-colors">
          <div
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded',
              isComplete
                ? 'text-emerald-400'
                : isRunning
                  ? 'text-amber-400'
                  : 'text-zinc-500'
            )}
          >
            {isComplete ? (
              <CheckCircle2 size={14} />
            ) : isRunning ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Terminal size={14} />
            )}
          </div>
          <span className="font-mono text-xs text-zinc-400 truncate">
            {toolName}
          </span>
          <Badge
            className={cn(
              'ml-auto text-[10px] px-1.5 py-0 h-5',
              isComplete
                ? 'bg-emerald-500/10 text-emerald-400'
                : isRunning
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-zinc-500/10 text-zinc-400'
            )}
          >
            {isComplete ? 'Done' : isRunning ? 'Running' : state}
          </Badge>
          {open ? (
            <ChevronDown size={14} className="shrink-0 text-zinc-600" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-zinc-600" />
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 rounded-lg border border-white/[0.06] bg-zinc-950/60 px-3 py-2.5 space-y-2.5">
          {Object.keys(args).length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 mb-1">
                Input
              </p>
              <pre className="text-xs text-zinc-400 whitespace-pre-wrap break-all font-mono leading-relaxed">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {result !== undefined && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 mb-1">
                Output
              </p>
              <pre className="text-xs text-zinc-400 whitespace-pre-wrap break-all font-mono leading-relaxed max-h-48 overflow-y-auto">
                {typeof result === 'string'
                  ? result
                  : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover/msg:opacity-100 transition-opacity text-zinc-600 hover:text-zinc-400 p-1"
      title="Copy"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )
}

export function MessageBubble({
  message,
  onSendMessage,
}: {
  message: OpenCodeMessage
  onSendMessage?: (text: string) => void
}) {
  const isUser = message.role === 'user'

  const textContent = message.parts
    .filter((p) => p.type === 'text')
    .map((p) => (p as { type: 'text'; text: string }).text)
    .join('')

  // User message — simple line with icon, no bubble
  if (isUser) {
    return (
      <div className="group/msg flex items-start gap-3 py-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 mt-0.5">
          <User size={13} className="text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-100 whitespace-pre-wrap break-words leading-relaxed">
            {textContent}
          </p>
        </div>
        <CopyButton text={textContent} />
      </div>
    )
  }

  // Assistant message — full width, no bubble, just rendered content
  const tokenInfo = message.tokens
  const formatT = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n)

  return (
    <div className="group/msg py-2">
      <div className="space-y-3">
        {message.parts.map((part, i) => {
          if (part.type === 'text' && part.text.trim()) {
            return (
              <div key={i} className="relative">
                <div className="absolute -top-1 right-0 z-10">
                  <CopyButton text={part.text} />
                </div>
                <div className="text-sm text-zinc-300 leading-relaxed overflow-hidden break-words">
                  <MarkdownContent raw>{part.text}</MarkdownContent>
                </div>
              </div>
            )
          }
          if (part.type === 'tool-invocation') {
            const { toolName, args, result } = part.toolInvocation

            // TodoWrite → render interactive todo list
            if (toolName === 'TodoWrite' || toolName === 'todowrite') {
              const todos = (args.todos || result) as TodoItem[] | undefined
              if (todos && Array.isArray(todos)) {
                return <TodoListCard key={i} todos={todos} />
              }
            }

            // question → render interactive selection
            if (toolName === 'question') {
              const questions = args.questions as QuestionData[] | undefined
              if (questions && Array.isArray(questions)) {
                return <QuestionCard key={i} questions={questions} onSubmit={onSendMessage} />
              }
            }

            return <ToolInvocationCard key={i} part={part} />
          }
          return null
        })}
      </div>
      {tokenInfo && (
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-zinc-600">
          <span>out: {formatT(tokenInfo.output)}</span>
          {tokenInfo.cache.read > 0 && (
            <span className="text-emerald-600">cached: {formatT(tokenInfo.cache.read)}</span>
          )}
          {message.cost != null && message.cost > 0 && (
            <span className="text-amber-600">${message.cost.toFixed(4)}</span>
          )}
        </div>
      )}
    </div>
  )
}
