import { z } from 'zod'
import { getSecret } from '../../secrets/index.js'
import { getConfig } from '../../config/index.js'

function getGitlabConfig() {
  const baseUrl = getSecret('GITLAB_BASE_URL') || getConfig('GITLAB_BASE_URL')
  const pat = getSecret('GITLAB_PAT')
  if (!baseUrl || !pat) {
    throw new Error('GitLab not configured. Add GITLAB_BASE_URL and GITLAB_PAT in Settings > Integrations > GitLab or the Vault.')
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), pat }
}

async function gitlabFetch(path: string, init?: RequestInit) {
  const { baseUrl, pat } = getGitlabConfig()
  const res = await fetch(`${baseUrl}/api/v4${path}`, {
    ...init,
    headers: {
      'PRIVATE-TOKEN': pat,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitLab ${res.status}: ${text}`)
  }
  return res.json()
}

// --- Tools ---

export const listGitlabProjectsSchema = z.object({
  search: z.string().optional().describe('Search query to filter projects'),
  per_page: z.number().default(20).describe('Results per page (default 20)'),
})

export async function listGitlabProjects(input: z.infer<typeof listGitlabProjectsSchema>) {
  const params = new URLSearchParams({
    membership: 'true',
    order_by: 'last_activity_at',
    sort: 'desc',
    per_page: String(input.per_page),
  })
  if (input.search) params.set('search', input.search)
  const projects = await gitlabFetch(`/projects?${params}`)
  return JSON.stringify(
    (projects as any[]).map((p) => ({
      id: p.id,
      name: p.name,
      path_with_namespace: p.path_with_namespace,
      web_url: p.web_url,
      default_branch: p.default_branch,
    }))
  )
}

export const listMergeRequestsSchema = z.object({
  project_id: z.string().describe('GitLab project ID or URL-encoded path'),
  state: z.string().default('opened').describe('MR state: opened, closed, merged, all'),
  author_username: z.string().optional().describe('Filter by author username'),
  reviewer_username: z.string().optional().describe('Filter by reviewer username'),
  search: z.string().optional().describe('Search in title and description'),
})

export async function listMergeRequests(input: z.infer<typeof listMergeRequestsSchema>) {
  const params = new URLSearchParams({
    state: input.state,
    order_by: 'updated_at',
    sort: 'desc',
  })
  if (input.author_username) params.set('author_username', input.author_username)
  if (input.reviewer_username) params.set('reviewer_username', input.reviewer_username)
  if (input.search) params.set('search', input.search)
  const mrs = await gitlabFetch(`/projects/${encodeURIComponent(input.project_id)}/merge_requests?${params}`)
  return JSON.stringify(
    (mrs as any[]).map((mr) => ({
      iid: mr.iid,
      title: mr.title,
      state: mr.state,
      author: mr.author?.username,
      web_url: mr.web_url,
      source_branch: mr.source_branch,
      target_branch: mr.target_branch,
      updated_at: mr.updated_at,
    }))
  )
}

export const getMergeRequestSchema = z.object({
  project_id: z.string().describe('GitLab project ID or URL-encoded path'),
  mr_iid: z.number().describe('Merge request IID'),
})

export async function getMergeRequest(input: z.infer<typeof getMergeRequestSchema>) {
  const mr = await gitlabFetch(
    `/projects/${encodeURIComponent(input.project_id)}/merge_requests/${input.mr_iid}`
  )
  return JSON.stringify({
    iid: mr.iid,
    title: mr.title,
    description: mr.description,
    state: mr.state,
    author: mr.author?.username,
    reviewers: (mr.reviewers || []).map((r: any) => r.username),
    source_branch: mr.source_branch,
    target_branch: mr.target_branch,
    web_url: mr.web_url,
    created_at: mr.created_at,
    updated_at: mr.updated_at,
    merge_status: mr.merge_status,
    has_conflicts: mr.has_conflicts,
  })
}

export const commentOnMergeRequestSchema = z.object({
  project_id: z.string().describe('GitLab project ID or URL-encoded path'),
  mr_iid: z.number().describe('Merge request IID'),
  body: z.string().describe('Comment body (markdown supported)'),
})

export async function commentOnMergeRequest(input: z.infer<typeof commentOnMergeRequestSchema>) {
  const note = await gitlabFetch(
    `/projects/${encodeURIComponent(input.project_id)}/merge_requests/${input.mr_iid}/notes`,
    { method: 'POST', body: JSON.stringify({ body: input.body }) }
  )
  return JSON.stringify({ id: note.id, success: true })
}

export const listGitlabBranchesSchema = z.object({
  project_id: z.string().describe('GitLab project ID or URL-encoded path'),
  search: z.string().optional().describe('Search branch names'),
})

export async function listGitlabBranches(input: z.infer<typeof listGitlabBranchesSchema>) {
  const params = new URLSearchParams({ per_page: '100' })
  if (input.search) params.set('search', input.search)
  const branches = await gitlabFetch(
    `/projects/${encodeURIComponent(input.project_id)}/repository/branches?${params}`
  )
  return JSON.stringify(
    (branches as any[]).map((b) => ({
      name: b.name,
      merged: b.merged,
      protected: b.protected,
      default: b.default,
    }))
  )
}

export const getMrChangesSchema = z.object({
  project_id: z.string().describe('GitLab project ID or URL-encoded path'),
  mr_iid: z.number().describe('Merge request IID'),
})

export async function getMrChanges(input: z.infer<typeof getMrChangesSchema>) {
  const data = await gitlabFetch(
    `/projects/${encodeURIComponent(input.project_id)}/merge_requests/${input.mr_iid}/changes`
  )
  const changes = (data.changes || []).map((c: any) => ({
    old_path: c.old_path,
    new_path: c.new_path,
    new_file: c.new_file,
    deleted_file: c.deleted_file,
    diff: c.diff,
  }))
  return JSON.stringify({ changes_count: changes.length, changes })
}

export const createMergeRequestSchema = z.object({
  project_id: z.string().describe('GitLab project ID or URL-encoded path'),
  source_branch: z.string().describe('Source branch name'),
  target_branch: z.string().describe('Target branch name'),
  title: z.string().describe('MR title'),
  description: z.string().optional().describe('MR description (markdown)'),
  remove_source_branch: z.boolean().default(true).describe('Remove source branch after merge'),
})

export async function createMergeRequest(input: z.infer<typeof createMergeRequestSchema>) {
  const mr = await gitlabFetch(
    `/projects/${encodeURIComponent(input.project_id)}/merge_requests`,
    {
      method: 'POST',
      body: JSON.stringify({
        source_branch: input.source_branch,
        target_branch: input.target_branch,
        title: input.title,
        description: input.description || '',
        remove_source_branch: input.remove_source_branch,
      }),
    }
  )
  return JSON.stringify({ iid: mr.iid, web_url: mr.web_url })
}
