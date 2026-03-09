import { Router } from 'express'
import { getSecret } from '../secrets/index.js'
import { getConfig } from '../config/index.js'
import { errorResponse } from '../lib/errors.js'

export const linearRouter = Router()

function getLinearConfig() {
  const apiKey = getSecret('LINEAR_API_KEY')
  if (!apiKey) throw new Error('Linear not configured. Set LINEAR_API_KEY in Settings.')
  const defaultTeamId = getConfig('LINEAR_DEFAULT_TEAM_ID') || undefined
  return { apiKey, defaultTeamId }
}

async function linearQuery(query: string, variables?: Record<string, any>) {
  const { apiKey } = getLinearConfig()
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`Linear ${res.status}: ${await res.text()}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(`Linear: ${json.errors.map((e: any) => e.message).join(', ')}`)
  return json.data
}

const issueFields = `
  id identifier title description
  state { id name type }
  priority priorityLabel
  assignee { id name email avatarUrl }
  creator { id name }
  labels { nodes { id name color } }
  project { id name }
  cycle { id name number }
  estimate dueDate
  createdAt updatedAt url
  comments { nodes { id body createdAt user { id name avatarUrl } } }
`

linearRouter.get('/issues', async (req, res) => {
  try {
    const { teamId, projectId, cycleId, query: searchQuery } = req.query as Record<string, string>
    const { defaultTeamId } = getLinearConfig()
    const effectiveTeamId = teamId || defaultTeamId

    const filters: string[] = []
    if (effectiveTeamId) filters.push(`team: { id: { eq: "${effectiveTeamId}" } }`)
    if (projectId) filters.push(`project: { id: { eq: "${projectId}" } }`)
    if (cycleId) filters.push(`cycle: { id: { eq: "${cycleId}" } }`)
    const filterStr = filters.length ? `, filter: { ${filters.join(', ')} }` : ''

    let data: any
    if (searchQuery) {
      data = await linearQuery(`query($q: String!) {
        searchIssues(query: $q, first: 100${filterStr}) { nodes { ${issueFields} } }
      }`, { q: searchQuery })
      data = { issues: { nodes: data.searchIssues.nodes } }
    } else {
      data = await linearQuery(`{
        issues(first: 100, orderBy: updatedAt${filterStr}) { nodes { ${issueFields} } }
      }`)
    }

    const issues = (data.issues?.nodes || []).map(mapIssue)
    res.json({ issues, total: issues.length })
  } catch (err) { errorResponse(res, err) }
})

linearRouter.get('/issue/:id', async (req, res) => {
  try {
    const data = await linearQuery(`query($id: String!) {
      issue(id: $id) { ${issueFields} }
    }`, { id: req.params.id })
    res.json(mapIssue(data.issue))
  } catch (err) { errorResponse(res, err) }
})

linearRouter.get('/states/:teamId', async (req, res) => {
  try {
    const data = await linearQuery(`query($teamId: String!) {
      team(id: $teamId) {
        states { nodes { id name type position color } }
      }
    }`, { teamId: req.params.teamId })
    const states = data.team.states.nodes.sort((a: any, b: any) => a.position - b.position)
    res.json(states)
  } catch (err) { errorResponse(res, err) }
})

linearRouter.post('/issue/:id/transition', async (req, res) => {
  try {
    const { stateId } = req.body
    const issueData = await linearQuery(`query($id: String!) { issue(id: $id) { id } }`, { id: req.params.id })
    const data = await linearQuery(`mutation($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) { success issue { identifier state { name } } }
    }`, { id: issueData.issue.id, input: { stateId } })
    res.json({ success: true, issue: data.issueUpdate.issue })
  } catch (err) { errorResponse(res, err) }
})

linearRouter.post('/issue/:id/comment', async (req, res) => {
  try {
    const { body } = req.body
    const issueData = await linearQuery(`query($id: String!) { issue(id: $id) { id } }`, { id: req.params.id })
    const data = await linearQuery(`mutation($input: CommentCreateInput!) {
      commentCreate(input: $input) { success comment { id body createdAt user { id name } } }
    }`, { input: { issueId: issueData.issue.id, body } })
    res.json(data.commentCreate.comment)
  } catch (err) { errorResponse(res, err) }
})

linearRouter.get('/teams', async (_req, res) => {
  try {
    const data = await linearQuery(`{ teams { nodes { id name key description } } }`)
    res.json(data.teams.nodes)
  } catch (err) { errorResponse(res, err) }
})

linearRouter.get('/projects', async (_req, res) => {
  try {
    const data = await linearQuery(`{
      projects(first: 50, orderBy: updatedAt) {
        nodes { id name state progress startDate targetDate lead { name } teams { nodes { id name } } }
      }
    }`)
    res.json(data.projects.nodes)
  } catch (err) { errorResponse(res, err) }
})

linearRouter.get('/cycles/:teamId', async (req, res) => {
  try {
    const data = await linearQuery(`query($teamId: String!) {
      team(id: $teamId) {
        cycles(first: 10) { nodes { id name number startsAt endsAt progress } }
        activeCycle { id }
      }
    }`, { teamId: req.params.teamId })
    const activeCycleId = data.team.activeCycle?.id
    const cycles = data.team.cycles.nodes.map((c: any) => ({
      ...c,
      name: c.name || `Cycle ${c.number}`,
      isActive: c.id === activeCycleId,
    }))
    res.json(cycles)
  } catch (err) { errorResponse(res, err) }
})

linearRouter.post('/issue', async (req, res) => {
  try {
    const { teamId, title, description, priority, stateId, assigneeId, labelIds, projectId, cycleId, estimate, dueDate } = req.body
    const input: Record<string, any> = { teamId, title }
    if (description) input.description = description
    if (priority !== undefined) input.priority = priority
    if (stateId) input.stateId = stateId
    if (assigneeId) input.assigneeId = assigneeId
    if (labelIds) input.labelIds = labelIds
    if (projectId) input.projectId = projectId
    if (cycleId) input.cycleId = cycleId
    if (estimate) input.estimate = estimate
    if (dueDate) input.dueDate = dueDate

    const data = await linearQuery(`mutation($input: IssueCreateInput!) {
      issueCreate(input: $input) { success issue { id identifier title url } }
    }`, { input })
    res.json(data.issueCreate.issue)
  } catch (err) { errorResponse(res, err) }
})

linearRouter.get('/users/search', async (req, res) => {
  try {
    const { query } = req.query as Record<string, string>
    const data = await linearQuery(`query($filter: UserFilter) {
      users(filter: $filter) { nodes { id name email avatarUrl } }
    }`, { filter: query ? { name: { containsCaseInsensitive: query } } : undefined })
    res.json(data.users.nodes)
  } catch (err) { errorResponse(res, err) }
})

function mapIssue(i: any) {
  const stateTypeMap: Record<string, string> = {
    backlog: 'todo', unstarted: 'todo', started: 'in_progress',
    completed: 'done', cancelled: 'cancelled',
  }
  return {
    id: i.identifier,
    uuid: i.id,
    title: i.title,
    description: i.description,
    status: { id: i.state?.id, name: i.state?.name || '', category: stateTypeMap[i.state?.type] || 'todo' },
    priority: { name: i.priorityLabel || 'None', level: i.priority ?? 0 },
    assignee: i.assignee ? { id: i.assignee.id, displayName: i.assignee.name, avatarUrl: i.assignee.avatarUrl, emailAddress: i.assignee.email || '' } : null,
    reporter: i.creator ? { id: i.creator.id, displayName: i.creator.name } : null,
    labels: (i.labels?.nodes || []).map((l: any) => l.name),
    sprint: i.cycle ? (i.cycle.name || `Cycle ${i.cycle.number}`) : null,
    project: i.project?.name || null,
    projectId: i.project?.id || null,
    cycleId: i.cycle?.id || null,
    estimate: i.estimate,
    dueDate: i.dueDate,
    created: i.createdAt,
    updated: i.updatedAt,
    url: i.url,
    comments: (i.comments?.nodes || []).map((c: any) => ({
      id: c.id,
      author: { displayName: c.user?.name || 'Unknown', avatarUrl: c.user?.avatarUrl },
      body: c.body,
      created: c.createdAt,
    })),
    transitions: [],
    attachments: [],
  }
}
