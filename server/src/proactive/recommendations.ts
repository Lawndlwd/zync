import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const PATTERNS_PATH = resolve(import.meta.dirname, '../../data/patterns.json')

interface PatternEntry {
  action: string
  timestamps: string[]
  count: number
}

interface PatternsData {
  patterns: PatternEntry[]
  lastRecommendation: string | null
}

function loadPatterns(): PatternsData {
  if (existsSync(PATTERNS_PATH)) {
    return JSON.parse(readFileSync(PATTERNS_PATH, 'utf-8'))
  }
  return { patterns: [], lastRecommendation: null }
}

function savePatterns(data: PatternsData): void {
  writeFileSync(PATTERNS_PATH, JSON.stringify(data, null, 2))
}

export function trackAction(action: string): void {
  const data = loadPatterns()
  const existing = data.patterns.find(p => p.action === action)
  const now = new Date().toISOString()

  if (existing) {
    existing.timestamps.push(now)
    if (existing.timestamps.length > 100) existing.timestamps = existing.timestamps.slice(-100)
    existing.count++
  } else {
    data.patterns.push({ action, timestamps: [now], count: 1 })
  }

  savePatterns(data)
}

export function getRecommendations(): string[] {
  const data = loadPatterns()
  const recommendations: string[] = []

  for (const pattern of data.patterns) {
    if (pattern.count < 5) continue

    const hours = pattern.timestamps.slice(-10).map(t => new Date(t).getHours())
    const avgHour = Math.round(hours.reduce((a, b) => a + b, 0) / hours.length)
    const variance = hours.reduce((sum, h) => sum + Math.abs(h - avgHour), 0) / hours.length

    if (variance < 2) {
      recommendations.push(
        `You typically "${pattern.action}" around ${avgHour}:00. Want me to automate this?`
      )
    }
  }

  return recommendations
}
