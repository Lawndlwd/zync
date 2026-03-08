import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, Sparkles, Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkshopMessage } from '@zync/shared/types'
import * as socialService from '@/services/social'
import toast from 'react-hot-toast'

interface WorkshopChatProps {
  boardId: number
  boardName: string
  platform: string
  onNewCards: () => void
  onCardUpdated: () => void
  externalPrompt?: string | null
  onExternalPromptConsumed?: () => void
}

export function WorkshopChat({ boardId, boardName, platform, onNewCards, onCardUpdated, externalPrompt, onExternalPromptConsumed }: WorkshopChatProps) {
  const [messages, setMessages] = useState<WorkshopMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [streamingContent, setStreamingContent] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setInitialLoading(true)
    socialService.getWorkshopMessages(boardId)
      .then(setMessages)
      .catch(() => { })
      .finally(() => setInitialLoading(false))
  }, [boardId])

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, streamingContent, scrollToBottom])

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText || input).trim()
    if (!text || loading) return

    if (!overrideText) setInput('')
    const userMsg: WorkshopMessage = {
      id: Date.now(),
      board_id: boardId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)
    setStreamingContent('')

    socialService.workshopChatStream(boardId, text, boardName, platform, {
      onToken: (token) => {
        setStreamingContent((prev) => prev + token)
      },
      onCards: (cards) => {
        if (cards.length > 0) {
          onNewCards()
        }
      },
      onCardUpdated: (id) => {
        onCardUpdated()
        toast.success(`Card #${id} updated with AI notes`, { icon: '✏️' })
      },
      onDone: () => {
        setStreamingContent((prev) => {
          if (prev) {
            // Strip all structured blocks from the displayed message
            const clean = prev
              .replace(/```cards\s*\n[\s\S]*?\n```/, '')
              .replace(/```card-update\s*\n[\s\S]*?\n```/, '')
              .trim()
            const assistantMsg: WorkshopMessage = {
              id: Date.now() + 1,
              board_id: boardId,
              role: 'assistant',
              content: clean,
              created_at: new Date().toISOString(),
            }
            setMessages((msgs) => [...msgs, assistantMsg])
          }
          return ''
        })
        setLoading(false)
      },
      onError: (err) => {
        const errorMsg: WorkshopMessage = {
          id: Date.now() + 1,
          board_id: boardId,
          role: 'assistant',
          content: `Error: ${err.message || 'Failed to get response'}`,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, errorMsg])
        setStreamingContent('')
        setLoading(false)
      },
    }).catch((err) => {
      // Safety net: if the stream Promise itself rejects before any callback fires
      // (e.g. network error, session creation failure), always reset loading state.
      console.error('Workshop chat stream failed:', err)
      setStreamingContent('')
      setLoading(false)
    })
  }

  // Handle external prompt (e.g. "Discuss column")
  useEffect(() => {
    if (externalPrompt && !loading) {
      handleSend(externalPrompt)
      onExternalPromptConsumed?.()
    }
  }, [externalPrompt])

  const quickPrompts = [
    { label: 'Generate Ideas', prompt: `Generate 5 content ideas for ${platform}` },
    { label: 'Trending Topics', prompt: 'What topics are trending in my field right now?' },
    { label: 'Competitor Analysis', prompt: 'What are top creators in my space posting about?' },
    { label: 'Plan Series', prompt: 'Create a 4-week content series from the ideas on the board' },
  ]

  // Clean streaming content for display (hide structured blocks while streaming)
  const displayStreamingContent = streamingContent
    .replace(/```cards\s*\n[\s\S]*$/, '')
    .replace(/```card-update\s*\n[\s\S]*$/, '')
    .trim()

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <Bot size={16} className="text-indigo-400" />
        <h2 className="text-sm font-semibold text-zinc-200">AI Assistant</h2>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 min-h-0 mb-3">
        {initialLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={18} className="animate-spin text-zinc-500" />
          </div>
        ) : messages.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
            <Sparkles size={24} className="mb-2 text-indigo-400/50" />
            <p className="text-xs text-center">Ask me to generate ideas, research topics, or plan content</p>
            <div className="flex flex-wrap gap-1.5 mt-4 justify-center">
              {quickPrompts.map((qp) => (
                <button
                  key={qp.label}
                  onClick={() => setInput(qp.prompt)}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[10px] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.15] transition-colors"
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-2',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={12} className="text-indigo-400" />
                  </div>
                )}
                <div
                  className={cn(
                    'rounded-lg px-3 py-2 text-xs max-w-[85%]',
                    msg.role === 'user'
                      ? 'bg-indigo-600/30 text-zinc-200'
                      : 'bg-white/[0.04] text-zinc-300'
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User size={12} className="text-zinc-400" />
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* Streaming response */}
        {loading && displayStreamingContent && (
          <div className="flex gap-2 justify-start">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot size={12} className="text-indigo-400" />
            </div>
            <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-zinc-300 max-w-[85%]">
              <p className="whitespace-pre-wrap">{displayStreamingContent}</p>
            </div>
          </div>
        )}

        {/* Loading spinner (before any tokens arrive) */}
        {loading && !displayStreamingContent && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
              <Bot size={12} className="text-indigo-400" />
            </div>
            <div className="rounded-lg bg-white/[0.04] px-3 py-2">
              <Loader2 size={14} className="animate-spin text-zinc-400" />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Ask me anything..."
          disabled={loading}
          className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/50 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
