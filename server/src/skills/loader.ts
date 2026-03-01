import { readFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { resolve, join } from 'path'

const SKILLS_DIR = resolve(import.meta.dirname, '../../skills')

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

  if (!existsSync(SKILLS_DIR)) {
    mkdirSync(SKILLS_DIR, { recursive: true })
    skillsCache = []
    return skillsCache
  }

  const files = readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'))
  const skills: Skill[] = []

  for (const file of files) {
    const skill = parseSkillFile(join(SKILLS_DIR, file))
    if (skill) skills.push(skill)
  }

  skillsCache = skills
  console.log(`Loaded ${skills.length} skill(s)`)
  return skills
}

export function reloadSkills(): Skill[] {
  skillsCache = null
  return loadSkills()
}

export function matchSkills(message: string): Skill[] {
  const skills = loadSkills()
  const lower = message.toLowerCase()
  return skills.filter(skill =>
    skill.triggers.some(trigger => lower.includes(trigger))
  )
}
