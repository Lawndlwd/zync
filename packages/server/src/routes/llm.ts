import { Router } from 'express'
import { errorResponse } from '../lib/errors.js'
import { getOrCreateSession, getActiveDashboardSession, sendPromptAsync } from '../opencode/client.js'
import { streamOpenCode } from '../opencode/stream.js'
import { insertLLMCall, extractUsageFromSession } from '../bot/memory/activity.js'
import { validate } from '../lib/validate.js'
import { LlmChatSchema } from '@zync/shared/schemas'

export const llmRouter = Router()

// Send prompt to OpenCode and return immediately — frontend handles streaming via its own SSE
llmRouter.post('/chat/send', validate(LlmChatSchema), async (req, res) => {
  try {
    const { messages } = req.body
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user')
    if (!lastUserMsg) {
      return res.status(400).json({ error: 'No user message found' })
    }

    const sessionId = getActiveDashboardSession() || await getOrCreateSession('chat')

    await sendPromptAsync(sessionId, lastUserMsg.content)

    res.json({ sessionId })
  } catch (err) {
    errorResponse(res, err)
  }
})

llmRouter.post('/chat/stream', validate(LlmChatSchema), async (req, res) => {
  const startTime = Date.now()
  const { messages } = req.body
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user')
  if (!lastUserMsg) {
    res.status(400).json({ error: 'No user message found' })
    return
  }

  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    const sessionId = getActiveDashboardSession() || await getOrCreateSession('chat')

    const cleanup = await streamOpenCode(sessionId, lastUserMsg.content, {
      onToken: (text) => {
        res.write(`data: ${JSON.stringify({ type: 'token', content: text })}\n\n`)
      },
      onDone: (_fullText) => {
        res.write('data: [DONE]\n\n')
        res.end()

        extractUsageFromSession(sessionId).then((usage) => {
          insertLLMCall({
            source: 'chat',
            model: usage.model,
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens,
            tool_names: [],
            duration_ms: Date.now() - startTime,
            session_id: sessionId,
            message_id: usage.message_id,
            cost: usage.cost,
          })
        }).catch(() => {})
      },
      onError: (err) => {
        const message = err.message || 'Internal server error'
        if (!res.headersSent) {
          res.status(500).json({ error: message })
        } else {
          res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
          res.write('data: [DONE]\n\n')
          res.end()
        }
      },
    })

    res.on('close', cleanup)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (!res.headersSent) {
      res.status(500).json({ error: message })
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    }
  }
})
