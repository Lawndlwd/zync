import type { Profile, ProfileExperience, ProfileEducation, ProfileProject } from '@/types/jobs'

/**
 * Serialize a Profile into structured markdown for editing.
 * The format uses headings and structured text that can be parsed back.
 */
export function profileToMarkdown(p: Profile): string {
  const lines: string[] = []

  // Header
  lines.push(`# ${p.name || 'Your Name'}`)
  if (p.title) lines.push(`**${p.title}**`)
  lines.push('')

  // Contact
  const contact = [p.email, p.phone, p.location, p.linkedin, p.website].filter(Boolean)
  if (contact.length) {
    lines.push(contact.join(' · '))
    lines.push('')
  }

  // Summary
  if (p.summary) {
    lines.push('## Summary')
    lines.push(p.summary)
    lines.push('')
  }

  // Experience
  if (p.experiences?.length) {
    lines.push('## Experience')
    for (const exp of p.experiences) {
      lines.push(`### ${exp.title} | ${exp.company}${exp.location ? ` | ${exp.location}` : ''}`)
      lines.push(`*${exp.startDate} — ${exp.endDate || 'Present'}*`)
      if (exp.bullets.length) {
        for (const b of exp.bullets) {
          lines.push(`- ${b}`)
        }
      }
      lines.push('')
    }
  }

  // Education
  if (p.educations?.length) {
    lines.push('## Education')
    for (const edu of p.educations) {
      lines.push(`### ${edu.degree}${edu.field ? ` in ${edu.field}` : ''} | ${edu.school}`)
      lines.push(`*${edu.startDate} — ${edu.endDate || 'Present'}*`)
      if (edu.gpa) lines.push(`GPA: ${edu.gpa}`)
      lines.push('')
    }
  }

  // Projects
  if (p.projects?.length) {
    lines.push('## Projects')
    for (const proj of p.projects) {
      lines.push(`### ${proj.name}${proj.url ? ` — ${proj.url}` : ''}`)
      lines.push(proj.description)
      if (proj.technologies.length) {
        lines.push(`*${proj.technologies.join(', ')}*`)
      }
      lines.push('')
    }
  }

  // Skills
  if (p.skills?.length) {
    lines.push('## Skills')
    lines.push(p.skills.join(', '))
    lines.push('')
  }

  // Languages
  if (p.languages?.length) {
    lines.push('## Languages')
    lines.push(p.languages.join(', '))
    lines.push('')
  }

  return lines.join('\n').trim()
}

/**
 * Parse structured markdown back into Profile fields.
 * Returns a partial profile with only the parsed fields.
 */
export function markdownToProfile(md: string): Partial<Profile> {
  const result: Partial<Profile> = {}
  const lines = md.split('\n')

  let currentSection = ''
  let currentEntry: Record<string, any> | null = null
  const experiences: ProfileExperience[] = []
  const educations: ProfileEducation[] = []
  const projects: ProfileProject[] = []
  let summaryLines: string[] = []
  let collectingSummary = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // H1 = Name
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
      result.name = trimmed.slice(2).trim()
      // Next line might be bold title
      const next = lines[i + 1]?.trim()
      if (next && next.startsWith('**') && next.endsWith('**')) {
        result.title = next.slice(2, -2).trim()
        i++
      }
      // Contact line (contains · separator)
      const contactLine = lines[i + 1]?.trim()
      if (contactLine && contactLine.includes('·')) {
        parseContactLine(contactLine, result)
        i++
      }
      continue
    }

    // H2 = Section
    if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
      // Flush previous section
      if (collectingSummary && summaryLines.length) {
        result.summary = summaryLines.join('\n').trim()
        summaryLines = []
        collectingSummary = false
      }
      flushEntry(currentSection, currentEntry, experiences, educations, projects)
      currentEntry = null

      currentSection = trimmed.slice(3).trim().toLowerCase()
      if (currentSection === 'summary') collectingSummary = true
      continue
    }

    // H3 = Entry within a section
    if (trimmed.startsWith('### ')) {
      if (collectingSummary && summaryLines.length) {
        result.summary = summaryLines.join('\n').trim()
        summaryLines = []
        collectingSummary = false
      }
      flushEntry(currentSection, currentEntry, experiences, educations, projects)

      const entryText = trimmed.slice(4).trim()
      currentEntry = parseEntryHeader(currentSection, entryText)
      continue
    }

    // Collecting summary text
    if (collectingSummary) {
      if (trimmed) summaryLines.push(trimmed)
      continue
    }

    // Inside an entry
    if (currentEntry) {
      // Dates line: *date — date*
      if (trimmed.startsWith('*') && trimmed.endsWith('*') && trimmed.includes('—')) {
        const dateStr = trimmed.slice(1, -1)
        const [start, end] = dateStr.split('—').map(s => s.trim())
        currentEntry.startDate = start
        currentEntry.endDate = end === 'Present' ? '' : end
        continue
      }
      // Bullet point
      if (trimmed.startsWith('- ')) {
        if (!currentEntry.bullets) currentEntry.bullets = []
        currentEntry.bullets.push(trimmed.slice(2).trim())
        continue
      }
      // GPA line
      if (trimmed.startsWith('GPA:')) {
        currentEntry.gpa = trimmed.slice(4).trim()
        continue
      }
      // Tech line (italic)
      if (trimmed.startsWith('*') && trimmed.endsWith('*') && currentSection === 'projects') {
        currentEntry.technologies = trimmed.slice(1, -1).split(',').map((s: string) => s.trim())
        continue
      }
      // Description text for projects
      if (trimmed && currentSection === 'projects' && !currentEntry.description) {
        currentEntry.description = trimmed
        continue
      }
      continue
    }

    // Section-level content (skills, languages as comma lists)
    if (trimmed && currentSection === 'skills') {
      result.skills = trimmed.split(',').map(s => s.trim()).filter(Boolean)
      continue
    }
    if (trimmed && currentSection === 'languages') {
      result.languages = trimmed.split(',').map(s => s.trim()).filter(Boolean)
      continue
    }
  }

  // Flush final
  if (collectingSummary && summaryLines.length) {
    result.summary = summaryLines.join('\n').trim()
  }
  flushEntry(currentSection, currentEntry, experiences, educations, projects)

  if (experiences.length) result.experiences = experiences
  if (educations.length) result.educations = educations
  if (projects.length) result.projects = projects

  return result
}

function parseContactLine(line: string, result: Partial<Profile>) {
  const items = line.split('·').map(s => s.trim()).filter(Boolean)
  for (const item of items) {
    if (item.includes('@')) result.email = item
    else if (/^\+?[\d\s()-]+$/.test(item)) result.phone = item
    else if (item.includes('linkedin')) result.linkedin = item
    else if (item.startsWith('http') || item.includes('.com') || item.includes('.io')) result.website = item
    else result.location = item
  }
}

function parseEntryHeader(section: string, text: string): Record<string, any> {
  const parts = text.split('|').map(s => s.trim())

  if (section === 'experience') {
    return {
      id: crypto.randomUUID(),
      title: parts[0] || '',
      company: parts[1] || '',
      location: parts[2] || '',
      startDate: '',
      endDate: '',
      bullets: [],
    }
  }

  if (section === 'education') {
    const degreeField = parts[0] || ''
    const inMatch = degreeField.match(/^(.+?)\s+in\s+(.+)$/i)
    return {
      id: crypto.randomUUID(),
      degree: inMatch ? inMatch[1] : degreeField,
      field: inMatch ? inMatch[2] : '',
      school: parts[1] || '',
      startDate: '',
      endDate: '',
      gpa: '',
    }
  }

  if (section === 'projects') {
    const nameUrl = parts[0] || ''
    const dashMatch = nameUrl.match(/^(.+?)\s*—\s*(.+)$/)
    return {
      id: crypto.randomUUID(),
      name: dashMatch ? dashMatch[1] : nameUrl,
      url: dashMatch ? dashMatch[2] : '',
      description: '',
      technologies: [],
    }
  }

  return { id: crypto.randomUUID() }
}

function flushEntry(
  section: string,
  entry: Record<string, any> | null,
  experiences: ProfileExperience[],
  educations: ProfileEducation[],
  projects: ProfileProject[],
) {
  if (!entry) return
  if (section === 'experience') experiences.push(entry as ProfileExperience)
  else if (section === 'education') educations.push(entry as ProfileEducation)
  else if (section === 'projects') projects.push(entry as ProfileProject)
}
