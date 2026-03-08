import type { JiraIssue, JiraSearchResponse, JiraComment, JiraBoard, JiraBoardConfig, JiraProjectMeta, JiraProject, JiraUser, CreateIssuePayload, CreateIssueResponse, JiraFieldMeta } from '@zync/shared/types'

const API_BASE = '/api/jira'

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Jira API error: ${res.status} - ${text}`)
  }
  return res.json()
}

export async function searchIssues(jql?: string): Promise<JiraSearchResponse> {
  const params = new URLSearchParams()
  if (jql) params.set('jql', jql)
  return fetchJSON<JiraSearchResponse>(`${API_BASE}/search?${params}`)
}

export async function getIssue(issueKey: string): Promise<JiraIssue> {
  return fetchJSON<JiraIssue>(`${API_BASE}/issue/${issueKey}`)
}

export async function transitionIssue(issueKey: string, transitionId: string): Promise<void> {
  await fetch(`${API_BASE}/issue/${issueKey}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transitionId }),
  })
}

export async function addComment(issueKey: string, body: string): Promise<JiraComment> {
  return fetchJSON<JiraComment>(`${API_BASE}/issue/${issueKey}/comment`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })
}

export async function getTransitions(issueKey: string) {
  return fetchJSON<{ transitions: Array<{ id: string; name: string; to: { name: string; statusCategory: { key: string } } }> }>(
    `${API_BASE}/issue/${issueKey}/transitions`
  )
}

// ── Board endpoints ──

export interface BoardsResponse {
  boards: JiraBoard[]
  total: number
  startAt: number
  isLast: boolean
}

export async function fetchBoards(opts?: {
  projectKey?: string
  search?: string
  startAt?: number
  maxResults?: number
}): Promise<BoardsResponse> {
  const params = new URLSearchParams()
  if (opts?.projectKey) params.set('projectKey', opts.projectKey)
  if (opts?.search) params.set('search', opts.search)
  if (opts?.startAt) params.set('startAt', String(opts.startAt))
  if (opts?.maxResults) params.set('maxResults', String(opts.maxResults))
  return fetchJSON(`${API_BASE}/boards?${params}`)
}

export async function fetchServerSettings(): Promise<{
  jira: { baseUrl: string; email: string; apiToken: string; projectKey: string }
  gitlab: { baseUrl: string; pat: string }
  llm: { baseUrl: string; model: string; apiKey: string }
  messages: { customEndpoint: string }
}> {
  return fetchJSON('/api/settings')
}

export async function fetchBoardConfig(boardId: number): Promise<JiraBoardConfig> {
  return fetchJSON(`${API_BASE}/board/${boardId}/config`)
}

export interface BoardIssuesResponse extends JiraSearchResponse {
  sprint: { id: number; name: string; state: string; startDate: string; endDate: string } | null
}

export async function fetchBoardIssues(boardId: number, jql?: string): Promise<BoardIssuesResponse> {
  const params = new URLSearchParams()
  if (jql) params.set('jql', jql)
  return fetchJSON(`${API_BASE}/board/${boardId}/issues?${params}`)
}

export async function fetchActiveSprint(boardId: number) {
  return fetchJSON<{ id: number; name: string; state: string; startDate: string; endDate: string } | null>(
    `${API_BASE}/board/${boardId}/sprint`
  )
}

// ── Issue Creation ──

export async function fetchProjectMeta(projectKey: string): Promise<JiraProjectMeta> {
  return fetchJSON(`${API_BASE}/project/${projectKey}/meta`)
}

export async function fetchCreateFields(projectKey: string, issueTypeId: string): Promise<JiraFieldMeta[]> {
  return fetchJSON(`${API_BASE}/project/${projectKey}/issuetype/${issueTypeId}/fields`)
}

export async function searchUsers(query: string, projectKey?: string): Promise<JiraUser[]> {
  const params = new URLSearchParams({ query })
  if (projectKey) params.set('projectKey', projectKey)
  return fetchJSON(`${API_BASE}/users/search?${params}`)
}

export async function createIssue(payload: CreateIssuePayload): Promise<CreateIssueResponse> {
  return fetchJSON(`${API_BASE}/issue`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchProjects(): Promise<JiraProject[]> {
  return fetchJSON(`${API_BASE}/projects`)
}

export async function uploadAttachments(issueKey: string, files: File[]): Promise<void> {
  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file)
  }
  const res = await fetch(`${API_BASE}/issue/${issueKey}/attachments`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Upload failed: ${res.status} - ${text}`)
  }
}
