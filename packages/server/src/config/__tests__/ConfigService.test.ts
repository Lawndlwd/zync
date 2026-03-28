import { unlinkSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { ConfigService } from '../ConfigService.js'

const TEST_DB = '/tmp/test-config.db'

function cleanup() {
  try {
    unlinkSync(TEST_DB)
  } catch {}
  try {
    unlinkSync(`${TEST_DB}-wal`)
  } catch {}
  try {
    unlinkSync(`${TEST_DB}-shm`)
  } catch {}
}

describe('ConfigService', () => {
  let svc: ConfigService

  afterEach(() => {
    svc?.close()
    cleanup()
  })

  it('should set and get a value', () => {
    svc = new ConfigService(TEST_DB)
    svc.set('theme', 'dark')
    expect(svc.get('theme')).toBe('dark')
  })

  it('should return null for missing key', () => {
    svc = new ConfigService(TEST_DB)
    expect(svc.get('nonexistent')).toBeNull()
  })

  it('should overwrite an existing value', () => {
    svc = new ConfigService(TEST_DB)
    svc.set('theme', 'dark')
    svc.set('theme', 'light')
    expect(svc.get('theme')).toBe('light')
  })

  it('should delete a key and return true', () => {
    svc = new ConfigService(TEST_DB)
    svc.set('theme', 'dark')
    expect(svc.delete('theme')).toBe(true)
    expect(svc.get('theme')).toBeNull()
  })

  it('should return false when deleting a nonexistent key', () => {
    svc = new ConfigService(TEST_DB)
    expect(svc.delete('nonexistent')).toBe(false)
  })

  it('should list all settings', () => {
    svc = new ConfigService(TEST_DB)
    svc.set('a', '1', 'cat1')
    svc.set('b', '2', 'cat2')
    const all = svc.list()
    expect(all).toHaveLength(2)
    expect(all[0].key).toBe('a')
    expect(all[0].value).toBe('1')
    expect(all[0].category).toBe('cat1')
    expect(all[0].updatedAt).toBeDefined()
    expect(all[1].key).toBe('b')
  })

  it('should list settings filtered by category', () => {
    svc = new ConfigService(TEST_DB)
    svc.set('a', '1', 'cat1')
    svc.set('b', '2', 'cat2')
    svc.set('c', '3', 'cat1')
    const filtered = svc.list('cat1')
    expect(filtered).toHaveLength(2)
    expect(filtered.map((s) => s.key)).toEqual(['a', 'c'])
  })

  it('should bulkSet multiple values in a transaction', () => {
    svc = new ConfigService(TEST_DB)
    svc.bulkSet([
      { key: 'x', value: '10' },
      { key: 'y', value: '20', category: 'numbers' },
      { key: 'z', value: '30', category: 'numbers' },
    ])
    expect(svc.get('x')).toBe('10')
    expect(svc.get('y')).toBe('20')
    expect(svc.get('z')).toBe('30')
    const nums = svc.list('numbers')
    expect(nums).toHaveLength(2)
  })
})
