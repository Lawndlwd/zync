import { getOrCreateSession } from '../opencode/client.js'
import { waitForResponse } from '../opencode/wait-for-response.js'
import { insertLLMCall, extractUsageFromSession } from '../bot/memory/activity.js'
import type { InboundMessage } from '../channels/types.js'
import { getChannelManager } from '../channels/manager.js'
import { getConfig } from '../config/index.js'
import { logger } from '../lib/logger.js'

export async function handleMessage(msg: InboundMessage): Promise<void> {
  // Auto-capture chat ID for briefings on first Telegram message
  if (msg.channelType === 'telegram' && msg.chatId) {
    const { getConfigService } = await import('../config/index.js')
    const cfgSvc = getConfigService()
    if (cfgSvc) {
      const existing = cfgSvc.get('BRIEFING_CHAT_ID')
      if (!existing) {
        cfgSvc.set('BRIEFING_CHAT_ID', msg.chatId, 'briefing')
        cfgSvc.set('DEFAULT_CHAT_ID', msg.chatId, 'briefing')
        logger.info({ chatId: msg.chatId }, 'Auto-captured Telegram chat ID for briefings')
      }
    }
  }

  // Check if auto-reply is enabled for this channel
  if (msg.channelType === 'whatsapp') {
    if (getConfig('WHATSAPP_AUTO_REPLY') !== 'true') {
      logger.info({ senderId: msg.senderId }, 'WhatsApp: message received (auto-reply OFF, ignoring)')
      return
    }
  }

  const manager = getChannelManager()
  // Transcribe audio messages
  let processedText = msg.text
  if (!processedText && msg.mediaType === 'audio' && msg.mediaUrl) {
    try {
      const { transcribeFromUrl } = await import('../voice/transcribe.js')
      processedText = await transcribeFromUrl(msg.mediaUrl)
    } catch (err) {
      logger.error({ err }, 'Transcription failed')
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

    const sessionId = await getOrCreateSession('chat')
    const reply = await waitForResponse(sessionId, processedText)

    const usage = await extractUsageFromSession(sessionId)
    insertLLMCall({
      source: 'bot',
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

    await manager.send(msg.channelType, msg.chatId, { text: reply || 'No response generated.' })
  } catch (err) {
    logger.error({ err }, 'Agent loop error')
    await manager.send(msg.channelType, msg.chatId, { text: 'Something went wrong.' }).catch(() => {})
  } finally {
    clearInterval(typingInterval)
  }
}
