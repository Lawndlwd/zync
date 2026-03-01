import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useOpenCodeStore } from '@/store/opencode'

/**
 * Global SSE hook — mounts at app layout level.
 * Drives connection status via EventSource (no polling when connected).
 * On error, closes the EventSource — the status query's disconnect polling
 * will detect when the server is back, then bump `reconnectCount` to re-establish SSE.
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

  // Main SSE connection effect
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

        if (
          data.type === 'session.updated' ||
          data.type === 'session.created' ||
          data.type === 'session.deleted'
        ) {
          invalidate(['opencode', 'sessions'])
        }

        if (
          data.type === 'message.created' ||
          data.type === 'message.updated' ||
          data.type === 'message.part.updated'
        ) {
          const sessionId =
            data.properties?.info?.sessionID ||
            data.properties?.part?.sessionID ||
            data.properties?.sessionID
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

  // When status polling detects reconnection, bump reconnectCount to re-establish SSE
  const prevConnected = useRef(connected)
  useEffect(() => {
    if (connected && !prevConnected.current && !eventSourceRef.current) {
      setReconnectCount((c) => c + 1)
    }
    prevConnected.current = connected
  }, [connected])
}
