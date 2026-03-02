import { SecretsService } from './SecretsService.js'

let instance: SecretsService | null = null

export function getSecrets(): SecretsService | null {
  if (!instance) {
    const key = process.env.SECRET_KEY
    if (!key) return null
    instance = new SecretsService(key)
  }
  return instance
}

export function getSecret(name: string, defaultValue: string | null = null): string | null {
  const svc = getSecrets()
  if (svc) {
    const val = svc.get(name)
    if (val !== null) return val
  }
  return process.env[name] ?? defaultValue
}
