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
    try {
      const val = svc.get(name)
      if (val !== null) return val
    } catch {
      // Decrypt can fail if SECRET_KEY changed (e.g. fresh dev container with old volume)
    }
  }
  return process.env[name] ?? defaultValue
}
