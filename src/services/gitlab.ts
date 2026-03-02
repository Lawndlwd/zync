import type {
  GitLabProject,
  GitLabUser,
  GitLabMergeRequest,
  GitLabMRChange,
  GitLabNote,
  GitLabApprovalState,
  GitLabBranch,
  GitLabContributor,
  GitLabDiffRefs,
  GitLabDiffPosition,
  CreateMRPayload,
} from '@/types/gitlab'

const API_BASE = '/api/gitlab'

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
  } catch {
    throw new Error('Cannot connect to the server. Check your network connection.')
  }
  if (!res.ok) {
    let message: string
    try {
      const json = await res.json()
      message = json.error || JSON.stringify(json)
    } catch {
      message = await res.text()
    }
    throw new Error(message || `Request failed (${res.status})`)
  }
  return res.json()
}

export async function fetchCurrentUser(): Promise<GitLabUser> {
  return fetchJSON(`${API_BASE}/user`)
}

export async function fetchProjects(search?: string): Promise<GitLabProject[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  return fetchJSON(`${API_BASE}/projects?${params}`)
}

export async function fetchProjectMembers(projectId: number, search?: string): Promise<GitLabUser[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  return fetchJSON(`${API_BASE}/projects/${projectId}/members?${params}`)
}

export async function fetchMergeRequests(
  projectId: number,
  params?: { state?: string; scope?: string; reviewer_username?: string; author_username?: string; search?: string; perPage?: number }
): Promise<GitLabMergeRequest[]> {
  const searchParams = new URLSearchParams()
  if (params?.state) searchParams.set('state', params.state)
  if (params?.scope) searchParams.set('scope', params.scope)
  if (params?.reviewer_username) searchParams.set('reviewer_username', params.reviewer_username)
  if (params?.author_username) searchParams.set('author_username', params.author_username)
  if (params?.search) searchParams.set('search', params.search)
  const perPage = params?.perPage ?? 100
  searchParams.set('per_page', String(perPage))
  return fetchJSON(`${API_BASE}/projects/${projectId}/merge_requests?${searchParams}`)
}

export async function fetchMergeRequest(projectId: number, iid: number): Promise<GitLabMergeRequest> {
  return fetchJSON(`${API_BASE}/projects/${projectId}/merge_requests/${iid}`)
}

export async function fetchMRChanges(
  projectId: number,
  iid: number
): Promise<{ changes: GitLabMRChange[]; diff_refs: GitLabDiffRefs }> {
  return fetchJSON(`${API_BASE}/projects/${projectId}/merge_requests/${iid}/changes`)
}

export async function fetchMRNotes(projectId: number, iid: number): Promise<GitLabNote[]> {
  return fetchJSON(`${API_BASE}/projects/${projectId}/merge_requests/${iid}/notes`)
}

export async function createMRDiscussion(
  projectId: number,
  iid: number,
  body: string,
  position?: GitLabDiffPosition
): Promise<any> {
  const payload: Record<string, any> = { body }
  if (position) payload.position = position
  return fetchJSON(`${API_BASE}/projects/${projectId}/merge_requests/${iid}/discussions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function addMRNote(projectId: number, iid: number, body: string): Promise<GitLabNote> {
  return fetchJSON(`${API_BASE}/projects/${projectId}/merge_requests/${iid}/notes`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })
}

export async function editMRNote(projectId: number, iid: number, noteId: number, body: string): Promise<GitLabNote> {
  return fetchJSON(`${API_BASE}/projects/${projectId}/merge_requests/${iid}/notes/${noteId}`, {
    method: 'PUT',
    body: JSON.stringify({ body }),
  })
}

export async function deleteMRNote(projectId: number, iid: number, noteId: number): Promise<void> {
  await fetchJSON(`${API_BASE}/projects/${projectId}/merge_requests/${iid}/notes/${noteId}`, {
    method: 'DELETE',
  })
}

export async function fetchMRApprovals(projectId: number, iid: number): Promise<GitLabApprovalState> {
  return fetchJSON(`${API_BASE}/projects/${projectId}/merge_requests/${iid}/approvals`)
}

export async function createMR(projectId: number, payload: CreateMRPayload): Promise<GitLabMergeRequest> {
  return fetchJSON(`${API_BASE}/projects/${projectId}/merge_requests`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchBranches(projectId: number, search?: string): Promise<GitLabBranch[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  return fetchJSON(`${API_BASE}/projects/${projectId}/repository/branches?${params}`)
}

export async function fetchContributors(projectId: number): Promise<GitLabContributor[]> {
  return fetchJSON(`${API_BASE}/projects/${projectId}/repository/contributors?order_by=commits&sort=desc`)
}

export async function fetchMRStats(
  projectId: number,
  username: string,
  days = 90
): Promise<{ authored: GitLabMergeRequest[]; reviewed: GitLabMergeRequest[] }> {
  const params = new URLSearchParams({ username, days: String(days) })
  return fetchJSON(`${API_BASE}/projects/${projectId}/merge_requests/stats?${params}`)
}

export async function fetchBranchCompare(
  projectId: number,
  from: string,
  to: string
): Promise<{ commits: any[]; diffs: GitLabMRChange[] }> {
  const params = new URLSearchParams({ from, to })
  return fetchJSON(`${API_BASE}/projects/${projectId}/repository/compare?${params}`)
}
