import { ConfigService } from './ConfigService.js'

let instance: ConfigService | null = null

export function getConfigService(): ConfigService | null {
  if (!instance) {
    instance = new ConfigService()
  }
  return instance
}

export function getConfig(name: string, defaultValue: string | null = null): string | null {
  const svc = getConfigService()
  if (svc) {
    const val = svc.get(name)
    if (val !== null) return val
  }
  return process.env[name] ?? defaultValue
}
