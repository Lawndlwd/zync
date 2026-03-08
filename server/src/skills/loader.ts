import { readFileSync, readdirSync, existsSync } from 'fs'
import { resolve, join } from 'path'
import { logger } from '../lib/logger.js'
import { getConfig } from '../config/index.js'

const BUNDLED_SKILLS_DIR = resolve(import.meta.dirname, '../../skills')

function getDocumentsSkillsDir(): string | null {
  const docsPath = getConfig('DOCUMENTS_PATH')
  return docsPath ? join(docsPath, 'skills') : null
}

export interface Skill {
  name: string
  description: string
  triggers: string[]
  content: string
  filePath: string
}

let skillsCache: Skill[] | null = null

function parseSkillFile(filePath: string): Skill | null {
  const raw = readFileSync(filePath, 'utf-8')

  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!fmMatch) return null

  const frontmatter = fmMatch[1]
  const content = fmMatch[2].trim()

  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m)
  const descMatch = frontmatter.match(/^description:\s*(.+)$/m)
  const triggersMatch = frontmatter.match(/^triggers:\s*\[([^\]]*)\]$/m)

  if (!nameMatch || !descMatch) return null

  const triggers = triggersMatch
    ? triggersMatch[1].split(',').map(t => t.trim().replace(/['"]/g, '').toLowerCase()).filter(Boolean)
    : []

  return {
    name: nameMatch[1].trim(),
    description: descMatch[1].trim(),
    triggers,
    content,
    filePath,
  }
}

export function loadSkills(): Skill[] {
  if (skillsCache) return skillsCache

  const seen = new Set<string>()
  const skills: Skill[] = []

  // Documents skills take precedence: system subfolder, then user skills, then bundled
  const docsSkills = getDocumentsSkillsDir()
  const dirs = [
    docsSkills ? join(docsSkills, 'system') : null,
    docsSkills,
    BUNDLED_SKILLS_DIR,
  ].filter(Boolean) as string[]
  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir).filter(f => f.endsWith('.md'))) {
      if (seen.has(file)) continue
      seen.add(file)
      const skill = parseSkillFile(join(dir, file))
      if (skill) skills.push(skill)
    }
  }

  skillsCache = skills
  logger.info({ count: skills.length }, 'Skills loaded')
  return skills
}

export function reloadSkills(): Skill[] {
  skillsCache = null
  return loadSkills()
}

