import { EventSource } from 'eventsource'
import { logger } from '../lib/logger.js'
import { getOpenCodeUrl, sendPromptAsync, getSessionMessages } from './client.js'

/**
 * Simple OpenCode SSE streaming.
 * Send prompt → track user message IDs → stream assistant text parts → session idle → done.
 */

export interface StreamCallbacks {
  /** Called for each text chunk from the assistant */
  onToken: (text: string) => void
  /** Called for tool calls (optional) */
  onToolCall?: (name: string, callId: string, input: unknown) => void
  /** Called when streaming is complete with the full text */
  onDone: (fullText: string) => void
  /** Called on error */
  onError: (err: Error) => void
}

export async function streamOpenCode(
  sessionId: string,
  prompt: string,
  callbacks: StreamCallbacks,
  opts?: { timeoutMs?: number }
): Promise<() => void> {
  const openCodeUrl = getOpenCodeUrl()
  const es = new EventSource(`${openCodeUrl}/global/event`)

  const userMsgIds = new Set<string>()
  const partLengths = new Map<string, number>()
  let fullText = ''
  let done = false
  let promptSent = false
  let sseReady = false

  const finish = () => {
    if (done) return
    done = true
    clearTimeout(timeout)
    es.close()
  }

  const finishWithFallback = async () => {
    if (done) return

    // If we got streaming content, we're good
    if (fullText) {
      finish()
      callbacks.onDone(fullText)
      return
    }

    // Fallback: fetch messages directly (streaming may have missed them)
    try {
      const msgs = await getSessionMessages(sessionId)
      for (let i = msgs.length - 1; i >= 0; i--) {
        const msg = msgs[i]
        if (msg.info?.role !== 'assistant') continue
        if (userMsgIds.size > 0 && !isAfterUserMsg(msg, msgs, userMsgIds)) continue
        for (const part of msg.parts || []) {
          if (part.type === 'text' && part.text) {
            const sent = partLengths.get(part.id) || 0
            if (part.text.length > sent) {
              const delta = part.text.slice(sent)
              partLengths.set(part.id, part.text.length)
              fullText += delta
              callbacks.onToken(delta)
            }
          }
        }
        break
      }
    } catch {
      // ignore fetch errors
    }

    finish()
    callbacks.onDone(fullText)
  }

  const timeout = setTimeout(() => {
    if (!done) finishWithFallback()
  }, opts?.timeoutMs ?? 60_000)

  // Set ALL handlers before waiting for connection
  es.onmessage = (e: any) => {
    if (done) return
    try {
      const raw = JSON.parse(e.data)
      const payload = raw.payload || raw
      const type = payload.type
      const props = payload.properties
      if (!type || !props) return

      // Track user/assistant messages by role
      if (type === 'message.created' || type === 'message.updated') {
        const info = props.info
        if (!info || info.sessionID !== sessionId) return
        if (info.role === 'user') userMsgIds.add(info.id)
      }

      // Stream assistant text parts
      if (type === 'message.part.updated') {
        const part = props.part
        if (!part || part.sessionID !== sessionId) return
        if (userMsgIds.has(part.messageID)) return // skip user echo

        if (part.type === 'text' && part.text) {
          const sent = partLengths.get(part.id) || 0
          if (part.text.length > sent) {
            const delta = part.text.slice(sent)
            partLengths.set(part.id, part.text.length)
            fullText += delta
            callbacks.onToken(delta)
          }
        }

        if (part.type === 'tool' && callbacks.onToolCall) {
          callbacks.onToolCall(part.tool || 'unknown', part.callID, part.state?.input)
        }
      }

      // Session idle → done
      if (type === 'session.status') {
        const sid = props.sessionID
        if (sid !== sessionId || !promptSent) return
        const status = props.status?.type || props.status
        if (status === 'idle' || status === 'completed' || status === 'error') {
          finishWithFallback()
        }
      }

      if (type === 'session.idle') {
        const sid = props.sessionID
        if (sid !== sessionId || !promptSent) return
        finishWithFallback()
      }

      if (type === 'session.updated') {
        const info = props.info
        if (!info || info.id !== sessionId || !promptSent) return
        if (info.status === 'idle' || info.status === 'completed') {
          finishWithFallback()
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  es.onerror = () => {
    if (done) es.close()
  }

  // Wait for SSE connection before sending prompt
  if (!sseReady) {
    await new Promise<void>((resolve) => {
      const origOnOpen = es.onopen
      es.onopen = (...args: any[]) => {
        sseReady = true
        if (origOnOpen) (origOnOpen as any)(...args)
        resolve()
      }
      // Fallback in case onopen already fired
      setTimeout(() => resolve(), 2000)
    })
  }

  // Send the prompt — set promptSent AFTER the call resolves
  // to avoid stale session.updated idle events closing the stream early
  try {
    await sendPromptAsync(sessionId, prompt)
    promptSent = true
  } catch (err) {
    finish()
    callbacks.onError(err instanceof Error ? err : new Error(String(err)))
  }

  // Return cleanup function
  return () => {
    finish()
  }
}

/** Check if an assistant message comes after any tracked user message in the list */
function isAfterUserMsg(
  assistantMsg: any,
  allMsgs: any[],
  userMsgIds: Set<string>
): boolean {
  const aIdx = allMsgs.indexOf(assistantMsg)
  for (let i = aIdx - 1; i >= 0; i--) {
    if (userMsgIds.has(allMsgs[i].info?.id)) return true
  }
  return false
}
