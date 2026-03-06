export type CampaignStatus = 'idle' | 'hunting' | 'curated' | 'applying' | 'closed'
export type JobStatus = 'new' | 'shortlisted' | 'applied' | 'dismissed'
export type JobSource = 'indeed' | 'linkedin' | 'wttj'
export type DocType = 'cover_letter' | 'interview_prep'
export type RemotePreference = 'onsite' | 'remote' | 'hybrid' | 'any'
export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'any'

export interface Campaign {
  id: number
  name: string
  role: string
  city: string
  country: string
  salary_min: number | null
  salary_max: number | null
  remote: RemotePreference
  experience_level: ExperienceLevel
  max_results: number
  posted_within_days: number | null
  status: CampaignStatus
  created_at: string
  updated_at: string
}

export interface ProfileExperience {
  id: string
  title: string
  company: string
  location?: string
  startDate: string
  endDate?: string
  bullets: string[]
}

export interface ProfileEducation {
  id: string
  school: string
  degree: string
  field?: string
  startDate: string
  endDate?: string
  gpa?: string
}

export interface ProfileProject {
  id: string
  name: string
  description: string
  url?: string
  technologies: string[]
}

export interface CvTheme {
  id: string
  name: string
  layout: 'single-column' | 'two-column' | 'sidebar' | 'left-sidebar' | 'compact' | 'timeline'
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  fontHeading: string
  fontBody: string
  fontSize: number
  lineHeight: number
  sectionSpacing: number
  headerStyle: 'centered' | 'left' | 'inline'
  showPhoto: boolean
}

export interface Profile {
  id: number
  name: string
  title: string
  summary: string
  email?: string
  phone?: string
  location?: string
  linkedin?: string
  website?: string
  skills: string[]
  experience: string  // JSON or markdown summary
  experiences: ProfileExperience[]
  education: string
  educations: ProfileEducation[]
  projects: ProfileProject[]
  languages: string[]
  raw_text: string
  cv_theme?: CvTheme
  updated_at: string
}

export interface Job {
  id: number
  campaign_id: number
  external_id: string
  source: JobSource
  title: string
  company: string
  location: string
  salary: string | null
  description: string
  url: string
  score: number | null
  score_reasons: string | null
  company_insight: string | null
  status: JobStatus
  created_at: string
  updated_at: string
}

export interface GeneratedDoc {
  id: number
  job_id: number
  doc_type: DocType
  content: string
  created_at: string
}

export interface JobStats {
  total_jobs: number
  avg_score: number | null
  by_source: Record<JobSource, number>
  by_status: Record<JobStatus, number>
  shortlisted_count: number
}
