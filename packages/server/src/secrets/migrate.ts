import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { SecretsService } from './SecretsService.js'

config({ path: resolve(import.meta.dirname, '../../.env') })

const SECRET_KEY = process.env.SECRET_KEY
if (!SECRET_KEY) {
  console.error('ERROR: SECRET_KEY env var is required.')
  console.error('Generate with: openssl rand -hex 32')
  console.error('Add to server/.env: SECRET_KEY=<generated-key>')
  process.exit(1)
}

const svc = new SecretsService(SECRET_KEY)
const DATA_DIR = resolve(import.meta.dirname, '../../data')

let migrated = 0
let skipped = 0

function migrateSecret(name: string, value: string, category: string): void {
  if (!value || value.trim() === '') return
  if (svc.has(name)) {
    console.log(`  SKIP  ${name} (already exists)`)
    skipped++
    return
  }
  svc.set(name, value.trim(), category)
  console.log(`  OK    ${name} → category: ${category}`)
  migrated++
}

// --- Migrate .env secrets ---
console.log('\n--- Migrating .env secrets ---')
const envSecrets: Array<[string, string]> = [
  ['JIRA_API_TOKEN', 'jira'],
  ['TELEGRAM_BOT_TOKEN', 'channel'],
  ['GOOGLE_CLIENT_ID', 'oauth'],
  ['GOOGLE_CLIENT_SECRET', 'oauth'],
]
for (const [name, category] of envSecrets) {
  const val = process.env[name]
  if (val) migrateSecret(name, val, category)
}

// --- Migrate providers.json API keys ---
console.log('\n--- Migrating providers.json API keys ---')
const providersPath = resolve(DATA_DIR, 'providers.json')
if (existsSync(providersPath)) {
  try {
    const data = JSON.parse(readFileSync(providersPath, 'utf-8'))
    for (const provider of data.providers || []) {
      if (provider.apiKey && provider.apiKey !== '' && provider.apiKey !== 'ollama') {
        const name = `PROVIDER_API_KEY_${provider.id.toUpperCase().replace(/-/g, '_')}`
        migrateSecret(name, provider.apiKey, 'provider')
      }
    }
  } catch (e) {
    console.error('  Failed to parse providers.json:', e)
  }
} else {
  console.log('  No providers.json found, skipping')
}

// --- Migrate channel-config.json secrets ---
console.log('\n--- Migrating channel-config.json secrets ---')
const channelConfigPath = resolve(DATA_DIR, 'channel-config.json')
if (existsSync(channelConfigPath)) {
  try {
    const cfg = JSON.parse(readFileSync(channelConfigPath, 'utf-8'))
    if (cfg.telegram?.botToken) migrateSecret('CHANNEL_TELEGRAM_BOT_TOKEN', cfg.telegram.botToken, 'channel')
    if (cfg.gmail?.clientId) migrateSecret('CHANNEL_GMAIL_CLIENT_ID', cfg.gmail.clientId, 'channel')
    if (cfg.gmail?.clientSecret) migrateSecret('CHANNEL_GMAIL_CLIENT_SECRET', cfg.gmail.clientSecret, 'channel')
    if (cfg.gmail?.refreshToken) migrateSecret('CHANNEL_GMAIL_REFRESH_TOKEN', cfg.gmail.refreshToken, 'channel')
  } catch (e) {
    console.error('  Failed to parse channel-config.json:', e)
  }
} else {
  console.log('  No channel-config.json found, skipping')
}

// --- Migrate gmail credential files ---
console.log('\n--- Migrating gmail credential files ---')
for (const file of ['gmail-credentials.json', 'gmail-token.json']) {
  const path = resolve(DATA_DIR, file)
  if (existsSync(path)) {
    try {
      const content = readFileSync(path, 'utf-8')
      const name = `GMAIL_${file.replace('.json', '').replace(/-/g, '_').toUpperCase()}`
      migrateSecret(name, content, 'gmail')
    } catch (e) {
      console.error(`  Failed to read ${file}:`, e)
    }
  }
}

svc.close()

console.log(`\n--- Migration complete ---`)
console.log(`  Migrated: ${migrated}`)
console.log(`  Skipped:  ${skipped}`)
console.log(`\n--- Next steps ---`)
console.log(`  1. Verify the app works with SECRET_KEY set`)
console.log(`  2. Remove plaintext secrets from server/.env (keep only non-secret config + SECRET_KEY)`)
console.log(`  3. Optionally remove API keys from server/data/providers.json`)
console.log(`  4. The secrets.db file is safe to back up — useless without SECRET_KEY`)
