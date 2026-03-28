import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { getConfig } from '../config/index.js'

const BUNDLED_SKILLS_DIR = resolve(import.meta.dirname, '../../skills')

function getDocumentsSkillsDir(): string | null {
  const docsPath = getConfig('DOCUMENTS_PATH')
  return docsPath ? join(docsPath, 'skills') : null
}

export function loadPrompt(name: string): string {
  // Check documents/skills/system first, then documents/skills (user-editable)
  const docsSkills = getDocumentsSkillsDir()
  if (docsSkills) {
    const systemPath = join(docsSkills, 'system', `${name}.md`)
    if (existsSync(systemPath)) return readFileSync(systemPath, 'utf-8')

    const docsPath = join(docsSkills, `${name}.md`)
    if (existsSync(docsPath)) return readFileSync(docsPath, 'utf-8')
  }

  // Fallback to bundled skills baked into the image
  const bundledPath = join(BUNDLED_SKILLS_DIR, `${name}.md`)
  if (existsSync(bundledPath)) return readFileSync(bundledPath, 'utf-8')

  throw new Error(`Prompt "${name}" not found`)
}

export function loadPromptContent(name: string): string {
  const raw = loadPrompt(name)
  const match = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)
  return match ? match[1].trim() : raw.trim()
}

export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}
