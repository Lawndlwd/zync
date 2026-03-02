import { getConfig } from '../config/index.js'

export interface BotConfig {
  telegramBotToken: string
  allowedUsers: number[]
  llmBaseUrl: string
  llmModel: string
  llmApiKey: string
}

export function getBotConfig(): BotConfig {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN
  if (!telegramBotToken) throw new Error('TELEGRAM_BOT_TOKEN is required')

  const allowedUsersRaw = getConfig('TELEGRAM_ALLOWED_USERS')
  if (!allowedUsersRaw) throw new Error('TELEGRAM_ALLOWED_USERS is required')

  const allowedUsers = allowedUsersRaw
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)
    .map(id => {
      const num = Number(id)
      if (Number.isNaN(num)) throw new Error(`Invalid user ID: ${id}`)
      return num
    })

  const llmBaseUrl = getConfig('LLM_BASE_URL', 'http://localhost:11434') || 'http://localhost:11434'
  const llmModel = getConfig('LLM_MODEL', 'llama3.2') || 'llama3.2'
  const llmApiKey = getConfig('LLM_API_KEY', '') || ''

  return { telegramBotToken, allowedUsers, llmBaseUrl, llmModel, llmApiKey }
}
