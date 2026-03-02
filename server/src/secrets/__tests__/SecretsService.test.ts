import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SecretsService } from '../SecretsService.js'
import { unlinkSync, existsSync } from 'fs'
import { resolve } from 'path'

const TEST_DB = resolve(import.meta.dirname, 'test-secrets.db')
const TEST_KEY = 'a'.repeat(64) // 64 hex chars = 32 bytes

describe('SecretsService', () => {
  let svc: SecretsService

  beforeEach(() => {
    svc = new SecretsService(TEST_KEY, TEST_DB)
  })

  afterEach(() => {
    svc.close()
    for (const f of [TEST_DB, `${TEST_DB}-shm`, `${TEST_DB}-wal`]) {
      if (existsSync(f)) unlinkSync(f)
    }
  })

  it('set and get a secret', () => {
    svc.set('API_KEY', 'sk-12345', 'provider')
    expect(svc.get('API_KEY')).toBe('sk-12345')
  })

  it('returns null for missing secret', () => {
    expect(svc.get('NOPE')).toBeNull()
  })

  it('overwrites existing secret', () => {
    svc.set('TOKEN', 'old', 'auth')
    svc.set('TOKEN', 'new', 'auth')
    expect(svc.get('TOKEN')).toBe('new')
  })

  it('deletes a secret', () => {
    svc.set('TMP', 'val')
    svc.delete('TMP')
    expect(svc.get('TMP')).toBeNull()
  })

  it('lists secrets without values', () => {
    svc.set('A', 'val-a', 'cat1')
    svc.set('B', 'val-b', 'cat2')
    const list = svc.list()
    expect(list).toHaveLength(2)
    expect(list[0]).not.toHaveProperty('value')
    expect(list.find(s => s.name === 'A')?.category).toBe('cat1')
  })

  it('lists by category', () => {
    svc.set('X', '1', 'alpha')
    svc.set('Y', '2', 'beta')
    expect(svc.list('alpha')).toHaveLength(1)
  })

  it('throws on wrong key', () => {
    svc.set('SECRET', 'data')
    svc.close()
    const wrongKey = 'b'.repeat(64)
    const svc2 = new SecretsService(wrongKey, TEST_DB)
    expect(() => svc2.get('SECRET')).toThrow()
    svc2.close()
  })
})
