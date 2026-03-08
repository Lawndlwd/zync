import { getOrCreateSession } from '../opencode/client.js'
import { waitForResponse } from '../opencode/wait-for-response.js'
import { updateJobScore, updateJobCuration, updateJobStatus } from './db.js'
import { logger } from '../lib/logger.js'
import { loadPromptContent, interpolate } from '../skills/prompts.js'
import type { Job, Profile, Campaign } from './types.js'

const SESSION_PURPOSE = 'jobs-ai'

function extractJSON(text: string): any {
  // Try to find JSON in markdown fences first
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr = fenced ? fenced[1].trim() : text.trim()
  return JSON.parse(jsonStr)
}

export async function parseResume(rawText: string): Promise<Omit<Profile, 'id' | 'updated_at' | 'raw_text'>> {
  const sessionId = await getOrCreateSession(SESSION_PURPOSE)

  const prompt = interpolate(loadPromptContent('resume-parser'), {
    resumeText: rawText.slice(0, 8000),
  })

  const response = await waitForResponse(sessionId, prompt)

  try {
    return extractJSON(response)
  } catch {
    logger.error({ response: response.slice(0, 500) }, 'Failed to parse resume JSON from LLM')
    return {
      name: '', title: '', summary: rawText.slice(0, 200),
      email: '', phone: '', location: '', linkedin: '', website: '',
      skills: [], experience: '', experiences: [],
      education: '', educations: [], projects: [],
      languages: [],
    }
  }
}

export async function scoreJobs(jobs: Job[], profile: Profile): Promise<void> {
  const batchSize = 10
  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize)
    const sessionId = await getOrCreateSession(SESSION_PURPOSE)

    const jobSummaries = batch.map((j, idx) => (
      `[${idx}] "${j.title}" at ${j.company} — ${j.location}${j.salary ? ` — ${j.salary}` : ''}\nDescription: ${j.description.slice(0, 300)}`
    )).join('\n\n')

    const profileSummary = `
Name: ${profile.name}
Title: ${profile.title}
Skills: ${profile.skills.join(', ')}
Summary: ${profile.summary}
Experience: ${profile.experience.slice(0, 500)}`

    const prompt = interpolate(loadPromptContent('job-scoring'), {
      count: String(batch.length),
      profileSummary,
      jobSummaries,
    })

    const response = await waitForResponse(sessionId, prompt)

    try {
      const scores = extractJSON(response) as Array<{ index: number; score: number; reasons: string }>
      for (const s of scores) {
        const job = batch[s.index]
        if (job) {
          updateJobScore(job.id, s.score, s.reasons)
        }
      }
      logger.info({ scored: scores.length, batch: i / batchSize + 1 }, 'Batch scored')
    } catch {
      logger.error({ response: response.slice(0, 500) }, 'Failed to parse scores from LLM')
    }
  }
}

export async function curateJobs(jobs: Job[], campaign: Campaign, profile: Profile): Promise<void> {
  if (jobs.length === 0) return

  const sessionId = await getOrCreateSession(SESSION_PURPOSE)

  const jobSummaries = jobs.map((j, idx) => {
    const desc = j.description?.trim() ? `\nDescription: ${j.description.slice(0, 400)}` : ''
    return `[${idx}] "${j.title}" at ${j.company} — ${j.location}${j.salary ? ` — ${j.salary}` : ''}${desc}`
  }).join('\n\n')

  const profileSummary = `
Name: ${profile.name}
Title: ${profile.title}
Skills: ${profile.skills.join(', ')}
Summary: ${profile.summary}
Experience: ${profile.experience.slice(0, 500)}`

  const criteria = `
Role sought: ${campaign.role}
Location: ${campaign.city}, ${campaign.country}
Remote preference: ${campaign.remote}
Experience level: ${campaign.experience_level}
${campaign.salary_min || campaign.salary_max ? `Salary range: ${campaign.salary_min ?? '?'}–${campaign.salary_max ?? '?'} EUR` : ''}`

  const prompt = interpolate(loadPromptContent('job-curation'), {
    count: String(jobs.length),
    maxResults: String(campaign.max_results),
    role: campaign.role,
    criteria,
    profileSummary,
    jobSummaries,
  })

  const response = await waitForResponse(sessionId, prompt)

  try {
    const curated = extractJSON(response) as Array<{
      index: number; score: number; reasons: string; company_insight: string
    }>

    const selectedIndices = new Set(curated.map(c => c.index))

    // Update selected jobs with scores and insights
    for (const c of curated) {
      const job = jobs[c.index]
      if (job) {
        updateJobCuration(job.id, c.score, c.reasons, c.company_insight)
      }
    }

    // Dismiss jobs not selected
    for (let i = 0; i < jobs.length; i++) {
      if (!selectedIndices.has(i)) {
        updateJobStatus(jobs[i].id, 'dismissed')
      }
    }

    logger.info({ curated: curated.length, dismissed: jobs.length - curated.length }, 'Jobs curated')
  } catch {
    logger.error({ response: response.slice(0, 500) }, 'Failed to parse curation from LLM')
  }
}

export async function generateCoverLetter(job: Job, profile: Profile): Promise<string> {
  const sessionId = await getOrCreateSession(SESSION_PURPOSE)

  const prompt = interpolate(loadPromptContent('cover-letter'), {
    name: profile.name,
    title: profile.title,
    skills: profile.skills.join(', '),
    summary: profile.summary,
    experience: profile.experience.slice(0, 800),
    jobTitle: job.title,
    company: job.company,
    location: job.location,
    jobDescription: job.description.slice(0, 1500),
  })

  return waitForResponse(sessionId, prompt)
}

export async function generateInterviewPrep(job: Job, profile: Profile): Promise<string> {
  const sessionId = await getOrCreateSession(SESSION_PURPOSE)

  const prompt = interpolate(loadPromptContent('interview-prep'), {
    name: profile.name,
    title: profile.title,
    skills: profile.skills.join(', '),
    experience: profile.experience.slice(0, 800),
    jobTitle: job.title,
    company: job.company,
    jobDescription: job.description.slice(0, 1500),
  })

  return waitForResponse(sessionId, prompt)
}
