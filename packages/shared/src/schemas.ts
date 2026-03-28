import { z } from 'zod'

// --- LLM ---
export const LlmChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.string(),
        content: z.string(),
      }),
    )
    .min(1),
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

export const ScheduleCreateSchema = z.object({
  cron_expression: z.string().min(1),
  prompt: z.string().min(1),
  chat_id: z.union([z.string(), z.number()]),
})

export const BotChatSchema = z.object({
  message: z.string().min(1),
})

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
  service: z.enum(['telegram', 'llm']),
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
  }),
)

// _VeBekaDpDQba_dk7pamDm86MQp1OjNiaQk.01.0z1814vry
