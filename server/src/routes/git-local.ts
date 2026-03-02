import { Router } from 'express'
import { errorResponse } from '../lib/errors.js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { homedir } from 'os'

const execFileAsync = promisify(execFile)

export const gitLocalRouter = Router()

function getRepoPath(projectId: string): string {
  const reposJson = process.env.GITLAB_LOCAL_REPOS
  if (!reposJson) throw new Error('GITLAB_LOCAL_REPOS not configured in .env')
  const repos: Record<string, string> = JSON.parse(reposJson)
  const repoPath = repos[projectId]
  if (!repoPath) throw new Error(`No local repo configured for project ${projectId}`)
  const expanded = repoPath.startsWith('~') ? repoPath.replace('~', homedir()) : repoPath
  const resolved = resolve(expanded)
  if (!existsSync(resolved)) throw new Error(`Local repo path does not exist: ${resolved}`)
  return resolved
}

async function gitExec(repoPath: string, args: string[]): Promise<string> {
  const allowedCommands = ['diff', 'log', 'branch', 'status', 'fetch', 'rev-parse']
  const subcommand = args[0]
  if (!allowedCommands.includes(subcommand)) {
    throw new Error(`Git command "${subcommand}" is not allowed`)
  }
  const { stdout } = await execFileAsync('git', ['-C', repoPath, ...args], {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30_000,
  })
  return stdout
}

// List branches
gitLocalRouter.get('/:projectId/branches', async (req, res) => {
  try {
    const repoPath = getRepoPath(req.params.projectId)
    const stdout = await gitExec(repoPath, ['branch', '-a', '--format=%(refname:short) %(HEAD)'])
    const branches = stdout.trim().split('\n').filter(Boolean).map((line) => {
      const [name, head] = line.split(' ')
      return { name, current: head === '*' }
    })
    res.json(branches)
  } catch (err) {
    errorResponse(res, err)
  }
})

// Get diff between two refs
gitLocalRouter.get('/:projectId/diff', async (req, res) => {
  try {
    const repoPath = getRepoPath(req.params.projectId)
    const { from, to } = req.query as Record<string, string>
    const args = ['diff']
    if (from && to) {
      args.push(`${from}...${to}`)
    } else if (from) {
      args.push(from)
    }
    const stdout = await gitExec(repoPath, args)
    res.json({ diff: stdout })
  } catch (err) {
    errorResponse(res, err)
  }
})

// Git log
gitLocalRouter.get('/:projectId/log', async (req, res) => {
  try {
    const repoPath = getRepoPath(req.params.projectId)
    const { from, to, max = '20' } = req.query as Record<string, string>
    const args = ['log', `--max-count=${max}`, '--format=%H|%an|%ae|%s|%ci']
    if (from && to) {
      args.push(`${from}..${to}`)
    }
    const stdout = await gitExec(repoPath, args)
    const commits = stdout.trim().split('\n').filter(Boolean).map((line) => {
      const [hash, author, email, message, date] = line.split('|')
      return { hash, author, email, message, date }
    })
    res.json(commits)
  } catch (err) {
    errorResponse(res, err)
  }
})

// Fetch remote
gitLocalRouter.post('/:projectId/fetch', async (req, res) => {
  try {
    const repoPath = getRepoPath(req.params.projectId)
    await gitExec(repoPath, ['fetch', '--all'])
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// Status
gitLocalRouter.get('/:projectId/status', async (req, res) => {
  try {
    const repoPath = getRepoPath(req.params.projectId)
    const stdout = await gitExec(repoPath, ['status', '--porcelain'])
    res.json({ status: stdout })
  } catch (err) {
    errorResponse(res, err)
  }
})
