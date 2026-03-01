import { Router } from 'express'
import { getOrCreateSession, sendPromptAsync, getSessionMessages, getOpenCodeUrl } from '../opencode/client.js'
import { insertLLMCall } from '../bot/memory/activity.js'
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
    await sendPromptAsync(sessionId, lastUserMsg.content)

    // Poll for the assistant reply
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
    // Find last assistant message with text
    const last = [...msgs].reverse().find((m: any) => m.info?.role === 'assistant')
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

    // Start listening to SSE BEFORE sending prompt to avoid race condition
    const openCodeUrl = getOpenCodeUrl()
    eventSource = new EventSource(`${openCodeUrl}/global/event`)

    const sentParts = new Set<string>()
    let done = false

    const cleanup = () => {
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }
    }

    // Set a timeout to prevent hanging forever
    const timeout = setTimeout(() => {
      if (!done) {
        done = true
        // Fallback: fetch messages directly
        getSessionMessages(sessionId).then((msgs) => {
          const last = [...msgs].reverse().find((m: any) => m.info?.role === 'assistant')
          if (last?.parts) {
            for (const part of last.parts) {
              if (part.type === 'text' && part.text) {
                res.write(`data: ${JSON.stringify({ type: 'token', content: part.text })}\n\n`)
              }
            }
          }
          res.write('data: [DONE]\n\n')
          res.end()
          cleanup()
        }).catch(() => {
          res.write(`data: ${JSON.stringify({ type: 'error', message: 'Timeout' })}\n\n`)
          res.write('data: [DONE]\n\n')
          res.end()
          cleanup()
        })
      }
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

          if (part.type === 'text' && part.text) {
            const partKey = part.id
            if (!sentParts.has(partKey)) {
              sentParts.add(partKey)
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
        } else if (type === 'message.updated') {
          const info = props.info
          if (!info || info.sessionID !== sessionId || info.role !== 'assistant') return

          if (info.time?.completed) {
            // Message complete — fetch final text
            const msgs = await getSessionMessages(sessionId)
            const last = [...msgs].reverse().find((m: any) => m.info?.role === 'assistant' && m.info?.id === info.id)
            if (last?.parts) {
              for (const part of last.parts) {
                if (part.type === 'text' && part.text && !sentParts.has(part.id)) {
                  sentParts.add(part.id)
                  res.write(`data: ${JSON.stringify({ type: 'token', content: part.text })}\n\n`)
                }
              }
            }
            done = true
            clearTimeout(timeout)
            res.write('data: [DONE]\n\n')
            res.end()
            cleanup()
          }
        } else if (type === 'session.updated') {
          const info = props.info
          if (!info || info.id !== sessionId) return
          if (info.status === 'idle' || info.status === 'completed') {
            // Fetch final messages
            const msgs = await getSessionMessages(sessionId)
            const last = [...msgs].reverse().find((m: any) => m.info?.role === 'assistant')
            if (last?.parts) {
              for (const part of last.parts) {
                if (part.type === 'text' && part.text && !sentParts.has(part.id)) {
                  sentParts.add(part.id)
                  res.write(`data: ${JSON.stringify({ type: 'token', content: part.text })}\n\n`)
                }
              }
            }
            done = true
            clearTimeout(timeout)
            res.write('data: [DONE]\n\n')
            res.end()
            cleanup()
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    eventSource.onerror = () => {
      // SSE will auto-reconnect, but if we're done, clean up
      if (done) cleanup()
    }

    // Handle client disconnect
    req.on('close', () => {
      done = true
      clearTimeout(timeout)
      cleanup()
    })

    // NOW send the prompt (after SSE listener is set up)
    await sendPromptAsync(sessionId, lastUserMsg.content)
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
