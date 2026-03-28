import { getBrainDb } from './brain-db.js'

export type ProfileSection = 'identity' | 'technical' | 'interests' | 'communication' | 'work_patterns'

export interface ProfileEntry {
  section: ProfileSection
  content: string
  updated_at: string
}

const VALID_SECTIONS: ProfileSection[] = ['identity', 'technical', 'interests', 'communication', 'work_patterns']

const SECTION_LABELS: Record<ProfileSection, string> = {
  identity: 'Identity',
  technical: 'Technical',
  interests: 'Interests',
  communication: 'Communication',
  work_patterns: 'Work Patterns',
}

export function getProfile(): ProfileEntry[] {
  const db = getBrainDb()
  return db.prepare('SELECT section, content, updated_at FROM core_profile').all() as ProfileEntry[]
}

export function getProfileSection(section: ProfileSection): ProfileEntry | null {
  const db = getBrainDb()
  const row = db.prepare('SELECT section, content, updated_at FROM core_profile WHERE section = ?').get(section) as
    | ProfileEntry
    | undefined
  return row ?? null
}

export function updateProfileSection(section: ProfileSection, content: string): void {
  if (!VALID_SECTIONS.includes(section)) {
    throw new Error(`Invalid profile section: ${section}`)
  }
  const db = getBrainDb()
  db.prepare("UPDATE core_profile SET content = ?, updated_at = datetime('now') WHERE section = ?").run(
    content,
    section,
  )
}

export function buildProfileBlock(): string {
  const entries = getProfile().filter((e) => e.content.trim().length > 0)
  if (entries.length === 0) return ''

  const sections = entries.map((e) => `### ${SECTION_LABELS[e.section]}\n${e.content}`).join('\n\n')

  return `## About the User\n${sections}`
}
