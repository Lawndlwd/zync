import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useOpenCodeStore } from '@/store/opencode'

/**
 * Global SSE hook — mounts at app layout level.
 * Listens to OpenCode events, invalidates react-query caches, logs usage.
 */
export function useOpenCodeSSE() {
  const serverUrl = useOpenCodeStore((s) => s.serverUrl)
  const connected = useOpenCodeStore((s) => s.connectionStatus.connected)
  const setConnectionStatus = useOpenCodeStore((s) => s.setConnectionStatus)
  const queryClient = useQueryClient()
  const eventSourceRef = useRef<EventSource | null>(null)
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const [reconnectCount, setReconnectCount] = useState(0)

  const invalidate = useCallback((key: string[]) => {
    const cacheKey = key.join('/')
    if (debounceTimers.current[cacheKey]) {
      clearTimeout(debounceTimers.current[cacheKey])
    }
    debounceTimers.current[cacheKey] = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: key })
      delete debounceTimers.current[cacheKey]
    }, 500)
  }, [queryClient])

  useEffect(() => {
    const eventSource = new EventSource(`${serverUrl}/global/event`)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setConnectionStatus({ connected: true, serverUrl })
      queryClient.setQueryData(['opencode', 'status', serverUrl], {
        connected: true,
        serverUrl,
      })
    }

    eventSource.onmessage = (e) => {
      try {
        const raw = JSON.parse(e.data)
        const data = raw.payload || raw
        const store = useOpenCodeStore.getState()
        const { isStreaming, streamingMessage: sm } = store

        // --- session events ---
        if (
          data.type === 'session.updated' ||
          data.type === 'session.created' ||
          data.type === 'session.deleted'
        ) {
          invalidate(['opencode', 'sessions'])

          if (data.type === 'session.updated') {
            const info = data.properties?.info
            const sid = info?.id

            if (isStreaming && sm && sid === sm.sessionId && (info?.status === 'idle' || info?.status === 'completed')) {
              useOpenCodeStore.getState().finishStreaming()
              // Immediately invalidate messages (no debounce) so final state loads
              queryClient.invalidateQueries({ queryKey: ['opencode', 'messages', sid] })
              if (sid) {
                fetch('/api/opencode/log-usage', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId: sid }),
                }).catch(() => {})
              }
            } else if (!isStreaming && sid) {
              fetch('/api/opencode/log-usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: sid }),
              }).catch(() => {})
            }
          }
        }

        // --- message created / updated ---
        if (data.type === 'message.created' || data.type === 'message.updated') {
          const info = data.properties?.info
          const sessionId = info?.sessionID
          if (isStreaming && sm && sessionId === sm.sessionId) {
            if (info?.role === 'user' && info?.id) {
              useOpenCodeStore.getState().trackUserMsgId(info.id)
            }
            // Don't invalidate message queries during streaming
          } else if (sessionId) {
            invalidate(['opencode', 'messages', sessionId])
          }
        }

        // --- message part updated ---
        if (data.type === 'message.part.updated') {
          const part = data.properties?.part
          const sessionId = part?.sessionID

          if (isStreaming && sm && sessionId === sm.sessionId) {
            // Skip user echo parts
            if (sm.userMsgIds.has(part?.messageID)) return

            if (part?.type === 'text' && part.text) {
              useOpenCodeStore.getState().appendStreamingText(part.id, part.text)
            } else if (part?.type === 'tool') {
              const toolState = part.state?.status === 'running' ? 'call'
                : part.state?.status === 'error' ? 'result'
                : part.state?.status === 'completed' ? 'result'
                : 'call'
              useOpenCodeStore.getState().addStreamingToolCall({
                type: 'tool-invocation',
                toolInvocation: {
                  id: part.callID || part.id,
                  toolName: part.tool || 'unknown',
                  args: typeof part.state?.input === 'string'
                    ? (() => { try { return JSON.parse(part.state.input) } catch { return {} } })()
                    : (part.state?.input || {}),
                  state: toolState,
                  result: part.state?.output ?? part.state?.error,
                },
              })
            }
            // Don't invalidate during streaming
            return
          }

          // Not streaming — invalidate as before
          if (sessionId) {
            invalidate(['opencode', 'messages', sessionId])
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    eventSource.onerror = () => {
      setConnectionStatus({ connected: false, serverUrl, error: 'Connection lost' })
      queryClient.setQueryData(['opencode', 'status', serverUrl], {
        connected: false,
        serverUrl,
        error: 'Connection lost',
      })
      eventSource.close()
      eventSourceRef.current = null
    }

    return () => {
      eventSource.close()
      eventSourceRef.current = null
      for (const timer of Object.values(debounceTimers.current)) {
        clearTimeout(timer)
      }
      debounceTimers.current = {}
    }
  }, [serverUrl, reconnectCount, invalidate, setConnectionStatus, queryClient])

  const prevConnected = useRef(connected)
  useEffect(() => {
    if (connected && !prevConnected.current && !eventSourceRef.current) {
      setReconnectCount((c) => c + 1)
    }
    prevConnected.current = connected
  }, [connected])
}
