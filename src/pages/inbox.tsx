import { useState, useRef, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MarkdownContent } from '@/components/ui/markdown'
import {
  Mail, MessageSquare, Send, Loader2, Search, Sparkles,
  Clock, ChevronRight, ChevronDown, Trash2, Reply, Brain,
} from 'lucide-react'
import { streamChat, type LLMMessage } from '@/services/llm'
import { relativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

// --- Types ---

interface HistoryEntry {
  id: string
  query: string
  displayQuery: string
  answer: string
  thinkingContent: string
  toolsUsed: string[]
  timestamp: string
  isStreaming: boolean
  isThinking: boolean
}

// --- Commands ---

const COMMANDS = [
  {
    name: '/summary',
    icon: Mail,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20',
    description: 'Summarize unread emails',
    prompt: 'Show me my unread email summary',
  },
  {
    name: '/actions',
    icon: Sparkles,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/20',
    description: 'Emails needing response',
    prompt: 'Are there any emails that need my attention today?',
  },
  {
    name: '/search',
    icon: Search,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
    description: 'Search your emails',
    prompt: 'Search my emails for',
  },
  {
    name: '/reply',
    icon: Reply,
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    border: 'border-violet-400/20',
    description: 'Draft a reply',
    prompt: 'Help me reply to',
  },
] as const

function getCommandMeta(display: string) {
  return COMMANDS.find(c => display.startsWith(c.name))
}

function buildPrompt(input: string): { prompt: string; display: string } {
  const trimmed = input.trim()
  for (const cmd of COMMANDS) {
    if (trimmed.startsWith(cmd.name)) {
      const extra = trimmed.slice(cmd.name.length).trim()
      const prompt = extra
        ? `${cmd.prompt}${cmd.prompt.endsWith('for') || cmd.prompt.endsWith('to') ? '' : '.'} ${extra}`
        : cmd.prompt
      return { prompt, display: trimmed }
    }
  }
  return { prompt: trimmed, display: trimmed }
}

// --- Helpers ---

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function cleanToolPrefix(name: string): string {
  return name.replace(/^zync_/, '').replace(/_/g, ' ')
}

// --- Slash command dropup ---

function CommandDropup({
  filter,
  selectedIndex,
  onSelect,
}: {
  filter: string
  selectedIndex: number
  onSelect: (cmd: typeof COMMANDS[number]) => void
}) {
  const filtered = COMMANDS.filter(c =>
    c.name.startsWith(filter) || c.description.toLowerCase().includes(filter.slice(1))
  )

  if (filtered.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 rounded-lg border border-white/[0.08] bg-zinc-900/95 backdrop-blur-xl shadow-xl overflow-hidden z-50">
      {filtered.map((cmd, idx) => {
        const Icon = cmd.icon
        return (
          <button
            key={cmd.name}
            onMouseDown={(e) => { e.preventDefault(); onSelect(cmd) }}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors',
              idx === selectedIndex
                ? 'bg-white/[0.06]'
                : 'hover:bg-white/[0.03]',
            )}
          >
            <div className={cn('flex items-center justify-center w-7 h-7 rounded-md', cmd.bg)}>
              <Icon size={14} className={cmd.color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <code className={cn('text-sm font-semibold', cmd.color)}>{cmd.name}</code>
              </div>
              <p className="text-xs text-zinc-500 truncate">{cmd.description}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// --- Collapsible thinking section ---

function ThinkingSection({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-white/[0.04]">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 w-full px-4 py-1.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        {expanded
          ? <ChevronDown size={10} className="text-zinc-600 shrink-0" />
          : <ChevronRight size={10} className="text-zinc-600 shrink-0" />
        }
        <Brain size={10} className="text-zinc-600 shrink-0" />
        <span className="text-[10px] text-zinc-600">Agent context</span>
      </button>
      {expanded && (
        <div className="px-4 pb-2 text-[11px] text-zinc-600 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
          {content}
        </div>
      )}
    </div>
  )
}

// --- Collapsible history entry ---

function HistoryItem({
  entry,
  defaultExpanded,
}: {
  entry: HistoryEntry
  defaultExpanded: boolean
}) {
  const [collapsed, setCollapsed] = useState(!defaultExpanded)

  useEffect(() => {
    if (entry.isStreaming) setCollapsed(false)
  }, [entry.isStreaming])

  const toolNames = [...new Set(entry.toolsUsed)]
  const display = entry.displayQuery || entry.query
  const thinking = entry.thinkingContent || ''
  const cmdMeta = display.startsWith('/') ? getCommandMeta(display) : null

  return (
    <Card className="overflow-hidden !py-0 !gap-0">
      <button
        onClick={() => !entry.isStreaming && setCollapsed(v => !v)}
        className={cn(
          'flex items-center gap-2 w-full px-4 py-2.5 text-left transition-colors',
          collapsed
            ? 'hover:bg-white/[0.03]'
            : 'border-b border-white/[0.04] bg-white/[0.02]',
        )}
      >
        {collapsed
          ? <ChevronRight size={14} className="text-zinc-500 shrink-0" />
          : <ChevronDown size={14} className="text-zinc-500 shrink-0" />
        }
        {cmdMeta
          ? <cmdMeta.icon size={14} className={cn(cmdMeta.color, 'shrink-0')} />
          : <MessageSquare size={14} className="text-indigo-400 shrink-0" />
        }
        <span className="text-sm font-medium text-zinc-300 truncate">
          {cmdMeta && (
            <code className={cn(cmdMeta.color, 'mr-1.5 text-xs')}>
              {display.split(' ')[0]}
            </code>
          )}
          {display.startsWith('/')
            ? display.split(' ').slice(1).join(' ') || cmdMeta?.description
            : display
          }
        </span>

        {entry.isStreaming && (
          <Loader2 size={12} className="animate-spin text-indigo-400 shrink-0" />
        )}

        {collapsed && !entry.isStreaming && toolNames.length > 0 && (
          <span className="text-[10px] text-zinc-600 shrink-0 ml-1">
            ({toolNames.map(cleanToolPrefix).join(', ')})
          </span>
        )}

        <span className="ml-auto text-xs text-zinc-600 shrink-0 flex items-center gap-1">
          <Clock size={10} />
          {relativeTime(entry.timestamp)}
        </span>
      </button>

      {!collapsed && (
        <>
          {thinking && <ThinkingSection content={thinking} />}

          {entry.isThinking && (
            <div className="px-4 py-2 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin text-zinc-600" />
              <span className="text-xs text-zinc-600 italic">
                {entry.toolsUsed.length > 0
                  ? `Using ${cleanToolPrefix(entry.toolsUsed[entry.toolsUsed.length - 1])}...`
                  : 'Thinking...'}
              </span>
            </div>
          )}

          {!entry.isThinking && toolNames.length > 0 && (
            <div className="px-4 pt-2 flex flex-wrap gap-1.5">
              {toolNames.map((tool) => (
                <span
                  key={tool}
                  className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-zinc-600"
                >
                  <Sparkles size={8} />
                  {cleanToolPrefix(tool)}
                </span>
              ))}
            </div>
          )}

          {entry.answer && (
            <div className="px-4 py-3 text-sm text-zinc-200 leading-relaxed">
              <MarkdownContent raw>{entry.answer}</MarkdownContent>
              {entry.isStreaming && (
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-indigo-400/60 animate-pulse align-middle" />
              )}
            </div>
          )}
        </>
      )}
    </Card>
  )
}

// --- Main page ---

export function InboxPage() {
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('inbox-history')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showDropup, setShowDropup] = useState(false)
  const [dropupIndex, setDropupIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputWrapRef = useRef<HTMLDivElement>(null)

  // Show dropup when input starts with /
  useEffect(() => {
    const show = input.startsWith('/') && !input.includes(' ')
    setShowDropup(show)
    if (show) setDropupIndex(0)
  }, [input])

  // Persist history
  useEffect(() => {
    const toSave = history
      .filter(h => !h.isStreaming)
      .slice(0, 50)
      .map(h => ({ ...h, thinkingContent: '' }))
    localStorage.setItem('inbox-history', JSON.stringify(toSave))
  }, [history])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [history])

  const selectCommand = useCallback((cmd: typeof COMMANDS[number]) => {
    setInput(cmd.name + ' ')
    setShowDropup(false)
    inputRef.current?.focus()
  }, [])

  const askAgent = useCallback(async (rawInput: string) => {
    if (isLoading) return

    const { prompt, display } = buildPrompt(rawInput)
    if (!prompt) return

    const entryId = generateId()
    const entry: HistoryEntry = {
      id: entryId,
      query: prompt,
      displayQuery: display,
      answer: '',
      thinkingContent: '',
      toolsUsed: [],
      timestamp: new Date().toISOString(),
      isStreaming: true,
      isThinking: true,
    }

    setHistory(prev => [...prev, entry])
    setIsLoading(true)
    setInput('')
    setShowDropup(false)

    const llmMessages: LLMMessage[] = [
      { role: 'user', content: prompt },
    ]

    await streamChat(llmMessages, {
      onThinking: (content) => {
        setHistory(prev =>
          prev.map(h =>
            h.id === entryId
              ? { ...h, thinkingContent: h.thinkingContent + content }
              : h
          )
        )
      },
      onToken: (token) => {
        setHistory(prev =>
          prev.map(h =>
            h.id === entryId
              ? { ...h, answer: h.answer + token, isThinking: false }
              : h
          )
        )
      },
      onToolCall: (toolCall) => {
        setHistory(prev =>
          prev.map(h =>
            h.id === entryId
              ? { ...h, toolsUsed: [...h.toolsUsed, toolCall.name] }
              : h
          )
        )
      },
      onDone: () => {
        setHistory(prev =>
          prev.map(h =>
            h.id === entryId
              ? { ...h, isStreaming: false, isThinking: false }
              : h
          )
        )
        setIsLoading(false)
      },
      onError: (err) => {
        setHistory(prev =>
          prev.map(h =>
            h.id === entryId
              ? { ...h, answer: `Error: ${err.message}`, isStreaming: false, isThinking: false }
              : h
          )
        )
        setIsLoading(false)
      },
    })
  }, [isLoading])

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return
    askAgent(input.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showDropup) {
      const filtered = COMMANDS.filter(c =>
        c.name.startsWith(input) || c.description.toLowerCase().includes(input.slice(1))
      )
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setDropupIndex(i => (i - 1 + filtered.length) % filtered.length)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setDropupIndex(i => (i + 1) % filtered.length)
        return
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        if (filtered[dropupIndex]) {
          e.preventDefault()
          selectCommand(filtered[dropupIndex])
          return
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowDropup(false)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit()
    }
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem('inbox-history')
  }

  return (
    <div className="flex flex-col flex-1" style={{ height: 'calc(100vh - 4rem)', maxHeight: 'calc(100vh - 4rem)' }}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Inbox</h1>
          <p className="text-sm text-zinc-500">AI-powered email assistant</p>
        </div>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" className="text-zinc-500" onClick={clearHistory}>
            <Trash2 size={14} />
            Clear
          </Button>
        )}
      </div>

      {/* Command buttons */}
      <div className="flex flex-wrap gap-2 mb-4 shrink-0">
        {COMMANDS.map((cmd) => {
          const Icon = cmd.icon
          return (
            <Button
              key={cmd.name}
              variant="ghost"
              size="sm"
              disabled={isLoading}
              onClick={() => selectCommand(cmd)}
              className={cn('border group', cmd.border, 'text-zinc-400 hover:text-zinc-200')}
              title={cmd.description}
            >
              <Icon size={14} className={cmd.color} />
              <code className={cn('text-xs font-semibold', cmd.color)}>{cmd.name}</code>
              <span className="text-zinc-500 hidden sm:inline">{cmd.description}</span>
            </Button>
          )
        })}
      </div>

      {/* Scrollable history */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-3 pb-2">
        {history.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <Mail size={36} className="mb-3 text-zinc-700" />
            <p className="text-base text-zinc-400 mb-1">No email activity yet</p>
            <p className="text-sm text-zinc-600">
              Type <code className="text-indigo-400/70">/</code> or click a command to get started
            </p>
          </div>
        )}

        {history.map((entry, idx) => (
          <HistoryItem
            key={entry.id}
            entry={entry}
            defaultExpanded={idx === history.length - 1}
          />
        ))}
      </div>

      {/* Input bar — pinned to bottom */}
      <div ref={inputWrapRef} className="shrink-0 relative flex gap-2 pt-3 pb-1 border-t border-white/[0.06]">
        {showDropup && (
          <CommandDropup
            filter={input}
            selectedIndex={dropupIndex}
            onSelect={selectCommand}
          />
        )}
        <div className="flex-1 relative">
          {/* Color overlay — renders the colored command on top */}
          {(() => {
            const matched = COMMANDS.find(c => input.startsWith(c.name))
            if (!matched) return null
            const cmd = input.slice(0, matched.name.length)
            const rest = input.slice(matched.name.length)
            return (
              <div
                aria-hidden
                className="absolute inset-0 flex items-center pointer-events-none px-3 font-mono text-sm whitespace-pre"
              >
                <span className={cn('font-semibold', matched.color)}>{cmd}</span>
                <span className="text-zinc-200">{rest}</span>
              </div>
            )
          })()}
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (input.startsWith('/') && !input.includes(' ')) setShowDropup(true)
            }}
            onBlur={() => setTimeout(() => setShowDropup(false), 150)}
            placeholder="Type / for commands or ask anything..."
            disabled={isLoading}
            className={cn(
              'w-full font-mono text-sm',
              COMMANDS.some(c => input.startsWith(c.name)) ? 'text-transparent caret-zinc-200' : '',
            )}
          />
        </div>
        <Button size="icon" onClick={handleSubmit} disabled={!input.trim() || isLoading}>
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
      </div>
    </div>
  )
}
