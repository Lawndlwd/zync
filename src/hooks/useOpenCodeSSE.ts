import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useOpenCodeStore } from '@/store/opencode'

/**
 * Global SSE hook — mounts at app layout level.
 * Listens to OpenCode events, feeds streaming store, invalidates caches, logs usage.
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

  const finishStreamingForSession = useCallback((sessionId: string) => {
    // Guard: only run once — set isStreaming false immediately to block duplicate events
    const store = useOpenCodeStore.getState()
    if (!store.isStreaming) return
    store.setIsStreaming(false)
    // Refetch final messages, THEN clear streamingMessage (prevents blink)
    queryClient.refetchQueries({ queryKey: ['opencode', 'messages', sessionId] }).finally(() => {
      useOpenCodeStore.getState().finishStreaming()
    })
    fetch('/api/opencode/log-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {})
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
        const type = data.type as string
        if (!type) return

        const store = useOpenCodeStore.getState()
        const { isStreaming, streamingMessage: sm } = store

        // --- session.idle — OpenCode signals session is done ---
        if (type === 'session.idle') {
          const sid = data.properties?.sessionID || data.properties?.id
          invalidate(['opencode', 'sessions'])
          if (isStreaming && sm && sid === sm.sessionId) {
            finishStreamingForSession(sid)
          } else if (sid) {
            fetch('/api/opencode/log-usage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: sid }),
            }).catch(() => {})
          }
          return
        }

        // --- session.status — status changes (idle, busy, error) ---
        if (type === 'session.status') {
          const props = data.properties
          const sid = props?.sessionID || props?.id
          const status = props?.status?.type || props?.status
          invalidate(['opencode', 'sessions'])
          if (isStreaming && sm && sid === sm.sessionId && (status === 'idle' || status === 'error')) {
            finishStreamingForSession(sid)
          }
          return
        }

        // --- session.updated / session.created / session.deleted ---
        if (type === 'session.updated' || type === 'session.created' || type === 'session.deleted') {
          invalidate(['opencode', 'sessions'])

          if (type === 'session.updated') {
            const info = data.properties?.info
            const sid = info?.id
            const status = info?.status
            if (isStreaming && sm && sid === sm.sessionId && (status === 'idle' || status === 'completed' || status === 'error')) {
              finishStreamingForSession(sid)
            } else if (!isStreaming && sid) {
              fetch('/api/opencode/log-usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: sid }),
              }).catch(() => {})
            }
          }
          return
        }

        // --- message.created / message.updated ---
        if (type === 'message.created' || type === 'message.updated') {
          const info = data.properties?.info
          const sessionId = info?.sessionID
          if (isStreaming && sm && sessionId === sm.sessionId) {
            if (info?.role === 'user' && info?.id) {
              useOpenCodeStore.getState().trackUserMsgId(info.id)
            }
          } else if (sessionId) {
            invalidate(['opencode', 'messages', sessionId])
          }
          return
        }

        // --- message.part.updated — streaming text/tool parts ---
        if (type === 'message.part.updated') {
          const part = data.properties?.part
          const sessionId = part?.sessionID

          if (isStreaming && sm && sessionId === sm.sessionId) {
            if (sm.userMsgIds.has(part?.messageID)) return

            if (part?.type === 'text' && part.text) {
              useOpenCodeStore.getState().appendStreamingText(part.id, part.text)
            } else if (part?.type === 'tool') {
              useOpenCodeStore.getState().addStreamingToolCall({
                type: 'tool-invocation',
                toolInvocation: {
                  id: part.callID || part.id,
                  toolName: part.tool || 'unknown',
                  args: typeof part.state?.input === 'string'
                    ? (() => { try { return JSON.parse(part.state.input) } catch { return {} } })()
                    : (part.state?.input || {}),
                  state: part.state?.status === 'completed' || part.state?.status === 'error' ? 'result' : 'call',
                  result: part.state?.output ?? part.state?.error,
                },
              })
            }
            return
          }

          if (sessionId) invalidate(['opencode', 'messages', sessionId])
          return
        }

        // --- message.part.delta — incremental deltas (newer API) ---
        if (type === 'message.part.delta') {
          const props = data.properties
          const sessionId = props?.sessionID
          if (isStreaming && sm && sessionId === sm.sessionId) {
            if (props?.field === 'text' && props?.delta) {
              useOpenCodeStore.getState().appendStreamingDelta(props.partID, props.delta)
            }
            return
          }
          if (sessionId) invalidate(['opencode', 'messages', sessionId])
          return
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
  }, [serverUrl, reconnectCount, invalidate, setConnectionStatus, queryClient, finishStreamingForSession])

  const prevConnected = useRef(connected)
  useEffect(() => {
    if (connected && !prevConnected.current && !eventSourceRef.current) {
      setReconnectCount((c) => c + 1)
    }
    prevConnected.current = connected
  }, [connected])
}
