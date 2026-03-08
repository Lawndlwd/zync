export interface JiraAttachment {
  id: string
  filename: string
  contentUrl: string
  mimeType: string
  thumbnail?: string
}

export interface JiraIssue {
  id: string
  key: string
  summary: string
  description: string | null
  status: JiraStatus
  priority: JiraPriority
  labels: string[]
  assignee: JiraUser | null
  reporter: JiraUser | null
  sprint: JiraSprint | null
  created: string
  updated: string
  transitions: JiraTransition[]
  comments: JiraComment[]
  attachments: JiraAttachment[]
}

export interface JiraStatus {
  id: string
  name: string
  category: 'new' | 'indeterminate' | 'done'
}

export interface JiraPriority {
  id: string
  name: string
  iconUrl: string
}

export interface JiraUser {
  accountId: string
  displayName: string
  avatarUrl: string
  emailAddress: string
}

export interface JiraSprint {
  id: number
  name: string
  state: 'active' | 'closed' | 'future'
  startDate: string
  endDate: string
}

export interface JiraTransition {
  id: string
  name: string
  to: JiraStatus
}

export interface JiraComment {
  id: string
  author: JiraUser
  body: string
  created: string
  updated: string
}

export interface JiraSearchResponse {
  issues: JiraIssue[]
  total: number
  startAt: number
  maxResults: number
}

export interface JiraBoard {
  id: number
  name: string
  type: 'scrum' | 'kanban' | 'simple'
  projectKey?: string
}

export interface JiraBoardColumn {
  name: string
  statuses: { id: string; name: string }[]
}

export interface JiraBoardConfig {
  columns: JiraBoardColumn[]
}

// ── Field Metadata (createmeta) ──

export interface JiraFieldSchema {
  type: string
  items?: string
  custom?: string
  system?: string
  customId?: number
}

export interface JiraFieldMeta {
  fieldId: string
  name: string
  required: boolean
  schema: JiraFieldSchema
  allowedValues?: Array<{ id: string; name?: string; value?: string; [key: string]: any }>
  hasDefaultValue: boolean
  operations: string[]
}

// ── Issue Creation Types ──

export interface JiraIssueType {
  id: string
  name: string
  iconUrl: string
  subtask: boolean
}

export interface JiraComponent {
  id: string
  name: string
}

export interface JiraVersion {
  id: string
  name: string
  released: boolean
}

export interface JiraProject {
  key: string
  name: string
  avatarUrl: string
}

export interface JiraProjectMeta {
  issueTypes: JiraIssueType[]
  components: JiraComponent[]
  versions: JiraVersion[]
  priorities: JiraPriority[]
  labels: string[]
}

export interface CreateIssuePayload {
  projectKey: string
  issueTypeId: string
  summary: string
  description?: string
  priorityId?: string
  assigneeId?: string
  reporterId?: string
  labels?: string[]
  componentIds?: string[]
  fixVersionIds?: string[]
  customFields?: Record<string, any>
}

export interface CreateIssueResponse {
  id: string
  key: string
  self: string
}

export interface CreateIssueFormState {
  projectKey: string
  issueTypeId: string
  summary: string
  description: string
  priorityId: string
  assigneeId: string
  reporterId: string
  labels: string[]
  componentIds: string[]
  fixVersionIds: string[]
  customFields: Record<string, any>
}
