import { Router } from 'express'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'

export const gitlabRouter = Router()

const GITLAB_CONFIG_PATH = resolve(import.meta.dirname, '../../data/gitlab.json')

interface GitLabConfig {
  baseUrl: string
  pat: string
}

export function loadGitlabConfig(): GitLabConfig {
  try {
    if (existsSync(GITLAB_CONFIG_PATH)) {
      return JSON.parse(readFileSync(GITLAB_CONFIG_PATH, 'utf-8'))
    }
  } catch { /* ignore parse errors */ }
  return { baseUrl: '', pat: '' }
}

export function saveGitlabConfig(config: GitLabConfig) {
  const dir = dirname(GITLAB_CONFIG_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(GITLAB_CONFIG_PATH, JSON.stringify(config, null, 2))
}

function getGitlabConfig() {
  // Env vars take priority, then fall back to saved config file
  const saved = loadGitlabConfig()
  const baseUrl = process.env.GITLAB_BASE_URL || saved.baseUrl
  const pat = process.env.GITLAB_PAT || saved.pat
  if (!baseUrl || !pat) {
    throw new Error('GitLab not configured. Add your GitLab URL and PAT in Settings.')
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), pat }
}

class GitLabError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message)
  }
}

function classifyError(err: unknown): GitLabError {
  if (err instanceof GitLabError) return err

  const msg = err instanceof Error ? err.message : String(err)

  // Network / connectivity errors (VPN off, DNS failure, host unreachable)
  if (
    msg.includes('fetch failed') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNRESET') ||
    msg.includes('EAI_AGAIN') ||
    msg.includes('getaddrinfo') ||
    msg.includes('network')
  ) {
    return new GitLabError(
      'Cannot reach GitLab server. Check your VPN connection and that the GitLab URL is correct.',
      502
    )
  }

  // SSL / certificate errors
  if (msg.includes('CERT') || msg.includes('SSL') || msg.includes('certificate')) {
    return new GitLabError('SSL/certificate error connecting to GitLab. Check your network or VPN.', 502)
  }

  // Timeout
  if (msg.includes('timeout') || msg.includes('AbortError')) {
    return new GitLabError('Request to GitLab timed out. The server may be slow or unreachable.', 504)
  }

  return new GitLabError(msg || 'An unexpected error occurred', 500)
}

function handleGitLabStatus(status: number, body: string): never {
  switch (status) {
    case 401:
      throw new GitLabError('Authentication failed. Check your Personal Access Token in Settings.', 401)
    case 403:
      throw new GitLabError('Permission denied. Your token may lack the required scopes.', 403)
    case 404:
      throw new GitLabError('Resource not found on GitLab. It may have been deleted or you lack access.', 404)
    case 429:
      throw new GitLabError('GitLab rate limit exceeded. Wait a moment and try again.', 429)
    default:
      if (status >= 500) {
        throw new GitLabError(`GitLab server error (${status}). Try again later.`, 502)
      }
      throw new GitLabError(`GitLab responded with ${status}: ${body}`, status)
  }
}

async function gitlabFetch(path: string, init?: RequestInit) {
  const { baseUrl, pat } = getGitlabConfig()
  const url = `${baseUrl}/api/v4${path}`
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        'PRIVATE-TOKEN': pat,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...init?.headers,
      },
    })
  } catch (err) {
    throw classifyError(err)
  }
  if (!res.ok) {
    const text = await res.text()
    handleGitLabStatus(res.status, text)
  }
  return res.json()
}

async function gitlabFetchAllPages<T>(path: string, perPage = 100, maxItems = 500): Promise<T[]> {
  const { baseUrl, pat } = getGitlabConfig()
  const separator = path.includes('?') ? '&' : '?'
  let page = 1
  let all: T[] = []

  while (all.length < maxItems) {
    const url = `${baseUrl}/api/v4${path}${separator}per_page=${perPage}&page=${page}`
    let res: Response
    try {
      res = await fetch(url, {
        headers: {
          'PRIVATE-TOKEN': pat,
          Accept: 'application/json',
        },
      })
    } catch (err) {
      throw classifyError(err)
    }
    if (!res.ok) {
      const text = await res.text()
      handleGitLabStatus(res.status, text)
    }
    const items: T[] = await res.json()
    all = all.concat(items)
    const nextPage = res.headers.get('x-next-page')
    if (!nextPage || !items.length || items.length < perPage) break
    page = Number(nextPage)
  }

  return all.slice(0, maxItems)
}

// Proxy GitLab images/uploads
// ?project=123&path=/uploads/{hash}/{file}
// Uses GitLab API: /api/v4/projects/{id}/uploads/{hash}/{file}
gitlabRouter.get('/proxy/image', async (req, res) => {
  try {
    const { path, project } = req.query as Record<string, string>
    if (!path || !project) return res.status(400).json({ error: 'path and project are required' })

    // /uploads/{hash}/{file} → /projects/{id}/uploads/{hash}/{file} (via gitlabFetch's /api/v4 prefix)
    const apiPath = `/projects/${encodeURIComponent(project)}${path}`

    const { baseUrl, pat } = getGitlabConfig()
    let upstream: Response
    try {
      upstream = await fetch(`${baseUrl}/api/v4${apiPath}`, {
        headers: { 'PRIVATE-TOKEN': pat },
      })
    } catch (err) {
      throw classifyError(err)
    }
    if (!upstream.ok) {
      const text = await upstream.text()
      handleGitLabStatus(upstream.status, text)
    }

    const contentType = upstream.headers.get('content-type')
    if (contentType) res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=86400')

    const buffer = await upstream.arrayBuffer()
    res.send(Buffer.from(buffer))
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Get saved gitlab config (secrets masked)
gitlabRouter.get('/config', (_req, res) => {
  const saved = loadGitlabConfig()
  res.json({
    baseUrl: process.env.GITLAB_BASE_URL || saved.baseUrl,
    pat: (process.env.GITLAB_PAT || saved.pat) ? '••••••••' : '',
    fromEnv: !!(process.env.GITLAB_BASE_URL && process.env.GITLAB_PAT),
  })
})

// Save gitlab config
gitlabRouter.put('/config', (req, res) => {
  try {
    const { baseUrl, pat } = req.body
    if (!baseUrl || !pat) {
      return res.status(400).json({ error: 'baseUrl and pat are required' })
    }
    const current = loadGitlabConfig()
    saveGitlabConfig({
      baseUrl: baseUrl.replace(/\/$/, ''),
      // Preserve existing PAT if masked value is sent
      pat: pat === '••••••••' ? current.pat : pat,
    })
    res.json({ success: true })
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Current authenticated user
gitlabRouter.get('/user', async (_req, res) => {
  try {
    const user = await gitlabFetch('/user')
    res.json(user)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// List projects (with search)
gitlabRouter.get('/projects', async (req, res) => {
  try {
    const { search, per_page = '20', page = '1', membership = 'true' } = req.query as Record<string, string>
    const params = new URLSearchParams({ per_page, page, membership, order_by: 'last_activity_at', sort: 'desc' })
    if (search) params.set('search', search)
    const projects = await gitlabFetch(`/projects?${params}`)
    res.json(projects)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// List project members
gitlabRouter.get('/projects/:id/members', async (req, res) => {
  try {
    const { id } = req.params
    const { search, per_page = '100' } = req.query as Record<string, string>
    const params = new URLSearchParams({ per_page })
    if (search) params.set('query', search)
    const members = await gitlabFetch(`/projects/${encodeURIComponent(id)}/members/all?${params}`)
    res.json(members)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Repository contributors — counts from full commit history (cached 1h)
const contributorsCache = new Map<string, { data: any; ts: number }>()
const CONTRIBUTORS_CACHE_TTL = 60 * 60 * 1000 // 1 hour

gitlabRouter.get('/projects/:id/repository/contributors', async (req, res) => {
  try {
    const { id } = req.params
    const cacheKey = `contributors:${id}`
    const cached = contributorsCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CONTRIBUTORS_CACHE_TTL) {
      return res.json(cached.data)
    }

    const encodedId = encodeURIComponent(id)

    // Paginate through all commits on default branch to count per author
    const allCommits = await gitlabFetchAllPages<{
      author_name: string
      author_email: string
      parent_ids: string[]
    }>(`/projects/${encodedId}/repository/commits?ref_name=main&with_stats=false`, 100, 6000)

    // Aggregate by author name, exclude merge commits (>1 parent)
    const byName = new Map<string, { name: string; emails: string[]; commits: number }>()
    for (const c of allCommits) {
      if (c.parent_ids && c.parent_ids.length > 1) continue // skip merge commits
      const existing = byName.get(c.author_name)
      if (existing) {
        existing.commits++
        if (!existing.emails.includes(c.author_email)) existing.emails.push(c.author_email)
      } else {
        byName.set(c.author_name, { name: c.author_name, emails: [c.author_email], commits: 1 })
      }
    }

    const aggregated = [...byName.values()].sort((a, b) => b.commits - a.commits)
    contributorsCache.set(cacheKey, { data: aggregated, ts: Date.now() })
    res.json(aggregated)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Stats for merge requests (must be before /:iid route)
gitlabRouter.get('/projects/:id/merge_requests/stats', async (req, res) => {
  try {
    const { id } = req.params
    const { username, days = '90' } = req.query as Record<string, string>
    if (!username) return res.status(400).json({ error: 'username is required' })

    const daysNum = Number(days)
    const afterParam = daysNum > 0
      ? (() => { const d = new Date(); d.setDate(d.getDate() - daysNum); return `&created_after=${d.toISOString()}` })()
      : ''
    const maxItems = daysNum === 0 ? 2000 : 500

    const encodedId = encodeURIComponent(id)
    const u = encodeURIComponent(username)
    const [authored, reviewed] = await Promise.all([
      gitlabFetchAllPages(`/projects/${encodedId}/merge_requests?state=all&author_username=${u}&order_by=created_at&sort=desc${afterParam}`, 100, maxItems),
      gitlabFetchAllPages(`/projects/${encodedId}/merge_requests?state=all&reviewer_username=${u}&order_by=created_at&sort=desc${afterParam}`, 100, maxItems),
    ])

    res.json({ authored, reviewed })
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// List merge requests for a project
gitlabRouter.get('/projects/:id/merge_requests', async (req, res) => {
  try {
    const { id } = req.params
    const { state = 'opened', scope, reviewer_username, author_username, search } = req.query as Record<string, string>
    const params = new URLSearchParams({ state, order_by: 'updated_at', sort: 'desc' })
    if (scope) params.set('scope', scope)
    if (reviewer_username) params.set('reviewer_username', reviewer_username)
    if (author_username) params.set('author_username', author_username)
    if (search) params.set('search', search)
    const mrs = await gitlabFetchAllPages(`/projects/${encodeURIComponent(id)}/merge_requests?${params}`)
    res.json(mrs)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Get single MR
gitlabRouter.get('/projects/:id/merge_requests/:iid', async (req, res) => {
  try {
    const { id, iid } = req.params
    const mr = await gitlabFetch(`/projects/${encodeURIComponent(id)}/merge_requests/${iid}`)
    res.json(mr)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Get MR changes (diffs)
gitlabRouter.get('/projects/:id/merge_requests/:iid/changes', async (req, res) => {
  try {
    const { id, iid } = req.params
    const changes = await gitlabFetch(`/projects/${encodeURIComponent(id)}/merge_requests/${iid}/changes`)
    res.json(changes)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Get MR notes (comments) — paginated to fetch all
gitlabRouter.get('/projects/:id/merge_requests/:iid/notes', async (req, res) => {
  try {
    const { id, iid } = req.params
    const { sort = 'asc' } = req.query as Record<string, string>
    const perPage = 100
    let page = 1
    let allNotes: any[] = []

    while (true) {
      const params = new URLSearchParams({ per_page: String(perPage), page: String(page), sort })
      const notes = await gitlabFetch(`/projects/${encodeURIComponent(id)}/merge_requests/${iid}/notes?${params}`)
      allNotes = allNotes.concat(notes)
      if (!Array.isArray(notes) || notes.length < perPage) break
      page++
    }

    res.json(allNotes)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Create MR discussion (positioned comment)
gitlabRouter.post('/projects/:id/merge_requests/:iid/discussions', async (req, res) => {
  try {
    const { id, iid } = req.params
    const { body, position } = req.body
    if (!body) return res.status(400).json({ error: 'body is required' })
    const payload: Record<string, any> = { body }
    if (position) payload.position = position
    const discussion = await gitlabFetch(`/projects/${encodeURIComponent(id)}/merge_requests/${iid}/discussions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    res.json(discussion)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Add MR note (comment)
gitlabRouter.post('/projects/:id/merge_requests/:iid/notes', async (req, res) => {
  try {
    const { id, iid } = req.params
    const { body } = req.body
    if (!body) return res.status(400).json({ error: 'body is required' })
    const note = await gitlabFetch(`/projects/${encodeURIComponent(id)}/merge_requests/${iid}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    })
    res.json(note)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Get MR approvals
gitlabRouter.get('/projects/:id/merge_requests/:iid/approvals', async (req, res) => {
  try {
    const { id, iid } = req.params
    const approvals = await gitlabFetch(`/projects/${encodeURIComponent(id)}/merge_requests/${iid}/approvals`)
    res.json(approvals)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Create MR
gitlabRouter.post('/projects/:id/merge_requests', async (req, res) => {
  try {
    const { id } = req.params
    const mr = await gitlabFetch(`/projects/${encodeURIComponent(id)}/merge_requests`, {
      method: 'POST',
      body: JSON.stringify(req.body),
    })
    res.json(mr)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// List branches
gitlabRouter.get('/projects/:id/repository/branches', async (req, res) => {
  try {
    const { id } = req.params
    const { search, per_page = '100' } = req.query as Record<string, string>
    const params = new URLSearchParams({ per_page })
    if (search) params.set('search', search)
    const branches = await gitlabFetch(`/projects/${encodeURIComponent(id)}/repository/branches?${params}`)
    res.json(branches)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Edit MR note
gitlabRouter.put('/projects/:id/merge_requests/:iid/notes/:noteId', async (req, res) => {
  try {
    const { id, iid, noteId } = req.params
    const { body } = req.body
    if (!body) return res.status(400).json({ error: 'body is required' })
    const note = await gitlabFetch(`/projects/${encodeURIComponent(id)}/merge_requests/${iid}/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify({ body }),
    })
    res.json(note)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Delete MR note
gitlabRouter.delete('/projects/:id/merge_requests/:iid/notes/:noteId', async (req, res) => {
  try {
    const { id, iid, noteId } = req.params
    await gitlabFetch(`/projects/${encodeURIComponent(id)}/merge_requests/${iid}/notes/${noteId}`, {
      method: 'DELETE',
    })
    res.json({ success: true })
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Compare branches (for create MR AI pre-fill)
gitlabRouter.get('/projects/:id/repository/compare', async (req, res) => {
  try {
    const { id } = req.params
    const { from, to } = req.query as Record<string, string>
    if (!from || !to) return res.status(400).json({ error: 'from and to are required' })
    const params = new URLSearchParams({ from, to })
    const comparison = await gitlabFetch(`/projects/${encodeURIComponent(id)}/repository/compare?${params}`)
    res.json(comparison)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})
