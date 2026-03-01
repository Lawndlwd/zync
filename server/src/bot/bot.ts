import { Bot } from 'grammy'
import { getBotConfig } from './config.js'
import { getOrCreateSession, sendPromptAsync, getSessionMessages, isSessionIdle } from '../opencode/client.js'
import { insertLLMCall } from './memory/activity.js'

const TELEGRAM_MAX_LENGTH = 4096

function splitMessage(text: string): string[] {
  if (text.length <= TELEGRAM_MAX_LENGTH) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, TELEGRAM_MAX_LENGTH))
    remaining = remaining.slice(TELEGRAM_MAX_LENGTH)
  }
  return chunks
}

async function waitForReply(sessionId: string, msgCountBefore: number, timeoutMs = 120_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000))

    // Wait until the session is idle (finished generating)
    const idle = await isSessionIdle(sessionId)
    if (!idle) continue

    // Check for new messages since we sent the prompt
    const msgs = await getSessionMessages(sessionId)
    if (msgs.length <= msgCountBefore) continue

    // Get the last assistant message from the new messages
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

let botInstance: Bot | null = null

export function getBotInstance(): Bot {
  if (!botInstance) throw new Error('Bot not initialized yet')
  return botInstance
}

export async function startBot() {
  const config = getBotConfig()
  const bot = new Bot(config.telegramBotToken)
  botInstance = bot

  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id
    if (!userId || !config.allowedUsers.includes(userId)) return
    await next()
  })

  bot.on('message:text', async (ctx) => {
    const typingInterval = setInterval(() => {
      ctx.replyWithChatAction('typing').catch(() => {})
    }, 4000)

    try {
      await ctx.replyWithChatAction('typing')
      const startTime = Date.now()

      const sessionId = await getOrCreateSession(`bot-${ctx.chat.id}`)
      const msgsBefore = await getSessionMessages(sessionId)
      await sendPromptAsync(sessionId, ctx.message.text)
      const text = await waitForReply(sessionId, msgsBefore.length)

      insertLLMCall({
        source: 'bot',
        model: 'opencode',
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        tool_names: [],
        duration_ms: Date.now() - startTime,
      })

      const chunks = splitMessage(text || 'No response generated.')
      for (const chunk of chunks) {
        await ctx.reply(chunk)
      }
    } catch (err) {
      console.error('Agent error:', err)
      await ctx.reply('Something went wrong.').catch(() => {})
    } finally {
      clearInterval(typingInterval)
    }
  })

  bot.catch((err) => {
    console.error('Bot error:', err)
  })

  await bot.start()
  console.log('Telegram bot started')
}
