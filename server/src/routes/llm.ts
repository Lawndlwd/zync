import { Router } from 'express'
import { errorResponse } from '../lib/errors.js'
import { getOrCreateSession, sendPromptAsync, getSessionMessages, getOpenCodeUrl } from '../opencode/client.js'
import { insertLLMCall } from '../bot/memory/activity.js'
import { assembleContext, buildSystemPrompt } from '../agent/context.js'
import { EventSource } from 'eventsource'
import { validate } from '../lib/validate.js'
import { LlmChatSchema } from '../lib/schemas.js'

export const llmRouter = Router()

// Non-streaming chat — send prompt, poll for result
llmRouter.post('/chat', validate(LlmChatSchema), async (req, res) => {
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

    const promptSnippet = 'User message:\n' + lastUserMsg.content
    const text = await pollForReply(sessionId, 60_000, promptSnippet)

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
  } catch (err) {
    errorResponse(res, err)
  }
})

async function pollForReply(sessionId: string, timeoutMs: number, promptSnippet?: string): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500))
    const msgs = await getSessionMessages(sessionId)
    const assistantMsgs = msgs.filter((m: any) => m.info?.role === 'assistant')
    if (assistantMsgs.length < 2) continue
    // Find the last non-echo assistant message
    for (let i = assistantMsgs.length - 1; i >= 0; i--) {
      const msg = assistantMsgs[i]
      if (!msg?.parts) continue
      const isEcho = promptSnippet && msg.parts.some((p: any) =>
        p.type === 'text' && p.text && p.text.includes(promptSnippet)
      )
      if (isEcho) continue
      const texts = msg.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text)
      if (texts.length > 0 && texts.some((t: string) => t.length > 0)) {
        return texts.join('')
      }
    }
  }
  throw new Error('Timeout waiting for OpenCode response')
}

// Streaming chat — send prompt async, listen to SSE for updates
//
// OpenCode flow (variable number of assistant messages):
//   - System prompt echo: text contains the injected prompt → thinking
//   - Tool call messages: tool parts → forward as tool_call events
//   - Actual response: text that is NOT the echo → token
//
// Detection: instead of counting messages (fragile), we check if text
// content matches the sent prompt to identify the echo.
//
// Stream closing:
//   - Primary: session.updated with idle/completed
//   - Backup: 4s idle timer after a real message completes
//   - Fallback: 60s global timeout
llmRouter.post('/chat/stream', validate(LlmChatSchema), async (req, res) => {
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
    // Track message IDs that are echo/thinking (detected by content matching)
    const thinkingMsgIds = new Set<string>()
    let hasSentContent = false
    let hasSeenEcho = false
    let idleTimer: ReturnType<typeof setTimeout> | null = null
    // Will be set after prompt is sent, used to detect echo messages
    let sentPromptSnippet = ''

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
          // Send non-echo messages as tokens
          for (const msg of assistantMsgs) {
            if (msg?.parts) {
              const isEcho = msg.parts.some((p: any) =>
                p.type === 'text' && p.text && sentPromptSnippet && p.text.includes(sentPromptSnippet)
              )
              if (isEcho) continue
              // Skip tool-only messages
              const hasText = msg.parts.some((p: any) => p.type === 'text' && p.text)
              if (!hasText) continue
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
      }, 1500)
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

          // Detect echo messages by checking if text contains the sent prompt
          if (part.messageID && !thinkingMsgIds.has(part.messageID)) {
            if (part.type === 'text' && part.text && sentPromptSnippet &&
                part.text.includes(sentPromptSnippet)) {
              thinkingMsgIds.add(part.messageID)
              hasSeenEcho = true
            }
          }

          // Before we see the echo, all messages are thinking/context
          const isThinkingMsg = thinkingMsgIds.has(part.messageID) || !hasSeenEcho

          if (part.type === 'tool') {
            // Tool calls: always forward, mark message as thinking
            if (part.messageID) thinkingMsgIds.add(part.messageID)
            const toolName = part.tool || 'unknown'
            if (!toolNames.includes(toolName)) toolNames.push(toolName)
            res.write(`data: ${JSON.stringify({
              type: 'tool_call',
              toolCall: { id: part.callID, name: toolName, arguments: part.state?.input },
            })}\n\n`)
          } else if (part.type === 'text' && part.text) {
            const partKey = part.id
            if (!sentParts.has(partKey)) {
              sentParts.add(partKey)
              if (isThinkingMsg) {
                res.write(`data: ${JSON.stringify({ type: 'thinking', content: part.text })}\n\n`)
              } else {
                hasSentContent = true
                if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
                res.write(`data: ${JSON.stringify({ type: 'token', content: part.text })}\n\n`)
              }
            }
          }
        } else if (type === 'message.updated') {
          const info = props.info
          if (!info || info.sessionID !== sessionId || info.role !== 'assistant') return

          if (info.time?.completed) {
            // Skip thinking/echo messages and pre-echo context messages
            if (thinkingMsgIds.has(info.id) || !hasSeenEcho) return

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
            // Send non-echo messages as tokens
            for (const msg of assistantMsgs) {
              if (msg?.parts) {
                const isEcho = msg.parts.some((p: any) =>
                  p.type === 'text' && p.text && sentPromptSnippet && p.text.includes(sentPromptSnippet)
                )
                if (isEcho) continue
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

    // Use a snippet from the prompt to detect echo messages
    sentPromptSnippet = 'User message:\n' + lastUserMsg.content

    await sendPromptAsync(sessionId, fullPrompt)
  } catch (err) {
    if (eventSource) eventSource.close()
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (!res.headersSent) {
      res.status(500).json({ error: message })
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
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
