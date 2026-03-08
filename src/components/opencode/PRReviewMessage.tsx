import { cn } from '@/lib/utils'
import {
  Loader2,
  GitMerge,
  Github,
  AlertTriangle,
  AlertCircle,
  Info,
  Lightbulb,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  FileCode,
} from 'lucide-react'
import { useState } from 'react'
import { MarkdownContent } from '@/components/ui/markdown'
import type { PRAgentResult, PRAgentItem } from '@/store/pr-agent'

export interface PRReviewState {
  status: string
  provider: 'gitlab' | 'github'
  target: string
  result: PRAgentResult | null
  error: string | null
}

const severityConfig: Record<string, { icon: typeof AlertTriangle; color: string; bg: string }> = {
  critical: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  suggestion: { icon: Lightbulb, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  info: { icon: Info, color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20' },
}

function ReviewItem({ item }: { item: PRAgentItem }) {
  const [open, setOpen] = useState(item.severity === 'critical')
  const config = severityConfig[item.severity] || severityConfig.info
  const Icon = config.icon

  return (
    <div className={cn('rounded-lg border', config.bg)}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left"
      >
        <Icon size={15} className={cn('shrink-0 mt-0.5', config.color)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-200">{item.title}</p>
          {item.file && (
            <p className="flex items-center gap-1 text-xs text-zinc-500 mt-0.5">
              <FileCode size={11} />
              {item.file}{item.line ? `:${item.line}` : ''}
            </p>
          )}
        </div>
        {open ? <ChevronDown size={14} className="text-zinc-600 mt-0.5" /> : <ChevronRight size={14} className="text-zinc-600 mt-0.5" />}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0">
          <div className="text-sm text-zinc-300 leading-relaxed">
            <MarkdownContent raw>{item.body}</MarkdownContent>
          </div>
          {item.suggestion && (
            <div className="mt-2 rounded-md bg-zinc-900/60 border border-white/[0.06] px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 mb-1">Suggestion</p>
              <pre className="text-xs text-emerald-400 whitespace-pre-wrap font-mono">{item.suggestion}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function PRReviewMessage({ state }: { state: PRReviewState }) {
  const ProviderIcon = state.provider === 'github' ? Github : GitMerge
  const providerColor = state.provider === 'github' ? 'text-zinc-100' : 'text-violet-400'

  // Loading state
  if (!state.result && !state.error) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex items-center gap-3">
          <Loader2 size={16} className="text-indigo-400 animate-spin" />
          <ProviderIcon size={16} className={providerColor} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200">
              Reviewing {state.target}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">{state.status}</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (state.error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <div className="flex items-center gap-3">
          <XCircle size={16} className="text-red-400" />
          <ProviderIcon size={16} className={providerColor} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-400">Review failed</p>
            <p className="text-xs text-zinc-400 mt-0.5">{state.error}</p>
          </div>
        </div>
      </div>
    )
  }

  // Result state
  const result = state.result!
  const criticalCount = result.items.filter(i => i.severity === 'critical').length
  const warningCount = result.items.filter(i => i.severity === 'warning').length

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05]">
        <CheckCircle2 size={16} className="text-emerald-400" />
        <ProviderIcon size={16} className={providerColor} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-200">
            Code Review — {state.target}
          </p>
          <div className="flex items-center gap-3 mt-0.5">
            {criticalCount > 0 && (
              <span className="text-xs text-red-400">{criticalCount} critical</span>
            )}
            {warningCount > 0 && (
              <span className="text-xs text-amber-400">{warningCount} warning{warningCount > 1 ? 's' : ''}</span>
            )}
            <span className="text-xs text-zinc-500">{result.items.length} finding{result.items.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Summary */}
      {result.summary && (
        <div className="px-4 py-3 border-b border-white/[0.05]">
          <div className="text-sm text-zinc-300 leading-relaxed">
            <MarkdownContent raw>{result.summary}</MarkdownContent>
          </div>
        </div>
      )}

      {/* Findings */}
      {result.items.length > 0 && (
        <div className="px-4 py-3 space-y-2">
          {result.items.map((item, i) => (
            <ReviewItem key={i} item={item} />
          ))}
        </div>
      )}

      {/* Raw output fallback */}
      {result.items.length === 0 && result.rawOutput && (
        <div className="px-4 py-3">
          <div className="text-sm text-zinc-300 leading-relaxed">
            <MarkdownContent raw>{result.rawOutput}</MarkdownContent>
          </div>
        </div>
      )}
    </div>
  )
}
