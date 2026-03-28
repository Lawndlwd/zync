import { ArrowDown, Send, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useCreateSession, useOpenCodeMessages } from '@/hooks/useOpenCode'
import { cn } from '@/lib/utils'
import { sendPrompt } from '@/services/opencode'
import { useOpenCodeStore } from '@/store/opencode'
import { MessageBubble } from './MessageBubble'

export function OpenCodeChat({ initialQuery }: { initialQuery?: string } = {}) {
  const activeSessionId = useOpenCodeStore((s) => s.activeSessionId)
  const isStreaming = useOpenCodeStore((s) => s.isStreaming)
  const streamingMessage = useOpenCodeStore((s) => s.streamingMessage)
  const startStreaming = useOpenCodeStore((s) => s.startStreaming)
  const finishStreaming = useOpenCodeStore((s) => s.finishStreaming)
  const [input, setInput] = useState('')
  const [pendingUserMsg, setPendingUserMsg] = useState<string | null>(null)
  const [slashIndex, setSlashIndex] = useState(-1) // selected index in slash menu
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showScrollDown, setShowScrollDown] = useState(false)

  const { data: messages = [], isFetching } = useOpenCodeMessages(activeSessionId)
  const createSession = useCreateSession()

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handleScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
      setShowScrollDown(!atBottom)
    }
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    })
  }, [activeSessionId, messages.length])

  useEffect(() => {
    if (scrollRef.current && !showScrollDown) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingMessage?.parts, showScrollDown])

  // Focus textarea when streaming finishes
  const prevStreaming = useRef(isStreaming)
  useEffect(() => {
    if (prevStreaming.current && !isStreaming) {
      setTimeout(() => textareaRef.current?.focus(), 0)
    }
    prevStreaming.current = isStreaming
  }, [isStreaming])

  // Frozen = streaming done, content stays visible from SSE (no refetch yet)
  const isFrozen = !isStreaming && !!streamingMessage

  // Clear frozen state on session switch
  const prevSessionId = useRef(activeSessionId)
  useEffect(() => {
    if (activeSessionId !== prevSessionId.current) {
      if (isFrozen) finishStreaming()
      setPendingUserMsg(null)
      prevSessionId.current = activeSessionId
    }
  }, [activeSessionId, isFrozen, finishStreaming])

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }

  const handleSend = useCallback(async () => {
    if (!input.trim()) return
    if (isStreaming || isFrozen) finishStreaming()
    const text = input.trim()
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    let sessionId = activeSessionId

    if (!sessionId) {
      try {
        const session = await createSession.mutateAsync(undefined)
        sessionId = session.id
      } catch {
        return
      }
    }

    setPendingUserMsg(text)
    startStreaming(sessionId)

    try {
      await sendPrompt(sessionId, text)
    } catch {
      finishStreaming()
      setTimeout(() => textareaRef.current?.focus(), 0)
    }
  }, [input, isStreaming, isFrozen, activeSessionId, createSession, startStreaming, finishStreaming])

  // Programmatic send (for question card responses)
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return
      if (isStreaming) finishStreaming()

      const sessionId = activeSessionId
      if (!sessionId) return

      setPendingUserMsg(text)
      startStreaming(sessionId)

      try {
        await sendPrompt(sessionId, text)
      } catch {
        finishStreaming()
      }
    },
    [isStreaming, activeSessionId, startStreaming, finishStreaming],
  )

  // Auto-send initial query from URL param (e.g. from planner "Just ask me anything" input)
  const initialQueryHandled = useRef(false)
  useEffect(() => {
    if (initialQuery && !initialQueryHandled.current) {
      initialQueryHandled.current = true
      setInput(initialQuery)
      // Small delay to let session sync happen first
      setTimeout(() => {
        setInput(initialQuery)
        // Trigger send by setting input and calling handleSend won't work since handleSend reads stale input
        // Instead, directly use sendMessage-like logic
        const doSend = async () => {
          let sessionId = useOpenCodeStore.getState().activeSessionId
          if (!sessionId) {
            try {
              const session = await createSession.mutateAsync(undefined)
              sessionId = session.id
            } catch {
              return
            }
          }
          setPendingUserMsg(initialQuery)
          startStreaming(sessionId)
          setInput('')
          try {
            await sendPrompt(sessionId, initialQuery)
          } catch {
            finishStreaming()
          }
        }
        doSend()
      }, 500)
    }
  }, [initialQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  // Slash commands
  const slashCommands: { cmd: string; label: string; desc: string; placeholder: string }[] = []

  const slashFilter = input.startsWith('/')
    ? slashCommands.filter((c) => c.cmd.startsWith(input.split(' ')[0].toLowerCase()))
    : []
  const showSlash = slashFilter.length > 0 && !input.includes(' ')

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlash) {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashIndex((i) => (i <= 0 ? slashFilter.length - 1 : i - 1))
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashIndex((i) => (i >= slashFilter.length - 1 ? 0 : i + 1))
        return
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault()
        const pick = slashFilter[slashIndex >= 0 ? slashIndex : 0]
        if (pick) {
          setInput(`${pick.cmd} `)
          setSlashIndex(-1)
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setSlashIndex(-1)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    setSlashIndex(0)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  return (
    <>
      {/* Scrollable message area */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-8 py-6 lg:px-12">
          {messages.length === 0 && !isStreaming && !isFetching && !isFrozen && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-3xl bg-primary/10">
                <Sparkles size={24} className="text-primary" />
              </div>
              <h3 className="text-base font-medium text-foreground">
                {activeSessionId ? 'Send a message to get started' : 'Start a conversation'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeSessionId ? 'This session is empty.' : 'Select a session or type a message to create one.'}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {['Summarize my sprint', 'What are my P1 issues?', 'Create a todo for code review'].map(
                  (suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion)
                        setTimeout(() => textareaRef.current?.focus(), 0)
                      }}
                      className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      {suggestion}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <div>
              {messages.map((msg, idx) => (
                <div key={msg.id}>
                  {idx > 0 && msg.role === 'user' && <Separator className="my-5 bg-border" />}
                  <MessageBubble message={msg} onSendMessage={sendMessage} />
                </div>
              ))}
            </div>
          )}

          {pendingUserMsg && activeSessionId && (
            <div>
              {messages.length > 0 && <Separator className="my-5 bg-border" />}
              <MessageBubble
                message={{
                  id: 'pending-user',
                  sessionId: activeSessionId,
                  role: 'user',
                  parts: [{ type: 'text', text: pendingUserMsg }],
                  createdAt: new Date().toISOString(),
                }}
              />
            </div>
          )}

          {streamingMessage && streamingMessage.sessionId === activeSessionId && (
            <div>
              <MessageBubble
                message={{
                  id: 'streaming',
                  sessionId: streamingMessage.sessionId,
                  role: 'assistant',
                  parts: streamingMessage.parts,
                  createdAt: new Date().toISOString(),
                }}
                onSendMessage={sendMessage}
              />
            </div>
          )}

          {isStreaming &&
            (!streamingMessage?.parts.length ||
              streamingMessage.parts.every((p) => p.type === 'text' && p.text === '')) && (
              <div className="mt-4 flex items-center gap-2 text-muted-foreground">
                <Sparkles size={14} className="text-primary animate-pulse" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}
        </div>
      </div>

      {/* Scroll to bottom */}
      {showScrollDown && (
        <div className="absolute bottom-24 right-8 z-10">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full border-border bg-secondary backdrop-blur-sm shadow-lg hover:bg-accent"
            onClick={scrollToBottom}
          >
            <ArrowDown size={14} />
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-border px-8 py-4 lg:px-12">
        <div className="relative rounded-3xl border border-border bg-secondary focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          {/* Slash command autocomplete */}
          {showSlash && (
            <div className="absolute bottom-full left-0 right-0 mb-1 z-20">
              <div className="rounded-lg border border-border bg-card/80 backdrop-blur-[40px] shadow-xl overflow-hidden">
                {slashFilter.map((cmd, i) => (
                  <button
                    key={cmd.cmd}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setInput(`${cmd.cmd} `)
                      setSlashIndex(-1)
                      textareaRef.current?.focus()
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      (slashIndex < 0 ? i === 0 : i === slashIndex) ? 'bg-primary/15' : 'hover:bg-accent',
                    )}
                  >
                    <span className="text-sm font-mono font-medium text-primary">{cmd.label}</span>
                    <span className="text-xs text-muted-foreground">{cmd.desc}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">{cmd.placeholder}</span>
                  </button>
                ))}
                <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border text-[11px] text-muted-foreground">
                  <span>
                    <kbd className="rounded bg-muted px-1 py-0.5 font-mono">Tab</kbd> select
                  </span>
                  <span>
                    <kbd className="rounded bg-muted px-1 py-0.5 font-mono">↑↓</kbd> navigate
                  </span>
                  <span>
                    <kbd className="rounded bg-muted px-1 py-0.5 font-mono">Esc</kbd> dismiss
                  </span>
                </div>
              </div>
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            className="block w-full min-h-[44px] max-h-[200px] resize-none bg-transparent px-4 pt-3 pb-10 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            rows={1}
          />
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-end">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground select-none">Shift+Enter for newline</span>
              <Button
                size="icon"
                className="h-7 w-7 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-30 disabled:bg-muted"
                onClick={handleSend}
                disabled={!input.trim()}
              >
                <Send size={14} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
