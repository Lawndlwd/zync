import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useOpenCodeStore } from '@/store/opencode'

/**
 * Global SSE hook — mounts at app layout level.
 * Listens to OpenCode events, feeds streaming store, invalidates caches, logs usage.
 *
 * Completion events from OpenCode come in triples:
 *   session.status idle → session.idle → session.updated
 * We handle the FIRST one and suppress the rest via justFinishedRef.
 */
export function useOpenCodeSSE() {
  const serverUrl = useOpenCodeStore((s) => s.serverUrl)
  const connected = useOpenCodeStore((s) => s.connectionStatus.connected)
  const setConnectionStatus = useOpenCodeStore((s) => s.setConnectionStatus)
  const queryClient = useQueryClient()
  const eventSourceRef = useRef<EventSource | null>(null)
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const [reconnectCount, setReconnectCount] = useState(0)
  // Track session that just finished to suppress duplicate completion events
  const justFinishedRef = useRef<{ sessionId: string; time: number } | null>(null)

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

  const isJustFinished = useCallback((sessionId: string) => {
    const jf = justFinishedRef.current
    return jf && jf.sessionId === sessionId && Date.now() - jf.time < 3000
  }, [])

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

        // --- Completion events: session.status idle / session.idle / session.updated ---
        // OpenCode fires all three in sequence. Handle first, suppress rest.

        if (type === 'session.status') {
          const sid = data.properties?.sessionID
          const status = data.properties?.status?.type || data.properties?.status
          if (status === 'idle' || status === 'error') {
            invalidate(['opencode', 'sessions'])
            if (isStreaming && sm && sid === sm.sessionId) {
              justFinishedRef.current = { sessionId: sid, time: Date.now() }
              store.finishStreaming()
              fetch('/api/opencode/log-usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: sid }),
              }).catch(() => {})
            } else if (sid && !isJustFinished(sid)) {
              fetch('/api/opencode/log-usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: sid }),
              }).catch(() => {})
            }
          }
          return
        }

        if (type === 'session.idle') {
          const sid = data.properties?.sessionID
          invalidate(['opencode', 'sessions'])
          if (isStreaming && sm && sid === sm.sessionId) {
            justFinishedRef.current = { sessionId: sid, time: Date.now() }
            store.finishStreaming()
            fetch('/api/opencode/log-usage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: sid }),
            }).catch(() => {})
          }
          // else: suppressed — session.status already handled it, or justFinished
          return
        }

        if (type === 'session.updated' || type === 'session.created' || type === 'session.deleted') {
          invalidate(['opencode', 'sessions'])
          // Don't log usage from session.updated — session.status/session.idle handle it
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
          } else if (sessionId && !isJustFinished(sessionId)) {
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

          if (sessionId && !isJustFinished(sessionId)) {
            invalidate(['opencode', 'messages', sessionId])
          }
          return
        }

        // --- message.part.delta — incremental deltas ---
        if (type === 'message.part.delta') {
          const props = data.properties
          const sessionId = props?.sessionID
          if (isStreaming && sm && sessionId === sm.sessionId) {
            if (props?.field === 'text' && props?.delta) {
              useOpenCodeStore.getState().appendStreamingDelta(props.partID, props.delta)
            }
            return
          }
          if (sessionId && !isJustFinished(sessionId)) {
            invalidate(['opencode', 'messages', sessionId])
          }
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
  }, [serverUrl, reconnectCount, invalidate, isJustFinished, setConnectionStatus, queryClient])

  const prevConnected = useRef(connected)
  useEffect(() => {
    if (connected && !prevConnected.current && !eventSourceRef.current) {
      setReconnectCount((c) => c + 1)
    }
    prevConnected.current = connected
  }, [connected])
}
