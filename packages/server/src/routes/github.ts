import { Router } from 'express'
import { validate } from '../lib/validate.js'
import { GithubConfigSchema, GithubCommentSchema, GithubReviewCommentSchema, GithubCreatePrSchema } from '@zync/shared/schemas'
import { getSecret, getSecrets } from '../secrets/index.js'
import { getConfig, getConfigService } from '../config/index.js'

export const githubRouter = Router()

function getGithubConfig() {
  const baseUrl = getConfig('GITHUB_BASE_URL') || 'https://api.github.com'
  const pat = getSecret('GITHUB_PAT')
  if (!pat) {
    throw new Error('GitHub not configured. Add GITHUB_PAT in Settings > Integrations > GitHub or the Vault.')
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), pat }
}

class GitHubError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message)
  }
}

function classifyError(err: unknown): GitHubError {
  if (err instanceof GitHubError) return err
  const msg = err instanceof Error ? err.message : String(err)
  if (
    msg.includes('fetch failed') || msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNRESET') || msg.includes('EAI_AGAIN') ||
    msg.includes('getaddrinfo') || msg.includes('network')
  ) {
    return new GitHubError('Cannot reach GitHub. Check your network connection.', 502)
  }
  if (msg.includes('CERT') || msg.includes('SSL') || msg.includes('certificate')) {
    return new GitHubError('SSL/certificate error connecting to GitHub.', 502)
  }
  if (msg.includes('timeout') || msg.includes('AbortError')) {
    return new GitHubError('Request to GitHub timed out.', 504)
  }
  return new GitHubError(msg || 'An unexpected error occurred', 500)
}

function handleGitHubStatus(status: number, body: string): never {
  switch (status) {
    case 401: throw new GitHubError('Authentication failed. Check your Personal Access Token.', 401)
    case 403: throw new GitHubError('Permission denied. Your token may lack the required scopes.', 403)
    case 404: throw new GitHubError('Resource not found on GitHub.', 404)
    case 422: throw new GitHubError(`Validation failed: ${body}`, 422)
    case 429: throw new GitHubError('GitHub rate limit exceeded. Wait and try again.', 429)
    default:
      if (status >= 500) throw new GitHubError(`GitHub server error (${status}).`, 502)
      throw new GitHubError(`GitHub responded with ${status}: ${body}`, status)
  }
}

async function githubFetch(path: string, init?: RequestInit) {
  const { baseUrl, pat } = getGithubConfig()
  const url = `${baseUrl}${path}`
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...init?.headers,
      },
    })
  } catch (err) {
    throw classifyError(err)
  }
  if (!res.ok) {
    const text = await res.text()
    handleGitHubStatus(res.status, text)
  }
  // DELETE returns 204 with no body
  if (res.status === 204) return {}
  return res.json()
}

async function githubFetchAllPages<T>(path: string, perPage = 100, maxItems = 500): Promise<T[]> {
  const { baseUrl, pat } = getGithubConfig()
  const separator = path.includes('?') ? '&' : '?'
  let page = 1
  let all: T[] = []

  while (all.length < maxItems) {
    const url = `${baseUrl}${path}${separator}per_page=${perPage}&page=${page}`
    let res: Response
    try {
      res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
    } catch (err) {
      throw classifyError(err)
    }
    if (!res.ok) {
      const text = await res.text()
      handleGitHubStatus(res.status, text)
    }
    const items: T[] = await res.json()
    all = all.concat(items)
    const linkHeader = res.headers.get('link')
    if (!linkHeader || !linkHeader.includes('rel="next"') || !items.length || items.length < perPage) break
    page++
  }

  return all.slice(0, maxItems)
}

// GET config (masked)
githubRouter.get('/config', (_req, res) => {
  const baseUrl = getConfig('GITHUB_BASE_URL') || 'https://api.github.com'
  const pat = getSecret('GITHUB_PAT')
  res.json({
    baseUrl,
    pat: pat ? '••••••••' : '',
    fromEnv: !!(getConfig('GITHUB_BASE_URL') && getSecret('GITHUB_PAT')),
  })
})

// PUT config
githubRouter.put('/config', validate(GithubConfigSchema), (req, res) => {
  try {
    const { baseUrl, pat } = req.body
    const configSvc = getConfigService()
    if (configSvc) configSvc.set('GITHUB_BASE_URL', baseUrl.replace(/\/$/, ''), 'github')
    const secretsSvc = getSecrets()
    if (secretsSvc && pat && pat !== '••••••••') secretsSvc.set('GITHUB_PAT', pat, 'github')
    res.json({ success: true })
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Current user
githubRouter.get('/user', async (_req, res) => {
  try {
    const user = await githubFetch('/user')
    res.json(user)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// List repos
githubRouter.get('/repos', async (req, res) => {
  try {
    const { search, per_page = '20', page = '1' } = req.query as Record<string, string>
    if (search) {
      const params = new URLSearchParams({ q: `${search} in:name fork:true`, per_page, page, sort: 'updated' })
      const result = await githubFetch(`/search/repositories?${params}`)
      res.json(result.items || [])
    } else {
      const params = new URLSearchParams({ per_page, page, type: 'all', sort: 'updated', direction: 'desc' })
      const repos = await githubFetch(`/user/repos?${params}`)
      res.json(repos)
    }
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// List collaborators
githubRouter.get('/repos/:owner/:repo/collaborators', async (req, res) => {
  try {
    const { owner, repo } = req.params
    const { per_page = '100' } = req.query as Record<string, string>
    const collaborators = await githubFetch(`/repos/${owner}/${repo}/collaborators?per_page=${per_page}`)
    res.json(collaborators)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// List pull requests
githubRouter.get('/repos/:owner/:repo/pulls', async (req, res) => {
  try {
    const { owner, repo } = req.params
    const { state = 'open', sort = 'updated', direction = 'desc', per_page = '100' } = req.query as Record<string, string>
    const params = new URLSearchParams({ state, sort, direction, per_page })
    const pulls = await githubFetchAllPages(`/repos/${owner}/${repo}/pulls?${params}`)
    res.json(pulls)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Get single PR
githubRouter.get('/repos/:owner/:repo/pulls/:number', async (req, res) => {
  try {
    const { owner, repo } = req.params
    const pr = await githubFetch(`/repos/${owner}/${repo}/pulls/${req.params.number}`)
    res.json(pr)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Get PR files (diffs)
githubRouter.get('/repos/:owner/:repo/pulls/:number/files', async (req, res) => {
  try {
    const { owner, repo } = req.params
    const files = await githubFetchAllPages(`/repos/${owner}/${repo}/pulls/${req.params.number}/files`)
    res.json(files)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Get issue comments (general discussion)
githubRouter.get('/repos/:owner/:repo/issues/:number/comments', async (req, res) => {
  try {
    const { owner, repo } = req.params
    const comments = await githubFetchAllPages(`/repos/${owner}/${repo}/issues/${req.params.number}/comments`)
    res.json(comments)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Get review comments (inline on diff)
githubRouter.get('/repos/:owner/:repo/pulls/:number/comments', async (req, res) => {
  try {
    const { owner, repo } = req.params
    const comments = await githubFetchAllPages(`/repos/${owner}/${repo}/pulls/${req.params.number}/comments`)
    res.json(comments)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Add issue comment
githubRouter.post('/repos/:owner/:repo/issues/:number/comments', validate(GithubCommentSchema), async (req, res) => {
  try {
    const { owner, repo } = req.params
    const { body } = req.body
    const comment = await githubFetch(`/repos/${owner}/${repo}/issues/${req.params.number}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    })
    res.json(comment)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Add review comment (inline)
githubRouter.post('/repos/:owner/:repo/pulls/:number/comments', validate(GithubReviewCommentSchema), async (req, res) => {
  try {
    const { owner, repo } = req.params
    const comment = await githubFetch(`/repos/${owner}/${repo}/pulls/${req.params.number}/comments`, {
      method: 'POST',
      body: JSON.stringify(req.body),
    })
    res.json(comment)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Edit issue comment
githubRouter.patch('/repos/:owner/:repo/issues/comments/:commentId', validate(GithubCommentSchema), async (req, res) => {
  try {
    const { owner, repo, commentId } = req.params
    const { body } = req.body
    const comment = await githubFetch(`/repos/${owner}/${repo}/issues/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    })
    res.json(comment)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Delete issue comment
githubRouter.delete('/repos/:owner/:repo/issues/comments/:commentId', async (req, res) => {
  try {
    const { owner, repo, commentId } = req.params
    await githubFetch(`/repos/${owner}/${repo}/issues/comments/${commentId}`, { method: 'DELETE' })
    res.json({ success: true })
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Get PR reviews
githubRouter.get('/repos/:owner/:repo/pulls/:number/reviews', async (req, res) => {
  try {
    const { owner, repo } = req.params
    const reviews = await githubFetch(`/repos/${owner}/${repo}/pulls/${req.params.number}/reviews`)
    res.json(reviews)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Create PR
githubRouter.post('/repos/:owner/:repo/pulls', validate(GithubCreatePrSchema), async (req, res) => {
  try {
    const { owner, repo } = req.params
    const pr = await githubFetch(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: JSON.stringify(req.body),
    })
    res.json(pr)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// List branches
githubRouter.get('/repos/:owner/:repo/branches', async (req, res) => {
  try {
    const { owner, repo } = req.params
    const { per_page = '100' } = req.query as Record<string, string>
    const branches = await githubFetch(`/repos/${owner}/${repo}/branches?per_page=${per_page}`)
    res.json(branches)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})

// Compare branches
githubRouter.get('/repos/:owner/:repo/compare/:base...:head', async (req, res) => {
  try {
    const { owner, repo, base, head } = req.params
    const comparison = await githubFetch(`/repos/${owner}/${repo}/compare/${base}...${head}`)
    res.json(comparison)
  } catch (err: any) {
    const ge = classifyError(err)
    res.status(ge.statusCode).json({ error: ge.message })
  }
})
