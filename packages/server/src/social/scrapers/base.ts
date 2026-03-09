import { resolve } from 'path'
import { mkdirSync } from 'fs'
import { getSecret } from '../../secrets/index.js'
import { getConfig } from '../../config/index.js'
import { logger } from '../../lib/logger.js'

const USER_DATA_DIR = resolve(import.meta.dirname, '../../../data/social-browser')

export function getBrowserUserDataDir(): string {
  mkdirSync(USER_DATA_DIR, { recursive: true })
  return USER_DATA_DIR
}

export function getSocialCredentials(platform: string): { username: string; password: string } | null {
  const usernameKey = `SOCIAL_${platform.toUpperCase()}_USERNAME`
  const passwordKey = `SOCIAL_${platform.toUpperCase()}_PASSWORD`

  const username = getConfig(usernameKey)
  const password = getSecret(passwordKey)

  if (!username || !password) {
    logger.warn({ platform }, 'Missing social media credentials')
    return null
  }

  return { username, password }
}

export function getInstagramGraphConfig(): { appId: string; appSecret: string; accessToken: string; igUserId: string } | null {
  const appId = getConfig('SOCIAL_INSTAGRAM_APP_ID')
  const appSecret = getSecret('SOCIAL_INSTAGRAM_APP_SECRET')
  const accessToken = getSecret('SOCIAL_INSTAGRAM_ACCESS_TOKEN')
  const igUserId = getConfig('SOCIAL_INSTAGRAM_USER_ID')

  if (!accessToken || !igUserId) {
    return null
  }

  return { appId: appId || '', appSecret: appSecret || '', accessToken, igUserId }
}

export function getLaunchOptions() {
  return {
    launchOptions: {
      args: ['--disable-blink-features=AutomationControlled'],
    },
    userDataDir: getBrowserUserDataDir(),
  }
}

export async function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
