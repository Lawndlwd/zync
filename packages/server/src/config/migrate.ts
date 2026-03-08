import { readFileSync, existsSync, renameSync } from 'fs'
import { resolve } from 'path'
import { logger } from '../lib/logger.js'
import { getConfigService } from './index.js'
import { getSecrets } from '../secrets/index.js'

const DATA_DIR = resolve(import.meta.dirname, '../../data')

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur && typeof cur === 'object' && key in (cur as Record<string, unknown>)) {
      return (cur as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

interface MigrationEntry {
  sourcePath: string
  targetKey: string
  category: string
  type: 'secret' | 'config'
}

interface FileMigration {
  file: string
  entries: MigrationEntry[]
}

const MIGRATIONS: FileMigration[] = [
  {
    file: 'gitlab.json',
    entries: [
      { sourcePath: 'pat', targetKey: 'GITLAB_PAT', category: 'jira', type: 'secret' },
      { sourcePath: 'baseUrl', targetKey: 'GITLAB_BASE_URL', category: 'gitlab', type: 'config' },
    ],
  },
  {
    file: 'channel-config.json',
    entries: [
      { sourcePath: 'telegram.botToken', targetKey: 'CHANNEL_TELEGRAM_BOT_TOKEN', category: 'channel', type: 'secret' },
      { sourcePath: 'gmail.clientSecret', targetKey: 'CHANNEL_GMAIL_CLIENT_SECRET', category: 'channel', type: 'secret' },
      { sourcePath: 'gmail.refreshToken', targetKey: 'CHANNEL_GMAIL_REFRESH_TOKEN', category: 'channel', type: 'secret' },
      { sourcePath: 'gmail.clientId', targetKey: 'CHANNEL_GMAIL_CLIENT_ID', category: 'channel', type: 'secret' },
      { sourcePath: 'telegram.allowedUsers', targetKey: 'TELEGRAM_ALLOWED_USERS', category: 'channels', type: 'config' },
      { sourcePath: 'whatsapp.allowedNumbers', targetKey: 'WHATSAPP_ALLOWED_NUMBERS', category: 'channels', type: 'config' },
    ],
  },
  {
    file: 'briefing-config.json',
    entries: [
      { sourcePath: 'morningCron', targetKey: 'MORNING_BRIEFING_CRON', category: 'briefing', type: 'config' },
      { sourcePath: 'eveningCron', targetKey: 'EVENING_RECAP_CRON', category: 'briefing', type: 'config' },
      { sourcePath: 'channel', targetKey: 'DEFAULT_CHANNEL', category: 'briefing', type: 'config' },
      { sourcePath: 'chatId', targetKey: 'DEFAULT_CHAT_ID', category: 'briefing', type: 'config' },
      { sourcePath: 'enabled', targetKey: 'BRIEFING_ENABLED', category: 'briefing', type: 'config' },
    ],
  },
  {
    file: 'agent-models.json',
    entries: [
      { sourcePath: 'prAgent.model', targetKey: 'AGENT_MODEL_PR', category: 'llm', type: 'config' },
      { sourcePath: 'opencode.model', targetKey: 'AGENT_MODEL_OPENCODE', category: 'llm', type: 'config' },
      { sourcePath: 'bot.model', targetKey: 'AGENT_MODEL_BOT', category: 'llm', type: 'config' },
    ],
  },
  {
    file: 'tool-config.json',
    entries: [
      { sourcePath: 'sandboxEnabled', targetKey: 'TOOL_SANDBOX_ENABLED', category: 'general', type: 'config' },
    ],
  },
]

export function migrateJsonConfigs(): void {
  const configSvc = getConfigService()
  const secretsSvc = getSecrets()

  let totalMigrated = 0
  let totalSkipped = 0

  logger.info('Starting JSON config migration...')

  for (const migration of MIGRATIONS) {
    const filePath = resolve(DATA_DIR, migration.file)

    if (!existsSync(filePath)) {
      logger.debug(`Migration: ${migration.file} not found, skipping`)
      continue
    }

    let data: Record<string, unknown>
    try {
      data = JSON.parse(readFileSync(filePath, 'utf-8'))
    } catch (e) {
      logger.error({ err: e }, `Migration: failed to parse ${migration.file}`)
      continue
    }

    let fileMigrated = 0
    let fileSkipped = 0

    for (const entry of migration.entries) {
      const raw = getNestedValue(data, entry.sourcePath)
      if (raw === undefined || raw === null || raw === '') continue

      const value = String(raw)

      if (entry.type === 'secret') {
        if (!secretsSvc) {
          logger.warn(`Migration: SECRET_KEY not set, cannot migrate secret ${entry.targetKey}`)
          continue
        }
        if (secretsSvc.has(entry.targetKey)) {
          logger.debug(`Migration: SKIP secret ${entry.targetKey} (already exists)`)
          fileSkipped++
          continue
        }
        secretsSvc.set(entry.targetKey, value, entry.category)
        logger.info(`Migration: OK secret ${entry.targetKey} -> category: ${entry.category}`)
        fileMigrated++
      } else {
        if (!configSvc) {
          logger.warn(`Migration: ConfigService unavailable, cannot migrate ${entry.targetKey}`)
          continue
        }
        const existing = configSvc.get(entry.targetKey)
        if (existing !== null) {
          logger.debug(`Migration: SKIP config ${entry.targetKey} (already exists)`)
          fileSkipped++
          continue
        }
        configSvc.set(entry.targetKey, value, entry.category)
        logger.info(`Migration: OK config ${entry.targetKey} -> category: ${entry.category}`)
        fileMigrated++
      }
    }

    totalMigrated += fileMigrated
    totalSkipped += fileSkipped

    // Rename file to .json.migrated after successful processing
    try {
      renameSync(filePath, `${filePath}.migrated`)
      logger.info(`Migration: renamed ${migration.file} -> ${migration.file}.migrated`)
    } catch (e) {
      logger.error({ err: e }, `Migration: failed to rename ${migration.file}`)
    }
  }

  logger.info(`JSON config migration complete: ${totalMigrated} migrated, ${totalSkipped} skipped`)
}
