import { useState } from 'react'
import { useMessages, useMarkAsRead, useArchiveMessage } from '@/hooks/useMessages'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { useChatStore } from '@/store/chat'
import {
  Archive,
  Check,
  Bot,
  Search,
  RefreshCw,
} from 'lucide-react'
import { relativeTime } from '@/lib/utils'

export function InboxPage() {
  const { data: messages, isLoading, isError, refetch } = useMessages()
  const markAsRead = useMarkAsRead()
  const archiveMsg = useArchiveMessage()
  const openChat = useChatStore((s) => s.openChat)
  const addMessage = useChatStore((s) => s.addMessage)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread' | 'high'>('all')

  const filtered = (messages || [])
    .filter((m) => !m.isArchived)
    .filter((m) => {
      if (filter === 'unread') return !m.isRead
      if (filter === 'high') return m.priority === 'high'
      return true
    })
    .filter(
      (m) =>
        m.sender.toLowerCase().includes(search.toLowerCase()) ||
        m.content.toLowerCase().includes(search.toLowerCase()) ||
        m.channel.toLowerCase().includes(search.toLowerCase())
    )

  const handleSummarize = () => {
    openChat()
    addMessage('user', 'Summarize my unread messages and suggest which ones need a reply.')
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Inbox</h1>
          <p className="text-base text-zinc-500">
            {messages ? `${messages.filter((m) => !m.isRead).length} unread` : 'Loading...'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" size="sm" onClick={handleSummarize}>
            <Bot size={18} />
            AI Summary
          </Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw size={18} />
          </Button>
        </div>
      </div>

      <div className="mb-4 flex gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search messages..." className="pl-9" />
        </div>
        <div className="flex gap-2">
          {(['all', 'unread', 'high'] as const).map((f) => (
            <Button key={f} variant={filter === f ? 'default' : 'ghost'} size="sm" onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : 'Priority'}
            </Button>
          ))}
        </div>
      </div>

      <ErrorBoundary>
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-full mb-1" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        {isError && (
          <Card className="p-6 text-center">
            <p className="text-base text-zinc-500">Unable to load messages. Configure message source in Settings.</p>
          </Card>
        )}
        {!isLoading && !isError && (
          <div className="space-y-3">
            {filtered.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-base text-zinc-500">No messages found</p>
              </Card>
            )}
            {filtered.map((msg) => (
              <Card
                key={msg.id}
                className={`flex items-start gap-3 p-4 transition-colors ${!msg.isRead ? 'border-indigo-500/30' : ''}`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-sm font-medium text-zinc-300">
                  {msg.sender.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-base font-medium text-zinc-200">{msg.sender}</span>
                    <span className="text-sm text-zinc-500">#{msg.channel}</span>
                    {msg.priority === 'high' && <Badge variant="danger">High</Badge>}
                    {!msg.isRead && <div className="h-2 w-2 rounded-full bg-indigo-500" />}
                  </div>
                  <p className="text-base text-zinc-400 line-clamp-2">{msg.content}</p>
                  <span className="text-sm text-zinc-600 mt-1 block">{relativeTime(msg.timestamp)}</span>
                </div>
                <div className="flex gap-2">
                  {!msg.isRead && (
                    <Button variant="ghost" size="icon" onClick={() => markAsRead.mutate(msg.id)} title="Mark as read">
                      <Check size={18} />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => archiveMsg.mutate(msg.id)} title="Archive">
                    <Archive size={18} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Draft reply"
                    onClick={() => {
                      openChat()
                      addMessage('user', `Draft a reply to this message from ${msg.sender}: "${msg.content}"`)
                    }}
                  >
                    <Bot size={18} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </ErrorBoundary>
    </div>
  )
}
