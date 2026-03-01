import { useMemo } from 'react'
import { Cpu, Hash, Terminal, Zap, DollarSign, ArrowDownUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useOpenCodeMessages, useSessionTokens } from '@/hooks/useOpenCode'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

interface SessionInfoProps {
  sessionId: string | null
}

export function SessionInfo({ sessionId }: SessionInfoProps) {
  const { data: messages } = useOpenCodeMessages(sessionId)
  const tokenStats = useSessionTokens(sessionId)

  const stats = useMemo(() => {
    if (!messages || messages.length === 0) {
      return { messageCount: 0, toolCallCount: 0, toolNames: [] as string[] }
    }

    const toolNamesSet = new Set<string>()
    let toolCallCount = 0

    for (const msg of messages) {
      for (const part of msg.parts) {
        if (part.type === 'tool-invocation') {
          toolCallCount++
          toolNamesSet.add(part.toolInvocation.toolName)
        }
      }
    }

    return {
      messageCount: messages.length,
      toolCallCount,
      toolNames: Array.from(toolNamesSet).sort(),
    }
  }, [messages])

  if (!sessionId) return null

  const cacheHitRate = tokenStats && tokenStats.input + tokenStats.cacheRead > 0
    ? Math.round((tokenStats.cacheRead / (tokenStats.input + tokenStats.cacheRead)) * 100)
    : 0

  return (
    <aside className="hidden xl:flex w-64 shrink-0 flex-col border-l border-white/[0.06] bg-zinc-950/50">
      <div className="px-4 py-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-600">
          Session
        </h3>
      </div>

      <Separator className="bg-white/[0.04]" />

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Session ID */}
          <div>
            <p className="text-[11px] text-zinc-600 mb-1">ID</p>
            <p
              className="font-mono text-xs text-zinc-400 truncate"
              title={sessionId}
            >
              {sessionId.slice(0, 20)}...
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Hash size={12} className="text-zinc-600" />
                <span className="text-[11px] text-zinc-600">Messages</span>
              </div>
              <p className="text-lg font-semibold text-zinc-200">
                {stats.messageCount}
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Cpu size={12} className="text-zinc-600" />
                <span className="text-[11px] text-zinc-600">Tools</span>
              </div>
              <p className="text-lg font-semibold text-zinc-200">
                {stats.toolCallCount}
              </p>
            </div>
          </div>

          {/* Token Usage */}
          {tokenStats && tokenStats.total > 0 && (
            <>
              <Separator className="bg-white/[0.04]" />

              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <Zap size={12} className="text-indigo-400" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                    Token Usage
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <span className="text-[11px] text-zinc-600">Input</span>
                    <p className="text-sm font-semibold text-zinc-200">
                      {formatTokens(tokenStats.input)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <span className="text-[11px] text-zinc-600">Output</span>
                    <p className="text-sm font-semibold text-zinc-200">
                      {formatTokens(tokenStats.output)}
                    </p>
                  </div>
                  {tokenStats.reasoning > 0 && (
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                      <span className="text-[11px] text-zinc-600">Reasoning</span>
                      <p className="text-sm font-semibold text-zinc-200">
                        {formatTokens(tokenStats.reasoning)}
                      </p>
                    </div>
                  )}
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <span className="text-[11px] text-zinc-600">Total</span>
                    <p className="text-sm font-semibold text-indigo-400">
                      {formatTokens(tokenStats.total)}
                    </p>
                  </div>
                </div>

                {/* Cache & Cost */}
                <div className="mt-3 space-y-2">
                  {cacheHitRate > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-zinc-500">
                        <ArrowDownUp size={10} />
                        Cache hit
                      </span>
                      <span className="text-emerald-400 font-medium">{cacheHitRate}%</span>
                    </div>
                  )}
                  {tokenStats.cost > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-zinc-500">
                        <DollarSign size={10} />
                        Cost
                      </span>
                      <span className="text-amber-400 font-medium">
                        ${tokenStats.cost.toFixed(4)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Models */}
                {tokenStats.models.length > 0 && (
                  <div className="mt-3">
                    <span className="text-[11px] text-zinc-600 block mb-1.5">Model</span>
                    <div className="flex flex-wrap gap-1.5">
                      {tokenStats.models.map((model) => (
                        <Badge
                          key={model}
                          className="bg-indigo-500/10 text-[11px] text-indigo-400 font-mono px-2 py-0.5"
                        >
                          {model}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Tool names */}
          {stats.toolNames.length > 0 && (
            <>
              <Separator className="bg-white/[0.04]" />
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Terminal size={12} className="text-zinc-600" />
                  <span className="text-[11px] text-zinc-600">Tools used</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {stats.toolNames.map((name) => (
                    <Badge
                      key={name}
                      className="bg-white/[0.04] text-[11px] text-zinc-400 font-mono px-2 py-0.5"
                    >
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
