import { Bot, Send, Trash2, User, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MarkdownContent } from '@/components/ui/markdown'
import { useAIAgent } from '@/hooks/useAIAgent'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/store/chat'

export function ChatPanel() {
  const { messages, isOpen, isLoading } = useChatStore()
  const closeChat = useChatStore((s) => s.closeChat)
  const clearMessages = useChatStore((s) => s.clearMessages)
  const { sendMessage } = useAIAgent()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    sendMessage(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSend()
    }
  }

  return (
    <div
      className={cn(
        'fixed right-0 top-0 z-50 flex h-screen w-96 flex-col border-l border-border bg-card/80 backdrop-blur-[40px] shadow-ambient-lg transition-transform duration-300',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Bot size={20} className="text-primary" />
          <span className="text-base font-semibold text-foreground">AI Agent</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={clearMessages} title="Clear chat">
            <Trash2 size={18} />
          </Button>
          <Button variant="ghost" size="icon" onClick={closeChat}>
            <X size={18} />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Bot size={32} className="mb-3 text-muted-foreground" />
            <p className="text-base">Ask me about your Jira issues, to-dos, or sprint.</p>
            <p className="mt-1 text-sm text-muted-foreground">All tools are available automatically via OpenCode</p>
            <div className="mt-4 space-y-2">
              {['Summarize my sprint', 'What are my P1 issues?', 'Create a todo for code review'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  className="block w-full rounded-lg bg-secondary px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20">
                <Bot size={18} className="text-primary" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[80%] rounded-xl px-4 py-2 text-base overflow-hidden',
                msg.role === 'user' ? 'bg-primary text-white' : 'bg-secondary text-foreground',
              )}
            >
              {msg.role === 'assistant' ? (
                <MarkdownContent raw>{msg.content}</MarkdownContent>
              ) : (
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              )}
              {msg.isStreaming && <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary animate-pulse" />}
            </div>
            {msg.role === 'user' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                <User size={18} className="text-foreground" />
              </div>
            )}
          </div>
        ))}
        {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20">
              <Bot size={18} className="text-primary" />
            </div>
            <div className="flex gap-2 rounded-xl bg-secondary px-4 py-4">
              <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.1s]" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.2s]" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex gap-3">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything..."
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <Button size="icon" onClick={handleSend} disabled={!input.trim() || isLoading}>
            <Send size={18} />
          </Button>
        </div>
      </div>
    </div>
  )
}
