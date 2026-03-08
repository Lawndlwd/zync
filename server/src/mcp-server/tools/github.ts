import { z } from 'zod'
import { getSecret } from '../../secrets/index.js'
import { getConfig } from '../../config/index.js'

function getGithubConfig() {
  const baseUrl = getSecret('GITHUB_BASE_URL') || getConfig('GITHUB_BASE_URL') || 'https://api.github.com'
  const pat = getSecret('GITHUB_PAT')
  if (!pat) {
    throw new Error('GitHub not configured. Add GITHUB_PAT in Settings > Integrations > GitHub or the Vault.')
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), pat }
}

async function githubFetch(path: string, init?: RequestInit) {
  const { baseUrl, pat } = getGithubConfig()
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub ${res.status}: ${text}`)
  }
  return res.json()
}

export const listGithubReposSchema = z.object({
  search: z.string().optional().describe('Search query to filter repositories'),
  per_page: z.number().default(20).describe('Results per page (default 20)'),
})

export async function listGithubRepos(input: z.infer<typeof listGithubReposSchema>) {
  let repos: any[]
  if (input.search) {
    const params = new URLSearchParams({ q: `${input.search} in:name fork:true`, per_page: String(input.per_page), sort: 'updated' })
    const result = await githubFetch(`/search/repositories?${params}`)
    repos = result.items || []
  } else {
    const params = new URLSearchParams({ per_page: String(input.per_page), sort: 'updated', direction: 'desc' })
    repos = await githubFetch(`/user/repos?${params}`)
  }
  return JSON.stringify(repos.map((r: any) => ({
    id: r.id, name: r.name, full_name: r.full_name, html_url: r.html_url, default_branch: r.default_branch,
  })))
}

export const listPullRequestsSchema = z.object({
  owner: z.string().describe('Repository owner'),
  repo: z.string().describe('Repository name'),
  state: z.string().default('open').describe('PR state: open, closed, all'),
})

export async function listPullRequests(input: z.infer<typeof listPullRequestsSchema>) {
  const params = new URLSearchParams({ state: input.state, sort: 'updated', direction: 'desc' })
  const prs = await githubFetch(`/repos/${input.owner}/${input.repo}/pulls?${params}`)
  return JSON.stringify((prs as any[]).map((pr) => ({
    number: pr.number, title: pr.title, state: pr.state, draft: pr.draft,
    author: pr.user?.login, html_url: pr.html_url,
    head: pr.head?.ref, base: pr.base?.ref, updated_at: pr.updated_at,
  })))
}

export const getPullRequestSchema = z.object({
  owner: z.string().describe('Repository owner'),
  repo: z.string().describe('Repository name'),
  pull_number: z.number().describe('Pull request number'),
})

export async function getPullRequest(input: z.infer<typeof getPullRequestSchema>) {
  const pr = await githubFetch(`/repos/${input.owner}/${input.repo}/pulls/${input.pull_number}`)
  return JSON.stringify({
    number: pr.number, title: pr.title, body: pr.body, state: pr.state, draft: pr.draft, merged: pr.merged,
    author: pr.user?.login, reviewers: (pr.requested_reviewers || []).map((r: any) => r.login),
    head: pr.head?.ref, base: pr.base?.ref, html_url: pr.html_url,
    created_at: pr.created_at, updated_at: pr.updated_at, mergeable: pr.mergeable,
  })
}

export const commentOnPullRequestSchema = z.object({
  owner: z.string().describe('Repository owner'),
  repo: z.string().describe('Repository name'),
  pull_number: z.number().describe('Pull request number'),
  body: z.string().describe('Comment body (markdown supported)'),
})

export async function commentOnPullRequest(input: z.infer<typeof commentOnPullRequestSchema>) {
  const comment = await githubFetch(`/repos/${input.owner}/${input.repo}/issues/${input.pull_number}/comments`, {
    method: 'POST', body: JSON.stringify({ body: input.body }),
  })
  return JSON.stringify({ id: comment.id, success: true })
}

export const listGithubBranchesSchema = z.object({
  owner: z.string().describe('Repository owner'),
  repo: z.string().describe('Repository name'),
})

export async function listGithubBranches(input: z.infer<typeof listGithubBranchesSchema>) {
  const branches = await githubFetch(`/repos/${input.owner}/${input.repo}/branches?per_page=100`)
  return JSON.stringify((branches as any[]).map((b) => ({ name: b.name, protected: b.protected })))
}

export const getPrChangesSchema = z.object({
  owner: z.string().describe('Repository owner'),
  repo: z.string().describe('Repository name'),
  pull_number: z.number().describe('Pull request number'),
})

export async function getPrChanges(input: z.infer<typeof getPrChangesSchema>) {
  const files = await githubFetch(`/repos/${input.owner}/${input.repo}/pulls/${input.pull_number}/files?per_page=100`)
  const changes = (files as any[]).map((f: any) => ({
    filename: f.filename, status: f.status, additions: f.additions, deletions: f.deletions, patch: f.patch,
  }))
  return JSON.stringify({ changes_count: changes.length, changes })
}

export const createPullRequestSchema = z.object({
  owner: z.string().describe('Repository owner'),
  repo: z.string().describe('Repository name'),
  head: z.string().describe('Source branch name'),
  base: z.string().describe('Target branch name'),
  title: z.string().describe('PR title'),
  body: z.string().optional().describe('PR description (markdown)'),
  draft: z.boolean().default(false).describe('Create as draft'),
})

export async function createPullRequest(input: z.infer<typeof createPullRequestSchema>) {
  const pr = await githubFetch(`/repos/${input.owner}/${input.repo}/pulls`, {
    method: 'POST',
    body: JSON.stringify({ head: input.head, base: input.base, title: input.title, body: input.body || '', draft: input.draft }),
  })
  return JSON.stringify({ number: pr.number, html_url: pr.html_url })
}
