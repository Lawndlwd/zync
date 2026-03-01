import { useState } from 'react'
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
} from 'lucide-react'
import { MarkdownContent } from '@/components/ui/markdown'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { OpenCodeMessage, OpenCodePart } from '@/types/opencode'

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

export function MessageBubble({ message }: { message: OpenCodeMessage }) {
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
                <div className="text-sm text-zinc-300 leading-relaxed">
                  <MarkdownContent raw>{part.text}</MarkdownContent>
                </div>
              </div>
            )
          }
          if (part.type === 'tool-invocation') {
            return <ToolInvocationCard key={i} part={part} />
          }
          return null
        })}
      </div>
    </div>
  )
}
