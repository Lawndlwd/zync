import { getOrCreateSession, sendPromptAsync, getSessionMessages, isSessionIdle } from '../opencode/client.js'
import { insertLLMCall } from '../bot/memory/activity.js'
import { assembleContext, buildSystemPrompt } from './context.js'
import type { InboundMessage } from '../channels/types.js'
import { getChannelManager } from '../channels/manager.js'

async function waitForReply(sessionId: string, msgCountBefore: number, timeoutMs = 120_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000))

    const idle = await isSessionIdle(sessionId)
    if (!idle) continue

    const msgs = await getSessionMessages(sessionId)
    if (msgs.length <= msgCountBefore) continue

    const newMsgs = msgs.slice(msgCountBefore)
    const last = [...newMsgs].reverse().find((m: any) => m.role === 'assistant' || m.info?.role === 'assistant')
    if (last?.parts) {
      const texts = last.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text)
      if (texts.length > 0 && texts.some((t: string) => t.length > 0)) {
        return texts.join('')
      }
    }
  }
  throw new Error('Timeout waiting for OpenCode response')
}

export async function handleMessage(msg: InboundMessage): Promise<void> {
  const manager = getChannelManager()
  // Transcribe audio messages
  let processedText = msg.text
  if (!processedText && msg.mediaType === 'audio' && msg.mediaUrl) {
    try {
      const { transcribeFromUrl } = await import('../voice/transcribe.js')
      processedText = await transcribeFromUrl(msg.mediaUrl)
    } catch (err) {
      console.error('Transcription failed:', err)
      await manager.send(msg.channelType, msg.chatId, { text: 'Could not transcribe audio.' })
      return
    }
  }
  if (!processedText) return

  const typingInterval = setInterval(() => {
    manager.sendTyping(msg.channelType, msg.chatId).catch(() => {})
  }, 4000)
  await manager.sendTyping(msg.channelType, msg.chatId)

  try {
    const startTime = Date.now()

    const ctx = assembleContext(processedText, msg.channelType, msg.chatId)
    const systemPrompt = buildSystemPrompt(ctx)

    const sessionKey = `${msg.channelType}-${msg.chatId}`
    const sessionId = await getOrCreateSession(sessionKey)
    const msgsBefore = await getSessionMessages(sessionId)

    const prompt = `${systemPrompt}\n\n---\n\nUser message:\n${processedText}`
    await sendPromptAsync(sessionId, prompt)

    const reply = await waitForReply(sessionId, msgsBefore.length)

    insertLLMCall({
      source: 'bot',
      model: 'opencode',
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      tool_names: [],
      duration_ms: Date.now() - startTime,
    })

    await manager.send(msg.channelType, msg.chatId, { text: reply || 'No response generated.' })
  } catch (err) {
    console.error('Agent loop error:', err)
    await manager.send(msg.channelType, msg.chatId, { text: 'Something went wrong.' }).catch(() => {})
  } finally {
    clearInterval(typingInterval)
  }
}
