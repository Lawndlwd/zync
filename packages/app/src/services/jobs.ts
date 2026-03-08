import type { Campaign, CampaignStatus, RemotePreference, ExperienceLevel, Profile, Job, JobStatus, GeneratedDoc, JobStats } from '@zync/shared/types'

const API_BASE = '/api/jobs'

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// Campaigns
export const fetchCampaigns = () => api<Campaign[]>('/campaigns')
export const createCampaign = (data: {
  name: string
  role: string
  city: string
  country: string
  salary_min?: number | null
  salary_max?: number | null
  remote?: RemotePreference
  experience_level?: ExperienceLevel
  max_results?: number
  posted_within_days?: number | null
}) =>
  api<Campaign>('/campaigns', { method: 'POST', body: JSON.stringify(data) })
export const updateCampaignStatus = (id: number, status: CampaignStatus) =>
  api<Campaign>(`/campaigns/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
export const deleteCampaign = (id: number) =>
  api<{ success: boolean }>(`/campaigns/${id}`, { method: 'DELETE' })

// Jobs
export const fetchCampaignJobs = (campaignId: number, status?: JobStatus) =>
  api<Job[]>(`/campaigns/${campaignId}/jobs${status ? `?status=${status}` : ''}`)
export const fetchJob = (id: number) => api<Job>(`/jobs/${id}`)
export const updateJobStatus = (id: number, status: JobStatus) =>
  api<Job>(`/jobs/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
export const triggerScrape = (campaignId: number) =>
  api<{ status: string }>(`/campaigns/${campaignId}/scrape`, { method: 'POST' })

// Profile
export const fetchProfile = () => api<Profile | null>('/profile')
export async function uploadResume(file: File): Promise<Profile> {
  const formData = new FormData()
  formData.append('resume', file)
  const res = await fetch(`${API_BASE}/profile/upload`, { method: 'POST', body: formData })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}
export const updateProfile = (data: Partial<Profile>) =>
  api<Profile>('/profile', { method: 'PUT', body: JSON.stringify(data) })

// Docs
export const generateCoverLetter = (jobId: number) =>
  api<GeneratedDoc>(`/jobs/${jobId}/cover-letter`, { method: 'POST' })
export const generateInterviewPrep = (jobId: number) =>
  api<GeneratedDoc>(`/jobs/${jobId}/interview-prep`, { method: 'POST' })
export const fetchJobDocs = (jobId: number) => api<GeneratedDoc[]>(`/jobs/${jobId}/docs`)

// Schedule
export interface ScrapeSchedule { cron: string; timezone: string; times: string }
export const fetchSchedule = () => api<ScrapeSchedule>('/schedule')

// Stats
export const fetchJobStats = (campaignId?: number) =>
  api<JobStats>(`/stats${campaignId ? `?campaign_id=${campaignId}` : ''}`)
