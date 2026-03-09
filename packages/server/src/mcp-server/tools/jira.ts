import { z } from 'zod'
import { getSecret } from '../../secrets/index.js'
import { getConfig } from '../../config/index.js'

function getJiraConfig() {
  const baseUrl = getConfig('JIRA_BASE_URL')
  const apiToken = getSecret('JIRA_API_TOKEN')
  const email = getConfig('JIRA_EMAIL')
  if (!baseUrl || !apiToken) {
    throw new Error('Jira not configured. Set JIRA_BASE_URL and JIRA_API_TOKEN in Settings.')
  }
  const isCloud = baseUrl.includes('atlassian.net')
  const authHeader = isCloud
    ? `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`
    : `Bearer ${apiToken}`
  const apiVersion = isCloud ? '3' : '2'
  return { baseUrl, authHeader, apiVersion }
}

async function jiraFetch(path: string, init?: RequestInit) {
  const { baseUrl, authHeader, apiVersion } = getJiraConfig()
  const url = `${baseUrl}/rest/api/${apiVersion}${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Jira ${res.status}: ${text}`)
  }
  return res.json()
}

export const getMyJiraIssuesSchema = z.object({
  jql: z
    .string()
    .optional()
    .describe('Optional JQL override (default: assignee = currentUser())'),
})

export async function getMyJiraIssues(input: z.infer<typeof getMyJiraIssuesSchema>) {
  const jql = input.jql || 'assignee = currentUser() ORDER BY updated DESC'
  const data = await jiraFetch(
    `/search?jql=${encodeURIComponent(jql)}&maxResults=50&fields=summary,status,priority`
  )
  const issues = (data.issues || []).map((i: any) => ({
    key: i.key,
    summary: i.fields?.summary || '',
    status: i.fields?.status?.name || '',
    priority: i.fields?.priority?.name || '',
  }))
  return JSON.stringify(issues)
}

export const transitionJiraIssueSchema = z.object({
  issue_key: z.string().describe('Jira issue key (e.g. PROJ-123)'),
  transition_id: z.string().describe('Transition ID'),
})

export async function transitionJiraIssue(input: z.infer<typeof transitionJiraIssueSchema>) {
  await jiraFetch(`/issue/${input.issue_key}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: input.transition_id } }),
  })
  return JSON.stringify({ success: true, issue: input.issue_key })
}

// --- New tools ---

export const createJiraIssueSchema = z.object({
  project_key: z.string().describe('Project key (e.g. PROJ)'),
  issue_type: z.string().default('Task').describe('Issue type (Task, Bug, Story, etc.)'),
  summary: z.string().describe('Issue summary/title'),
  description: z.string().optional().describe('Issue description'),
  priority: z.string().optional().describe('Priority name (e.g. High, Medium, Low)'),
  assignee: z.string().optional().describe('Assignee username'),
  labels: z.array(z.string()).optional().describe('Labels to add'),
})

export async function createJiraIssue(input: z.infer<typeof createJiraIssueSchema>) {
  const fields: Record<string, any> = {
    project: { key: input.project_key },
    issuetype: { name: input.issue_type },
    summary: input.summary,
  }
  if (input.description) fields.description = input.description
  if (input.priority) fields.priority = { name: input.priority }
  if (input.assignee) fields.assignee = { name: input.assignee }
  if (input.labels) fields.labels = input.labels

  const data = await jiraFetch('/issue', {
    method: 'POST',
    body: JSON.stringify({ fields }),
  })
  return JSON.stringify({ key: data.key, self: data.self })
}

export const addJiraCommentSchema = z.object({
  issue_key: z.string().describe('Jira issue key (e.g. PROJ-123)'),
  body: z.string().describe('Comment body text'),
})

export async function addJiraComment(input: z.infer<typeof addJiraCommentSchema>) {
  await jiraFetch(`/issue/${input.issue_key}/comment`, {
    method: 'POST',
    body: JSON.stringify({ body: input.body }),
  })
  return JSON.stringify({ success: true, issue: input.issue_key })
}

export const getJiraIssueSchema = z.object({
  issue_key: z.string().describe('Jira issue key (e.g. PROJ-123)'),
})

export async function getJiraIssue(input: z.infer<typeof getJiraIssueSchema>) {
  const data = await jiraFetch(`/issue/${input.issue_key}`)
  return JSON.stringify({
    key: data.key,
    summary: data.fields?.summary,
    status: data.fields?.status?.name,
    priority: data.fields?.priority?.name,
    assignee: data.fields?.assignee?.displayName || data.fields?.assignee?.name,
    reporter: data.fields?.reporter?.displayName || data.fields?.reporter?.name,
    description: data.fields?.description,
    labels: data.fields?.labels,
    created: data.fields?.created,
    updated: data.fields?.updated,
  })
}

export const searchJiraIssuesSchema = z.object({
  jql: z.string().describe('JQL query string'),
  max_results: z.number().default(50).describe('Maximum number of results (default 50)'),
})

export async function searchJiraIssues(input: z.infer<typeof searchJiraIssuesSchema>) {
  const data = await jiraFetch(
    `/search?jql=${encodeURIComponent(input.jql)}&maxResults=${input.max_results}&fields=summary,status,priority,assignee,labels`
  )
  const issues = (data.issues || []).map((i: any) => ({
    key: i.key,
    summary: i.fields?.summary || '',
    status: i.fields?.status?.name || '',
    priority: i.fields?.priority?.name || '',
    assignee: i.fields?.assignee?.displayName || i.fields?.assignee?.name || '',
    labels: i.fields?.labels || [],
  }))
  return JSON.stringify(issues)
}

export const getJiraTransitionsSchema = z.object({
  issue_key: z.string().describe('Jira issue key (e.g. PROJ-123)'),
})

export async function getJiraTransitions(input: z.infer<typeof getJiraTransitionsSchema>) {
  const data = await jiraFetch(`/issue/${input.issue_key}/transitions`)
  const transitions = (data.transitions || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    to: t.to?.name,
  }))
  return JSON.stringify(transitions)
}

export const summarizeSprintSchema = z.object({})

export async function summarizeSprint() {
  const data = await jiraFetch(
    `/search?jql=${encodeURIComponent('sprint in openSprints()')}&maxResults=200&fields=summary,status`
  )
  const issues = data.issues || []
  const byStatus: Record<string, number> = {}
  for (const i of issues) {
    const status = i.fields?.status?.name || 'Unknown'
    byStatus[status] = (byStatus[status] || 0) + 1
  }
  return JSON.stringify({ total: data.total || 0, byStatus })
}
