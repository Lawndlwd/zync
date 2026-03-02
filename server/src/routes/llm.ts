import { Router } from 'express'
import { getOrCreateSession, sendPromptAsync, getSessionMessages, getOpenCodeUrl } from '../opencode/client.js'
import { insertLLMCall } from '../bot/memory/activity.js'
import { assembleContext, buildSystemPrompt } from '../agent/context.js'
import { EventSource } from 'eventsource'

export const llmRouter = Router()

// Non-streaming chat — send prompt, poll for result
llmRouter.post('/chat', async (req, res) => {
  const startTime = Date.now()
  try {
    const { messages } = req.body
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user')
    if (!lastUserMsg) {
      return res.status(400).json({ error: 'No user message found' })
    }

    const sessionId = await getOrCreateSession('chat')

    const ctx = assembleContext(lastUserMsg.content, 'web', 'dashboard')
    const systemPrompt = buildSystemPrompt(ctx)
    const fullPrompt = `${systemPrompt}\n\n---\n\nUser message:\n${lastUserMsg.content}`

    await sendPromptAsync(sessionId, fullPrompt)

    const text = await pollForReply(sessionId, 60_000)

    insertLLMCall({
      source: 'chat',
      model: 'opencode',
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      tool_names: [],
      duration_ms: Date.now() - startTime,
    })

    res.json({ content: text, usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

async function pollForReply(sessionId: string, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500))
    const msgs = await getSessionMessages(sessionId)
    const assistantMsgs = msgs.filter((m: any) => m.info?.role === 'assistant')
    // First 2 are tools + prompt echo, real answer is 3rd+
    if (assistantMsgs.length < 3) continue
    const last = assistantMsgs[assistantMsgs.length - 1]
    if (last?.parts) {
      const texts = last.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text)
      if (texts.length > 0 && texts.some((t: string) => t.length > 0)) {
        return texts.join('')
      }
    }
  }
  throw new Error('Timeout waiting for OpenCode response')
}

// Streaming chat — send prompt async, listen to SSE for updates
//
// OpenCode flow:
//   1. First assistant message  = tool calls (forward tool_call events, text → thinking)
//   2. Second assistant message = system prompt echo (text → thinking)
//   3. Third+ assistant messages = actual response (text → token)
//
// Stream closing:
//   - Primary: session.updated with idle/completed
//   - Backup: 4s idle timer after a real message completes
//   - Fallback: 60s global timeout
llmRouter.post('/chat/stream', async (req, res) => {
  const startTime = Date.now()
  const { messages } = req.body
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user')
  if (!lastUserMsg) {
    res.status(400).json({ error: 'No user message found' })
    return
  }

  const toolNames: string[] = []
  let eventSource: EventSource | null = null

  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    const sessionId = await getOrCreateSession('chat')

    const openCodeUrl = getOpenCodeUrl()
    eventSource = new EventSource(`${openCodeUrl}/global/event`)

    const sentParts = new Set<string>()
    let done = false
    // Track first 2 assistant message IDs — both are "thinking" (tools + echo)
    const thinkingMsgIds = new Set<string>()
    let assistantMsgCount = 0
    let hasSentContent = false
    let idleTimer: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
      if (eventSource) { eventSource.close(); eventSource = null }
    }

    const finishStream = () => {
      if (done) return
      done = true
      clearTimeout(timeout)
      if (!hasSentContent) {
        getSessionMessages(sessionId).then((msgs) => {
          const assistantMsgs = msgs.filter((m: any) => m.info?.role === 'assistant')
          // Skip first 2 (tools + echo), take the rest
          for (let i = 2; i < assistantMsgs.length; i++) {
            const msg = assistantMsgs[i]
            if (msg?.parts) {
              for (const part of msg.parts) {
                if (part.type === 'text' && part.text) {
                  res.write(`data: ${JSON.stringify({ type: 'token', content: part.text })}\n\n`)
                }
              }
            }
          }
          res.write('data: [DONE]\n\n')
          res.end()
          cleanup()
        }).catch(() => {
          res.write('data: [DONE]\n\n')
          res.end()
          cleanup()
        })
      } else {
        res.write('data: [DONE]\n\n')
        res.end()
        cleanup()
      }
    }

    const startIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        if (!done) finishStream()
      }, 4000)
    }

    const timeout = setTimeout(() => {
      if (!done) finishStream()
    }, 60_000)

    eventSource.onmessage = async (e: any) => {
      if (done) return

      try {
        const raw = JSON.parse(e.data)
        const payload = raw.payload || raw
        const type = payload.type
        const props = payload.properties
        if (!type || !props) return

        if (type === 'message.part.updated') {
          const part = props.part
          if (!part || part.sessionID !== sessionId) return

          // Track assistant message IDs — first 2 are thinking
          if (part.messageID && !thinkingMsgIds.has(part.messageID)) {
            assistantMsgCount++
            if (assistantMsgCount <= 2) {
              thinkingMsgIds.add(part.messageID)
            }
          }

          const isThinkingMsg = thinkingMsgIds.has(part.messageID)

          if (isThinkingMsg) {
            // First 2 messages: text → thinking, tools → forward
            if (part.type === 'text' && part.text) {
              const partKey = part.id
              if (!sentParts.has(partKey)) {
                sentParts.add(partKey)
                res.write(`data: ${JSON.stringify({ type: 'thinking', content: part.text })}\n\n`)
              }
            } else if (part.type === 'tool') {
              const toolName = part.tool || 'unknown'
              if (!toolNames.includes(toolName)) toolNames.push(toolName)
              res.write(`data: ${JSON.stringify({
                type: 'tool_call',
                toolCall: { id: part.callID, name: toolName, arguments: part.state?.input },
              })}\n\n`)
            }
          } else {
            // 3rd+ messages: real content
            if (part.type === 'text' && part.text) {
              const partKey = part.id
              if (!sentParts.has(partKey)) {
                sentParts.add(partKey)
                hasSentContent = true
                if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
                res.write(`data: ${JSON.stringify({ type: 'token', content: part.text })}\n\n`)
              }
            } else if (part.type === 'tool') {
              const toolName = part.tool || 'unknown'
              if (!toolNames.includes(toolName)) toolNames.push(toolName)
              res.write(`data: ${JSON.stringify({
                type: 'tool_call',
                toolCall: { id: part.callID, name: toolName, arguments: part.state?.input },
              })}\n\n`)
            }
          }
        } else if (type === 'message.updated') {
          const info = props.info
          if (!info || info.sessionID !== sessionId || info.role !== 'assistant') return

          if (info.time?.completed) {
            // If this is a thinking message completing, skip
            if (thinkingMsgIds.has(info.id)) return

            // A real message completed
            const msgs = await getSessionMessages(sessionId)
            const msg = msgs.find((m: any) => m.info?.id === info.id)
            if (msg?.parts) {
              for (const part of msg.parts) {
                if (part.type === 'text' && part.text && !sentParts.has(part.id)) {
                  sentParts.add(part.id)
                  hasSentContent = true
                  res.write(`data: ${JSON.stringify({ type: 'token', content: part.text })}\n\n`)
                }
              }
            }
            startIdleTimer()
          }
        } else if (type === 'session.updated') {
          const info = props.info
          if (!info || info.id !== sessionId) return
          if (info.status === 'idle' || info.status === 'completed') {
            const msgs = await getSessionMessages(sessionId)
            const assistantMsgs = msgs.filter((m: any) => m.info?.role === 'assistant')
            // Skip first 2 (thinking), send rest
            for (let i = 2; i < assistantMsgs.length; i++) {
              const msg = assistantMsgs[i]
              if (msg?.parts) {
                for (const part of msg.parts) {
                  if (part.type === 'text' && part.text && !sentParts.has(part.id)) {
                    sentParts.add(part.id)
                    hasSentContent = true
                    res.write(`data: ${JSON.stringify({ type: 'token', content: part.text })}\n\n`)
                  }
                }
              }
            }
            finishStream()
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    eventSource.onerror = () => {
      if (done) cleanup()
    }

    req.on('close', () => {
      done = true
      clearTimeout(timeout)
      cleanup()
    })

    const ctx = assembleContext(lastUserMsg.content, 'web', 'dashboard')
    const systemPrompt = buildSystemPrompt(ctx)
    const fullPrompt = `${systemPrompt}\n\n---\n\nUser message:\n${lastUserMsg.content}`

    await sendPromptAsync(sessionId, fullPrompt)
  } catch (err: any) {
    if (eventSource) eventSource.close()
    if (!res.headersSent) {
      res.status(500).json({ error: err.message })
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    }
  } finally {
    insertLLMCall({
      source: 'chat',
      model: 'opencode',
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      tool_names: toolNames,
      duration_ms: Date.now() - startTime,
    })
  }
})
