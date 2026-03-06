import { z } from 'zod'

// --- Jira ---
export const JiraTransitionSchema = z.object({
  transitionId: z.string(),
})

export const JiraCommentSchema = z.object({
  body: z.string().min(1),
})

export const JiraCreateIssueSchema = z.object({
  projectKey: z.string(),
  issueTypeId: z.string(),
  summary: z.string().min(1),
  description: z.string().optional(),
  priorityId: z.string().optional(),
  assigneeId: z.string().optional(),
  reporterId: z.string().optional(),
  labels: z.array(z.string()).optional(),
  componentIds: z.array(z.string()).optional(),
  fixVersionIds: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
})

// --- LLM ---
export const LlmChatSchema = z.object({
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).min(1),
})

// --- Bot ---
export const GmailReplySchema = z.object({
  to: z.string().min(1),
  body: z.string().min(1),
  subject: z.string().optional(),
  threadId: z.string().optional(),
  messageId: z.string().optional(),
})

export const BriefingTriggerSchema = z.object({
  type: z.enum(['morning', 'evening']),
})

export const MemoryCreateSchema = z.object({
  content: z.string().min(1),
  category: z.string().optional(),
})

export const ScheduleCreateSchema = z.object({
  cron_expression: z.string().min(1),
  prompt: z.string().min(1),
  chat_id: z.union([z.string(), z.number()]),
})

export const BotChatSchema = z.object({
  message: z.string().min(1),
})

// --- GitLab ---
export const GitlabConfigSchema = z.object({
  baseUrl: z.string().url(),
  pat: z.string().min(1),
})

export const GitlabNoteSchema = z.object({
  body: z.string().min(1),
})

export const GitlabDiscussionSchema = z.object({
  body: z.string().min(1),
  position: z.record(z.unknown()).optional(),
})

export const GitlabCreateMrSchema = z.object({
  source_branch: z.string(),
  target_branch: z.string(),
  title: z.string().min(1),
}).passthrough()

// --- Todos ---
export const TodoCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  linkedIssue: z.string().nullable().optional(),
  priority: z.string().optional(),
  dueDate: z.string().nullable().optional(),
})

export const TodoUpdateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  linkedIssue: z.string().nullable().optional(),
  priority: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  status: z.string().optional(),
  order: z.number().optional(),
})

// --- Documents ---
export const FolderCreateSchema = z.object({
  name: z.string().min(1),
})

export const FolderRenameSchema = z.object({
  name: z.string().min(1),
})

export const DocumentCreateSchema = z.object({
  folder: z.string().min(1),
  title: z.string().min(1),
  content: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const DocumentUpdateSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  folder: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const DocumentBulkSchema = z.object({
  paths: z.array(z.string()).min(1),
})

// --- Projects ---
export const ProjectCreateSchema = z.object({
  name: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
  content: z.string().optional(),
})

export const ProjectUpdateSchema = z.object({
  metadata: z.record(z.unknown()).optional(),
  content: z.string().optional(),
  newName: z.string().optional(),
})

export const TaskCreateSchema = z.object({
  title: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
  content: z.string().optional(),
})

export const TaskUpdateSchema = z.object({
  metadata: z.record(z.unknown()).optional(),
  content: z.string().optional(),
})

// --- Settings ---
export const AgentModelConfigSchema = z.object({
  prAgent: z.object({ model: z.string() }).optional(),
  opencode: z.object({ model: z.string() }).optional(),
  bot: z.object({ model: z.string() }).optional(),
})

// --- Canvas ---
export const CanvasRenderSchema = z.object({
  html: z.string().min(1),
  css: z.string().optional(),
  js: z.string().optional(),
  title: z.string().optional(),
})

export const CanvasPromptSchema = z.object({
  prompt: z.string().min(1),
  canvasId: z.number().optional(),
})

// --- PR Agent ---
export const PrAgentRunSchema = z.object({
  tool: z.enum(['review', 'describe', 'improve', 'ask']),
  mrUrl: z.string().min(1),
  projectId: z.number().optional(),
  mrIid: z.number().optional(),
  headSha: z.string().optional(),
  question: z.string().optional(),
  extraInstructions: z.string().optional(),
})

// --- Channel Config ---
export const TelegramConfigSchema = z.object({
  botToken: z.string().optional(),
  allowedUsers: z.string().optional(),
})

export const WhatsAppConfigSchema = z.object({
  allowedNumbers: z.string().optional(),
  autoReply: z.boolean().optional(),
  autoReplyInstructions: z.string().optional(),
})

export const GmailConfigSchema = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  refreshToken: z.string().optional(),
  enabledServices: z.array(z.string()).optional(),
})

// --- Secrets ---
export const SecretSetSchema = z.object({
  name: z.string().min(1).max(255),
  value: z.string().min(1),
  category: z.string().max(64).default('general'),
})

// --- Setup ---
export const SetupVerifySchema = z.object({
  service: z.enum(['jira', 'gitlab', 'telegram', 'llm']),
  config: z.record(z.unknown()),
})

// --- Config ---
export const ConfigSetSchema = z.object({
  value: z.string(),
  category: z.string().max(64).default('general'),
})

export const ConfigBulkSetSchema = z.array(
  z.object({
    key: z.string().min(1).max(255),
    value: z.string(),
    category: z.string().max(64).default('general'),
  })
)

// --- Jobs ---
export const CampaignCreateSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
  salary_min: z.number().nullable().optional(),
  salary_max: z.number().nullable().optional(),
  remote: z.enum(['onsite', 'remote', 'hybrid', 'any']).default('any'),
  experience_level: z.enum(['junior', 'mid', 'senior', 'any']).default('any'),
  max_results: z.number().min(1).max(20).default(5),
  posted_within_days: z.number().min(1).max(30).nullable().optional(),
})

export const CampaignStatusSchema = z.object({
  status: z.enum(['idle', 'hunting', 'curated', 'applying', 'closed']),
})

export const JobStatusSchema = z.object({
  status: z.enum(['new', 'shortlisted', 'applied', 'dismissed']),
})

const ProfileExperienceSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  bullets: z.array(z.string()),
})

const ProfileEducationSchema = z.object({
  id: z.string(),
  school: z.string(),
  degree: z.string(),
  field: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  gpa: z.string().optional(),
})

const ProfileProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  url: z.string().optional(),
  technologies: z.array(z.string()),
})

const CvThemeSchema = z.object({
  id: z.string(),
  name: z.string(),
  layout: z.enum(['single-column', 'two-column', 'sidebar']),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  accentColor: z.string(),
  backgroundColor: z.string(),
  fontHeading: z.string(),
  fontBody: z.string(),
  fontSize: z.number(),
  lineHeight: z.number(),
  sectionSpacing: z.number(),
  headerStyle: z.enum(['centered', 'left', 'inline']),
  showPhoto: z.boolean(),
})

export const ProfileUpdateSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedin: z.string().optional(),
  website: z.string().optional(),
  skills: z.array(z.string()).optional(),
  experience: z.string().optional(),
  experiences: z.array(ProfileExperienceSchema).optional(),
  education: z.string().optional(),
  educations: z.array(ProfileEducationSchema).optional(),
  projects: z.array(ProfileProjectSchema).optional(),
  languages: z.array(z.string()).optional(),
  cv_theme: CvThemeSchema.optional(),
})
