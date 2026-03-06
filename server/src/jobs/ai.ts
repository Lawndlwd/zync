import { getOrCreateSession, sendPromptAsync, getSessionMessages, isSessionIdle } from '../opencode/client.js'
import { updateJobScore, updateJobCuration, updateJobStatus } from './db.js'
import { logger } from '../lib/logger.js'
import type { Job, Profile, Campaign } from './types.js'

const SESSION_PURPOSE = 'jobs-ai'

async function getResponse(sessionId: string, msgCountBefore: number, timeoutMs = 120_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1500))
    const idle = await isSessionIdle(sessionId)
    if (!idle) continue
    const msgs = await getSessionMessages(sessionId)
    if (msgs.length <= msgCountBefore) continue
    const newMsgs = msgs.slice(msgCountBefore)
    const last = [...newMsgs].reverse().find((m: any) => m.role === 'assistant' || m.info?.role === 'assistant')
    if (last?.parts) {
      const texts = last.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text)
      if (texts.length > 0 && texts.some((t: string) => t.length > 0)) {
        return texts.join('')
      }
    }
  }
  throw new Error('LLM response timed out')
}

function extractJSON(text: string): any {
  // Try to find JSON in markdown fences first
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr = fenced ? fenced[1].trim() : text.trim()
  return JSON.parse(jsonStr)
}

export async function parseResume(rawText: string): Promise<Omit<Profile, 'id' | 'updated_at' | 'raw_text'>> {
  const sessionId = await getOrCreateSession(SESSION_PURPOSE)
  const msgsBefore = (await getSessionMessages(sessionId)).length

  const prompt = `Parse this resume into structured JSON. Return ONLY a JSON object (in a markdown code fence) with these fields:
- name (string)
- title (string, current/desired job title)
- summary (string, 2-3 sentence professional summary)
- skills (string array)
- experience (string, concise markdown summary of work history)
- education (string, concise summary)
- languages (string array)

Resume text:
---
${rawText.slice(0, 8000)}
---`

  await sendPromptAsync(sessionId, prompt)
  const response = await getResponse(sessionId, msgsBefore)

  try {
    return extractJSON(response)
  } catch {
    logger.error({ response: response.slice(0, 500) }, 'Failed to parse resume JSON from LLM')
    return {
      name: '', title: '', summary: rawText.slice(0, 200),
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
    const msgsBefore = (await getSessionMessages(sessionId)).length

    const jobSummaries = batch.map((j, idx) => (
      `[${idx}] "${j.title}" at ${j.company} — ${j.location}${j.salary ? ` — ${j.salary}` : ''}\nDescription: ${j.description.slice(0, 300)}`
    )).join('\n\n')

    const profileSummary = `
Name: ${profile.name}
Title: ${profile.title}
Skills: ${profile.skills.join(', ')}
Summary: ${profile.summary}
Experience: ${profile.experience.slice(0, 500)}`

    const prompt = `Score these ${batch.length} jobs for this candidate on a scale of 0-10. Consider skill match, title alignment, and experience level.

Return ONLY a JSON array (in a markdown code fence) where each element has:
- index (number, matching the [index] above)
- score (number 0-10)
- reasons (string, brief 1-2 sentence explanation)

Candidate Profile:
${profileSummary}

Jobs:
${jobSummaries}`

    await sendPromptAsync(sessionId, prompt)
    const response = await getResponse(sessionId, msgsBefore)

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
  const msgsBefore = (await getSessionMessages(sessionId)).length

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

  const prompt = `You are a job search curator. You MUST analyze the jobs below and return a JSON result. NEVER ask questions or request more information — work with what you have.

Analyze these ${jobs.length} jobs for this candidate and pick the top ${campaign.max_results} best matches.

For each job:
1. Verify it actually matches the role "${campaign.role}" based on the job title
2. Use your knowledge of each company to assess quality — reputation, industry, size, employee satisfaction, typical salaries
3. Score 0-10 based on overall fit (role match, company reputation, salary, location)

Some jobs may not have descriptions — that's fine, evaluate based on title, company, and location.

You MUST return ONLY a JSON array (in a markdown code fence) of the top ${campaign.max_results} jobs. Each element:
- index (number, matching [index] above)
- score (number 0-10)
- reasons (string, 1-2 sentences why this is a good match)
- company_insight (string, a rich 4-6 sentence paragraph: what the company does, their reputation and culture from what you know, typical salary range for this kind of role there, company size and industry, and why it could be a good or bad fit for the candidate)

Jobs NOT in your top ${campaign.max_results} should be excluded from the array. Do NOT output anything other than the JSON code fence.

Campaign Criteria:
${criteria}

Candidate Profile:
${profileSummary}

Jobs:
${jobSummaries}`

  await sendPromptAsync(sessionId, prompt)
  const response = await getResponse(sessionId, msgsBefore)

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
  const msgsBefore = (await getSessionMessages(sessionId)).length

  const prompt = `Write a professional, tailored cover letter for this job application.

Candidate:
- Name: ${profile.name}
- Title: ${profile.title}
- Skills: ${profile.skills.join(', ')}
- Summary: ${profile.summary}
- Experience: ${profile.experience.slice(0, 800)}

Job:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Description: ${job.description.slice(0, 1500)}

Write a compelling, concise cover letter (3-4 paragraphs). Be specific about how the candidate's skills match the role. Do not use generic filler.`

  await sendPromptAsync(sessionId, prompt)
  return getResponse(sessionId, msgsBefore)
}

export async function generateInterviewPrep(job: Job, profile: Profile): Promise<string> {
  const sessionId = await getOrCreateSession(SESSION_PURPOSE)
  const msgsBefore = (await getSessionMessages(sessionId)).length

  const prompt = `Prepare interview preparation material for this job application.

Candidate:
- Name: ${profile.name}
- Title: ${profile.title}
- Skills: ${profile.skills.join(', ')}
- Experience: ${profile.experience.slice(0, 800)}

Job:
- Title: ${job.title}
- Company: ${job.company}
- Description: ${job.description.slice(0, 1500)}

Provide:
1. **Likely Interview Questions** (8-10 questions with suggested talking points)
2. **Technical Topics to Review** (based on job requirements)
3. **Questions to Ask the Interviewer** (5 thoughtful questions)
4. **Company Research Notes** (what to look up about ${job.company})
5. **Key Strengths to Highlight** (based on profile-job match)

Be specific and actionable.`

  await sendPromptAsync(sessionId, prompt)
  return getResponse(sessionId, msgsBefore)
}
