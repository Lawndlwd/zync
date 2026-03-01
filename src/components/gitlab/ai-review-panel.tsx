import { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePRAgent, type ChatMessage } from '@/hooks/usePRAgent'
import { useDocuments } from '@/hooks/useDocuments'
import { useOpenCodeProviders, useAgentModels, useSaveAgentModels } from '@/hooks/useOpenCode'
import { fetchDocumentsBulk } from '@/services/documents'
import { MarkdownContent } from '@/components/ui/markdown'
import { cn } from '@/lib/utils'
import { Bot, Loader2, AlertCircle, AlertTriangle, FileText, ChevronDown, ChevronRight, Search, FileCode, Sparkles, MessageCircle, Cpu } from 'lucide-react'

type PRAgentTool = 'review' | 'describe' | 'improve' | 'ask'

const TOOLS: { value: PRAgentTool; label: string; description: string; icon: typeof Search }[] = [
  { value: 'review', label: 'Review', description: 'Find bugs & security issues', icon: Search },
  { value: 'describe', label: 'Describe', description: 'Generate MR description', icon: FileCode },
  { value: 'improve', label: 'Improve', description: 'Suggest code improvements', icon: Sparkles },
  { value: 'ask', label: 'Ask', description: 'Ask about the MR', icon: MessageCircle },
]

const TOOL_COLORS: Record<PRAgentTool, { text: string; bg: string; border: string }> = {
  review: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  describe: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  improve: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  ask: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
}

const SKILLS_FOLDER = 'skills'

function HighlightOverlay({ text }: { text: string }) {
  const parts = text.split(/(\/\w+|@[\w-]+)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('/')) return <span key={i} className="text-indigo-400">{part}</span>
        if (part.startsWith('@')) return <span key={i} className="text-teal-400">{part}</span>
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function parseCommandInput(input: string, skillsDocs: { path: string; title: string }[]) {
  const toolMatch = input.match(/\/(\w+)/)
  const tool = toolMatch ? TOOLS.find(t => t.value === toolMatch[1])?.value ?? null : null
  const atMatches = [...input.matchAll(/@([\w-]+)/g)]
  const docs = atMatches
    .map(m => {
      const doc = skillsDocs.find(d => d.title.toLowerCase() === m[1].toLowerCase())
      return doc ? { path: doc.path, title: doc.title } : null
    })
    .filter((d): d is { path: string; title: string } => d !== null)
  const extra = input.replace(/\/\w+/g, '').replace(/@[\w-]+/g, '').replace(/\s+/g, ' ').trim()
  return { tool, docs, extra }
}

function CommandInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (tool: PRAgentTool, docs: { path: string; title: string }[], extra: string) => void
  disabled?: boolean
}) {
  const { data: skillsDocs = [] } = useDocuments(SKILLS_FOLDER)
  const [input, setInput] = useState('')
  const [dropdownType, setDropdownType] = useState<'slash' | 'at' | null>(null)
  const [dropdownIndex, setDropdownIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const slashQuery = useMemo(() => {
    const match = input.match(/\/(\w*)$/)
    return match ? match[1] : null
  }, [input])

  const atQuery = useMemo(() => {
    const match = input.match(/@([\w-]*)$/)
    return match ? match[1] : null
  }, [input])

  const filteredTools = useMemo(() => {
    if (slashQuery === null) return []
    return TOOLS.filter(t => t.value.startsWith(slashQuery.toLowerCase()))
  }, [slashQuery])

  const filteredDocs = useMemo(() => {
    if (atQuery === null) return []
    if (skillsDocs.length === 0) return []
    return skillsDocs.filter(d => d.title.toLowerCase().includes(atQuery.toLowerCase()))
  }, [atQuery, skillsDocs])

  const showNoRules = atQuery !== null && skillsDocs.length === 0

  useEffect(() => {
    if (slashQuery !== null && filteredTools.length > 0) {
      setDropdownType('slash')
      setDropdownIndex(0)
    } else if (atQuery !== null && (filteredDocs.length > 0 || showNoRules)) {
      setDropdownType('at')
      setDropdownIndex(0)
    } else {
      setDropdownType(null)
    }
  }, [slashQuery, atQuery, filteredTools.length, filteredDocs.length, showNoRules])

  const insertSlash = useCallback((toolValue: string) => {
    setInput(prev => prev.replace(/\/\w*$/, `/${toolValue} `))
    setDropdownType(null)
    inputRef.current?.focus()
  }, [])

  const insertAt = useCallback((docTitle: string) => {
    setInput(prev => prev.replace(/@[\w-]*$/, `@${docTitle} `))
    setDropdownType(null)
    inputRef.current?.focus()
  }, [])

  const activeDropdownItems = dropdownType === 'slash' ? filteredTools : filteredDocs

  const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({})
  useLayoutEffect(() => {
    if (!dropdownType || !inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    setPortalStyle({ position: 'fixed', left: rect.left, bottom: (window.innerHeight - rect.top) + 4, width: rect.width })
  }, [dropdownType, input])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (dropdownType && activeDropdownItems.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setDropdownIndex(i => Math.min(i + 1, activeDropdownItems.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setDropdownIndex(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        if (dropdownType === 'slash') insertSlash(filteredTools[dropdownIndex].value)
        else insertAt(filteredDocs[dropdownIndex].title)
        return
      }
      if (e.key === 'Escape') { setDropdownType(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const { tool, docs, extra } = parseCommandInput(input, skillsDocs)
      if (tool) {
        onSubmit(tool, docs, extra)
        setInput('')
      }
    }
  }

  return (
    <div>
      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center px-4 text-sm whitespace-pre overflow-hidden">
          {input ? <HighlightOverlay text={input} /> : null}
        </div>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Type /review, /describe, /improve, /ask — @ to attach rules..."
          className="flex h-11 w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 text-sm text-transparent caret-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        />
      </div>
      {dropdownType && createPortal(
        <div style={portalStyle} className="rounded-lg border border-white/[0.1] bg-[#1a1d1e]/95 backdrop-blur-md py-1 shadow-lg z-[9999]">
          {dropdownType === 'slash' && filteredTools.map((tool, i) => (
            <button
              key={tool.value}
              className={cn('flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors', i === dropdownIndex ? 'bg-indigo-600/20 text-indigo-300' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-300')}
              onMouseDown={e => { e.preventDefault(); insertSlash(tool.value) }}
              onMouseEnter={() => setDropdownIndex(i)}
            >
              <span className="font-mono text-zinc-500">/{tool.value}</span>
              <span className="text-zinc-500">{tool.description}</span>
            </button>
          ))}
          {dropdownType === 'at' && showNoRules && (
            <div className="px-4 py-3 text-sm text-zinc-500 text-center">
              No rules — add documents to the <span className="font-medium text-zinc-400">skills</span> folder
            </div>
          )}
          {dropdownType === 'at' && !showNoRules && filteredDocs.map((doc, i) => (
            <button
              key={doc.path}
              className={cn('flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors', i === dropdownIndex ? 'bg-teal-600/20 text-teal-300' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-300')}
              onMouseDown={e => { e.preventDefault(); insertAt(doc.title) }}
              onMouseEnter={() => setDropdownIndex(i)}
            >
              <FileText size={14} className="shrink-0 text-teal-500" />
              <span>@{doc.title}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

/** A single chat message — collapsible */
function ChatBubble({ msg, currentHeadSha, defaultExpanded }: { msg: ChatMessage; currentHeadSha?: string; defaultExpanded?: boolean }) {
  const [collapsed, setCollapsed] = useState(!defaultExpanded)
  const toolInfo = TOOLS.find(t => t.value === msg.tool)
  const Icon = toolInfo?.icon ?? Search
  const colors = TOOL_COLORS[msg.tool]
  const isOutdated = currentHeadSha !== undefined && msg.headSha !== currentHeadSha

  const timeStr = useMemo(() => {
    try {
      const d = new Date(msg.createdAt)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch { return '' }
  }, [msg.createdAt])

  const dateStr = useMemo(() => {
    try {
      const d = new Date(msg.createdAt)
      const today = new Date()
      if (d.toDateString() === today.toDateString()) return 'Today'
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    } catch { return '' }
  }, [msg.createdAt])

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg', colors.bg)}>
        <Icon size={16} className={colors.text} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={() => setCollapsed(v => !v)}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          >
            <span className={cn('text-sm font-medium', colors.text)}>/{msg.tool}</span>
            {collapsed
              ? <ChevronRight size={14} className="text-zinc-500" />
              : <ChevronDown size={14} className="text-zinc-500" />
            }
          </button>
          <span className="text-xs text-zinc-600">{dateStr} {timeStr}</span>
          {isOutdated && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <AlertTriangle size={11} />
              outdated
            </span>
          )}
        </div>

        {!collapsed && (
          <div className={cn('rounded-lg border px-4 py-3', colors.border, 'bg-white/[0.02]')}>
            <div className="prose-docs text-[0.9rem] text-zinc-200">
              <MarkdownContent raw>{msg.result.rawOutput || msg.result.summary}</MarkdownContent>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface AIReviewPanelProps {
  projectId: number
  mrIid: number
  mrWebUrl: string
  headSha?: string
}

export function AIReviewPanel({ projectId, mrIid, mrWebUrl, headSha }: AIReviewPanelProps) {
  const { isRunning, runningTool, status, streamContent, messages, error, debugInfo, run } = usePRAgent(projectId, mrIid, mrWebUrl, headSha)
  const { data: providers } = useOpenCodeProviders()
  const { data: agentModels } = useAgentModels()
  const saveAgentModels = useSaveAgentModels()
  const [showDebug, setShowDebug] = useState<'off' | 'instructions' | 'prompt'>('off')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive or stream updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamContent])

  const handleSubmit = async (tool: PRAgentTool, docs: { path: string; title: string }[], extra: string) => {
    let combinedInstructions = extra
    if (docs.length > 0) {
      const fullDocs = await fetchDocumentsBulk(docs.map(d => d.path))
      const rulesBlock = fullDocs.map(d => `## ${d.title}\n${d.content}`).join('\n\n')
      const rulesSection = `=== Attached Rules ===\n${rulesBlock}\n=== End Rules ===`
      combinedInstructions = combinedInstructions ? `${rulesSection}\n\n${combinedInstructions}` : rulesSection
    }
    run(tool, {
      question: tool === 'ask' ? extra : undefined,
      extraInstructions: combinedInstructions || undefined,
    })
  }

  const hasDebug = debugInfo && (debugInfo.extraInstructions || debugInfo.prompts.length > 0)
  const runningColors = runningTool ? TOOL_COLORS[runningTool] : TOOL_COLORS.review

  return (
    <div className="flex flex-col h-full">
      {/* Chat history */}
      <div className={`flex-1 overflow-y-auto pb-4 ${messages.length === 0 && !isRunning ? 'flex items-center justify-center' : 'space-y-4'}`}>
        {messages.length === 0 && !isRunning && (
          <div className="flex flex-col items-center text-zinc-500">
            <Bot size={40} className="mb-3 text-zinc-600" />
            <p className="text-sm">Run a command to start</p>
            <p className="text-xs text-zinc-600 mt-1">Type /review, /describe, /improve, or /ask</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatBubble key={msg.id} msg={msg} currentHeadSha={headSha} defaultExpanded={i === messages.length - 1} />
        ))}

        {/* Active run */}
        {isRunning && (
          <div className="flex gap-3">
            <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg', runningColors.bg)}>
              <Loader2 size={16} className={cn('animate-spin', runningColors.text)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('text-sm font-medium', runningColors.text)}>/{runningTool}</span>
                {status && <span className="text-xs text-zinc-500">{status}</span>}
              </div>
              {streamContent && (
                <div className={cn('rounded-lg border px-4 py-3', runningColors.border, 'bg-white/[0.02]')}>
                  <div className="prose-docs text-[0.9rem] text-zinc-200">
                    <MarkdownContent raw>{streamContent}</MarkdownContent>
                  </div>
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-indigo-400 animate-pulse" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
              <AlertCircle size={16} className="text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Debug panel */}
      {hasDebug && (
        <div className="border-t border-white/[0.06] pt-3 pb-2 space-y-2 max-h-80 overflow-y-auto">
          <div className="flex items-center gap-3 sticky top-0 bg-[#0a0a0a] z-10 pb-1">
            {debugInfo.extraInstructions && (
              <button
                onClick={() => setShowDebug(v => v === 'instructions' ? 'off' : 'instructions')}
                className={cn('text-xs font-mono px-2 py-1 rounded transition-colors', showDebug === 'instructions' ? 'bg-white/[0.08] text-zinc-300' : 'text-zinc-500 hover:text-zinc-300')}
              >
                extra_instructions ({debugInfo.extraInstructions.length} chars)
              </button>
            )}
            {debugInfo.prompts.length > 0 && (
              <button
                onClick={() => setShowDebug(v => v === 'prompt' ? 'off' : 'prompt')}
                className={cn('text-xs font-mono px-2 py-1 rounded transition-colors', showDebug === 'prompt' ? 'bg-white/[0.08] text-zinc-300' : 'text-zinc-500 hover:text-zinc-300')}
              >
                LLM prompt ({debugInfo.prompts.length} call{debugInfo.prompts.length > 1 ? 's' : ''})
              </button>
            )}
          </div>
          {showDebug === 'instructions' && debugInfo.extraInstructions && (
            <pre className="max-h-48 overflow-auto rounded-lg border border-white/[0.08] bg-black/30 p-3 text-xs text-zinc-400 whitespace-pre-wrap break-words">
              {debugInfo.extraInstructions}
            </pre>
          )}
          {showDebug === 'prompt' && debugInfo.prompts.map((p, i) => (
            <div key={i} className="rounded-lg border border-white/[0.08] bg-black/30 p-3 space-y-2">
              <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
                <span>model: {p.model}</span>
                <span>temp: {p.temperature}</span>
                <span>system: {p.system_length} chars</span>
                <span>user: {p.user_length} chars</span>
              </div>
              {debugInfo.fullSystem.length > 0 && (
                <details>
                  <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">System prompt (full)</summary>
                  <pre className="mt-2 max-h-60 overflow-auto text-xs text-zinc-400 whitespace-pre-wrap break-words">{debugInfo.fullSystem.join('\n')}</pre>
                </details>
              )}
              {debugInfo.fullUser.length > 0 && (
                <details>
                  <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">User prompt (full)</summary>
                  <pre className="mt-2 max-h-60 overflow-auto text-xs text-zinc-400 whitespace-pre-wrap break-words">{debugInfo.fullUser.join('\n')}</pre>
                </details>
              )}
              {debugInfo.fullSystem.length === 0 && (
                <div className="space-y-2">
                  <div><span className="text-xs text-zinc-500 font-mono">system:</span><pre className="mt-1 text-xs text-zinc-400 whitespace-pre-wrap">{p.system}</pre></div>
                  <div><span className="text-xs text-zinc-500 font-mono">user:</span><pre className="mt-1 text-xs text-zinc-400 whitespace-pre-wrap">{p.user}</pre></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Model selector + Command input — pinned to bottom */}
      <div className="border-t border-white/[0.06] pt-3 space-y-2">
        <div className="flex items-center gap-2">
          <Cpu size={14} className="shrink-0 text-zinc-500" />
          <select
            value={agentModels?.prAgent?.model ?? ''}
            onChange={(e) => {
              const model = e.target.value
              saveAgentModels.mutate(
                model ? { prAgent: { model } } : {},
              )
            }}
            disabled={saveAgentModels.isPending || isRunning}
            className="h-7 rounded-md border border-white/[0.1] bg-white/[0.04] px-2 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          >
            <option value="">Default model</option>
            {(providers ?? []).flatMap((p) =>
              p.models.map((m) => (
                <option key={`${p.id}/${m.id}`} value={`${p.id}/${m.id}`}>
                  {p.name || p.id} / {m.name || m.id}
                </option>
              ))
            )}
          </select>
          {agentModels?.prAgent?.model && (
            <span className="text-[11px] text-zinc-500 truncate">
              {agentModels.prAgent.model}
            </span>
          )}
        </div>
        <CommandInput onSubmit={handleSubmit} disabled={isRunning} />
      </div>
    </div>
  )
}
