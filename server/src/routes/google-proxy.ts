import { Router } from 'express'
import { logger } from '../lib/logger.js'

const CODE_ASSIST_BASE = 'https://cloudcode-pa.googleapis.com/v1internal'

export const googleProxyRouter = Router()

// NOTE: Google Code Assist proxy is no longer used since OpenCode manages providers.
// Keeping the route for backwards compatibility but it will return 501 without OAuth config.

/**
 * Convert OpenAI message format to Gemini Content format.
 */
function openaiToGeminiContents(messages: any[]): {
  contents: any[]
  systemInstruction?: any
} {
  let systemInstruction: any | undefined
  const contents: any[] = []

  for (const msg of messages) {
    if (msg.role === 'system') {
      // Gemini uses systemInstruction instead of system messages
      systemInstruction = {
        role: 'user',
        parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }],
      }
      continue
    }

    const role = msg.role === 'assistant' ? 'model' : 'user'

    if (typeof msg.content === 'string') {
      contents.push({ role, parts: [{ text: msg.content }] })
    } else if (Array.isArray(msg.content)) {
      // Multi-part content (text + images, etc.)
      const parts = msg.content.map((part: any) => {
        if (part.type === 'text') return { text: part.text }
        if (part.type === 'image_url') {
          return { text: `[image: ${part.image_url?.url || 'attached'}]` }
        }
        return { text: JSON.stringify(part) }
      })
      contents.push({ role, parts })
    }

    // Handle tool calls from assistant
    if (msg.tool_calls) {
      const lastContent = contents[contents.length - 1]
      for (const tc of msg.tool_calls) {
        lastContent.parts.push({
          functionCall: {
            name: tc.function.name,
            args: typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments,
          },
        })
      }
    }

    // Handle tool results
    if (msg.role === 'tool') {
      contents.push({
        role: 'function',
        parts: [{
          functionResponse: {
            name: msg.name || msg.tool_call_id,
            response: { result: msg.content },
          },
        }],
      })
    }
  }

  return { contents, systemInstruction }
}

/**
 * Convert OpenAI tools to Gemini function declarations.
 */
function openaiToGeminiTools(tools?: any[]): any[] | undefined {
  if (!tools || tools.length === 0) return undefined
  return [{
    functionDeclarations: tools
      .filter((t: any) => t.type === 'function')
      .map((t: any) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      })),
  }]
}

/**
 * OpenAI-compatible chat completions → Google Code Assist proxy.
 *
 * Mastra sends standard OpenAI requests here; we convert to Gemini
 * native format, wrap in the Code Assist envelope, and pipe back.
 */
googleProxyRouter.post('/v1/chat/completions', async (req, res) => {
  try {
    // Google Code Assist proxy requires OAuth tokens — no longer managed here
    return res.status(501).json({ error: 'Google Code Assist proxy disabled. Use OpenCode for Google models.' })

    const body = req.body
    const model = body.model
    const accessToken = ''
    const projectId = ''
    const isStreaming = body.stream === true

    // Convert OpenAI format to Gemini native format
    const { contents, systemInstruction } = openaiToGeminiContents(body.messages || [])
    const tools = openaiToGeminiTools(body.tools)

    const generationConfig: Record<string, any> = {}
    if (body.temperature !== undefined) generationConfig.temperature = body.temperature
    if (body.top_p !== undefined) generationConfig.topP = body.top_p
    if (body.max_tokens !== undefined) generationConfig.maxOutputTokens = body.max_tokens
    if (body.stop) generationConfig.stopSequences = Array.isArray(body.stop) ? body.stop : [body.stop]

    const geminiRequest: Record<string, any> = { contents }
    if (systemInstruction) geminiRequest.systemInstruction = systemInstruction
    if (tools) geminiRequest.tools = tools
    if (Object.keys(generationConfig).length > 0) geminiRequest.generationConfig = generationConfig

    // Wrap in Code Assist envelope
    const wrappedBody = {
      project: projectId,
      model,
      user_prompt_id: crypto.randomUUID(),
      request: geminiRequest,
    }

    const endpoint = isStreaming ? 'streamGenerateContent' : 'generateContent'
    const upstreamUrl = `${CODE_ASSIST_BASE}:${endpoint}`

    const upstreamRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Goog-Api-Client': 'cloud-code-ai-ide-extensions/0.0.0',
        'User-Agent': 'cloud-code-ai-ide-extensions/0.0.0',
      },
      body: JSON.stringify(wrappedBody),
    })

    if (!upstreamRes.ok) {
      const errorText = await upstreamRes.text()
      logger.error({ status: upstreamRes.status, errorText }, '[google-proxy] upstream error')
      return res.status(upstreamRes.status).json({
        error: { message: `Code Assist error: ${errorText}`, status: upstreamRes.status },
      })
    }

    if (isStreaming) {
      // Stream SSE: unwrap .response from each data line
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders()

      const reader = upstreamRes.body?.getReader()!
      if (!reader) {
        res.end()
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') {
                res.write('data: [DONE]\n\n')
                continue
              }
              try {
                const parsed = JSON.parse(data)
                const unwrapped = parsed.response || parsed
                res.write(`data: ${JSON.stringify(unwrapped)}\n\n`)
              } catch {
                res.write(`data: ${data}\n\n`)
              }
            } else if (line.trim()) {
              res.write(line + '\n')
            }
          }
        }

        if (buffer.trim()) {
          if (buffer.startsWith('data: ')) {
            const data = buffer.slice(6).trim()
            if (data !== '[DONE]') {
              try {
                const parsed = JSON.parse(data)
                const unwrapped = parsed.response || parsed
                res.write(`data: ${JSON.stringify(unwrapped)}\n\n`)
              } catch {
                res.write(`data: ${data}\n\n`)
              }
            } else {
              res.write('data: [DONE]\n\n')
            }
          }
        }
      } catch (err) {
        logger.error({ err }, '[google-proxy] stream error')
      } finally {
        res.end()
      }
    } else {
      // Non-streaming: unwrap .response from JSON
      const data = await upstreamRes.json() as { response?: unknown }
      const unwrapped = data.response || data
      res.json(unwrapped)
    }
  } catch (err: any) {
    logger.error({ err }, '[google-proxy] error')
    res.status(500).json({ error: { message: err.message } })
  }
})
