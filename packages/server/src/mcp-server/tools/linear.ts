import { z } from 'zod'
import { getSecret } from '../../secrets/index.js'

function getLinearConfig() {
  const apiKey = getSecret('LINEAR_API_KEY')
  if (!apiKey) {
    throw new Error('Linear not configured. Set LINEAR_API_KEY in Settings.')
  }
  const defaultTeamId = getSecret('LINEAR_DEFAULT_TEAM_ID') || undefined
  return { apiKey, defaultTeamId }
}

async function linearQuery(query: string, variables?: Record<string, any>) {
  const { apiKey } = getLinearConfig()
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Linear ${res.status}: ${text}`)
  }
  const json = await res.json()
  if (json.errors?.length) {
    throw new Error(`Linear GraphQL: ${json.errors.map((e: any) => e.message).join(', ')}`)
  }
  return json.data
}

// --- 1. check_linear ---

export const checkLinearSchema = z.object({
  team_id: z.string().optional().describe('Team ID to filter by (uses default if not set)'),
})

export async function checkLinear(input: z.infer<typeof checkLinearSchema>) {
  const { defaultTeamId } = getLinearConfig()
  const teamId = input.team_id || defaultTeamId
  const teamFilter = teamId ? `filter: { team: { id: { eq: "${teamId}" } } }` : ''
  const filterArg = teamFilter ? `, ${teamFilter}` : ''
  const data = await linearQuery(`{
    assigned: issues(first: 50, orderBy: updatedAt, filter: { assignee: { isMe: { eq: true } }${teamId ? `, team: { id: { eq: "${teamId}" } }` : ''} }) {
      nodes {
        identifier
        title
        state { name type }
        priority
        priorityLabel
        assignee { name }
        updatedAt
      }
    }
    created: issues(first: 50, orderBy: updatedAt, filter: { creator: { isMe: { eq: true } }${teamId ? `, team: { id: { eq: "${teamId}" } }` : ''} }) {
      nodes {
        identifier
        title
        state { name type }
        priority
        priorityLabel
        assignee { name }
        updatedAt
      }
    }
  }`)
  // Merge assigned + created, deduplicate by identifier
  const seen = new Set<string>()
  const all = [...(data.assigned?.nodes || []), ...(data.created?.nodes || [])]
  const issues = all
    .filter((i: any) => {
      if (seen.has(i.identifier)) return false
      seen.add(i.identifier)
      return true
    })
    .map((i: any) => ({
      id: i.identifier,
      title: i.title,
      status: i.state?.name || '',
      statusType: i.state?.type || '',
      priority: i.priorityLabel || '',
      assignee: i.assignee?.name || '',
      updatedAt: i.updatedAt,
    }))
  return JSON.stringify(issues)
}

// --- 2. get_linear_issue ---

export const getLinearIssueSchema = z.object({
  issue_id: z.string().describe('Issue identifier (e.g. ENG-123)'),
})

export async function getLinearIssue(input: z.infer<typeof getLinearIssueSchema>) {
  const data = await linearQuery(`query($id: String!) {
    issue(id: $id) {
      identifier
      title
      description
      state { name type }
      priority
      priorityLabel
      assignee { name email }
      creator { name email }
      labels { nodes { name } }
      project { name }
      cycle { name number }
      estimate
      dueDate
      createdAt
      updatedAt
      url
    }
  }`, { id: input.issue_id })
  const i = data.issue
  return JSON.stringify({
    id: i.identifier,
    title: i.title,
    description: i.description,
    status: i.state?.name || '',
    statusType: i.state?.type || '',
    priority: i.priorityLabel || '',
    assignee: i.assignee?.name || '',
    creator: i.creator?.name || '',
    labels: (i.labels?.nodes || []).map((l: any) => l.name),
    project: i.project?.name || null,
    cycle: i.cycle ? `${i.cycle.name || `Cycle ${i.cycle.number}`}` : null,
    estimate: i.estimate,
    dueDate: i.dueDate,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    url: i.url,
  })
}

// --- 3. search_linear ---

export const searchLinearSchema = z.object({
  query: z.string().optional().describe('Text search query'),
  team_id: z.string().optional().describe('Filter by team ID'),
  state: z.string().optional().describe('Filter by state name (e.g. "In Progress")'),
  label: z.string().optional().describe('Filter by label name'),
  assignee: z.string().optional().describe('Filter by assignee name'),
  project: z.string().optional().describe('Filter by project name'),
  max_results: z.number().default(50).describe('Max results (default 50)'),
})

export async function searchLinear(input: z.infer<typeof searchLinearSchema>) {
  const { defaultTeamId } = getLinearConfig()
  const filters: string[] = []
  const teamId = input.team_id || defaultTeamId
  if (teamId) filters.push(`team: { id: { eq: "${teamId}" } }`)
  if (input.state) filters.push(`state: { name: { eqCaseInsensitive: "${input.state}" } }`)
  if (input.label) filters.push(`labels: { name: { eqCaseInsensitive: "${input.label}" } }`)
  if (input.assignee) filters.push(`assignee: { name: { containsCaseInsensitive: "${input.assignee}" } }`)
  if (input.project) filters.push(`project: { name: { containsCaseInsensitive: "${input.project}" } }`)
  const filterStr = filters.length ? `, filter: { ${filters.join(', ')} }` : ''

  if (input.query) {
    const data = await linearQuery(`query($query: String!, $first: Int!) {
      searchIssues(query: $query, first: $first${filterStr}) {
        nodes {
          identifier title
          state { name }
          priorityLabel
          assignee { name }
        }
      }
    }`, { query: input.query, first: input.max_results })
    return JSON.stringify(data.searchIssues.nodes.map((i: any) => ({
      id: i.identifier,
      title: i.title,
      status: i.state?.name || '',
      priority: i.priorityLabel || '',
      assignee: i.assignee?.name || '',
    })))
  }

  const data = await linearQuery(`{
    issues(first: ${input.max_results}, orderBy: updatedAt${filterStr}) {
      nodes {
        identifier title
        state { name }
        priorityLabel
        assignee { name }
      }
    }
  }`)
  return JSON.stringify(data.issues.nodes.map((i: any) => ({
    id: i.identifier,
    title: i.title,
    status: i.state?.name || '',
    priority: i.priorityLabel || '',
    assignee: i.assignee?.name || '',
  })))
}

// --- 4. create_linear_issue ---

export const createLinearIssueSchema = z.object({
  team_id: z.string().describe('Team ID (required)'),
  title: z.string().describe('Issue title'),
  description: z.string().optional().describe('Issue description (markdown)'),
  priority: z.number().min(0).max(4).optional().describe('Priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low'),
  state_id: z.string().optional().describe('Workflow state ID'),
  assignee_id: z.string().optional().describe('Assignee user ID'),
  label_ids: z.array(z.string()).optional().describe('Label IDs'),
  project_id: z.string().optional().describe('Project ID'),
  cycle_id: z.string().optional().describe('Cycle ID'),
  estimate: z.number().optional().describe('Estimate points'),
  due_date: z.string().optional().describe('Due date (YYYY-MM-DD)'),
})

export async function createLinearIssue(input: z.infer<typeof createLinearIssueSchema>) {
  const vars: Record<string, any> = {
    teamId: input.team_id,
    title: input.title,
  }
  if (input.description) vars.description = input.description
  if (input.priority !== undefined) vars.priority = input.priority
  if (input.state_id) vars.stateId = input.state_id
  if (input.assignee_id) vars.assigneeId = input.assignee_id
  if (input.label_ids) vars.labelIds = input.label_ids
  if (input.project_id) vars.projectId = input.project_id
  if (input.cycle_id) vars.cycleId = input.cycle_id
  if (input.estimate) vars.estimate = input.estimate
  if (input.due_date) vars.dueDate = input.due_date

  const data = await linearQuery(`mutation($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue { identifier title url }
    }
  }`, { input: vars })
  const issue = data.issueCreate.issue
  return JSON.stringify({ id: issue.identifier, title: issue.title, url: issue.url })
}

// --- 5. comment_linear ---

export const commentLinearSchema = z.object({
  issue_id: z.string().describe('Issue identifier (e.g. ENG-123)'),
  body: z.string().describe('Comment body (markdown)'),
})

export async function commentLinear(input: z.infer<typeof commentLinearSchema>) {
  const issueData = await linearQuery(`query($id: String!) {
    issue(id: $id) { id }
  }`, { id: input.issue_id })
  const data = await linearQuery(`mutation($input: CommentCreateInput!) {
    commentCreate(input: $input) {
      success
      comment { id body }
    }
  }`, { input: { issueId: issueData.issue.id, body: input.body } })
  return JSON.stringify({ success: data.commentCreate.success })
}

// --- 6. transition_linear ---

export const transitionLinearSchema = z.object({
  issue_id: z.string().describe('Issue identifier (e.g. ENG-123)'),
  state_id: z.string().describe('Target workflow state ID'),
})

export async function transitionLinear(input: z.infer<typeof transitionLinearSchema>) {
  const issueData = await linearQuery(`query($id: String!) {
    issue(id: $id) { id }
  }`, { id: input.issue_id })
  const data = await linearQuery(`mutation($id: String!, $input: IssueUpdateInput!) {
    issueUpdate(id: $id, input: $input) {
      success
      issue { identifier state { name } }
    }
  }`, { id: issueData.issue.id, input: { stateId: input.state_id } })
  const issue = data.issueUpdate.issue
  return JSON.stringify({ id: issue.identifier, newState: issue.state?.name })
}

// --- 7. get_linear_states ---

export const getLinearStatesSchema = z.object({
  team_id: z.string().optional().describe('Team ID (uses default if not set)'),
})

export async function getLinearStates(input: z.infer<typeof getLinearStatesSchema>) {
  const { defaultTeamId } = getLinearConfig()
  const teamId = input.team_id || defaultTeamId
  if (!teamId) throw new Error('team_id is required (no default team configured)')
  const data = await linearQuery(`query($teamId: String!) {
    team(id: $teamId) {
      states { nodes { id name type position } }
    }
  }`, { teamId })
  const states = data.team.states.nodes
    .sort((a: any, b: any) => a.position - b.position)
    .map((s: any) => ({ id: s.id, name: s.name, type: s.type }))
  return JSON.stringify(states)
}

// --- 8. summarize_cycle ---

export const summarizeCycleSchema = z.object({
  team_id: z.string().optional().describe('Team ID (uses default if not set)'),
})

export async function summarizeCycle(input: z.infer<typeof summarizeCycleSchema>) {
  const { defaultTeamId } = getLinearConfig()
  const teamId = input.team_id || defaultTeamId
  if (!teamId) throw new Error('team_id is required (no default team configured)')
  const data = await linearQuery(`query($teamId: String!) {
    team(id: $teamId) {
      activeCycle {
        name number
        startsAt endsAt
        progress
        issues { nodes { state { name type } } }
      }
    }
  }`, { teamId })
  const cycle = data.team.activeCycle
  if (!cycle) return JSON.stringify({ error: 'No active cycle' })
  const issues = cycle.issues?.nodes || []
  const byStatus: Record<string, number> = {}
  for (const i of issues) {
    const status = i.state?.name || 'Unknown'
    byStatus[status] = (byStatus[status] || 0) + 1
  }
  return JSON.stringify({
    name: cycle.name || `Cycle ${cycle.number}`,
    startsAt: cycle.startsAt,
    endsAt: cycle.endsAt,
    progress: cycle.progress,
    total: issues.length,
    byStatus,
  })
}

// --- 9. list_linear_projects ---

export const listLinearProjectsSchema = z.object({
  first: z.number().default(50).describe('Max results (default 50)'),
})

export async function listLinearProjects(input: z.infer<typeof listLinearProjectsSchema>) {
  const data = await linearQuery(`query($first: Int!) {
    projects(first: $first, orderBy: updatedAt) {
      nodes {
        id name state
        progress
        startDate targetDate
        lead { name }
        teams { nodes { name } }
      }
    }
  }`, { first: input.first })
  return JSON.stringify(data.projects.nodes.map((p: any) => ({
    id: p.id,
    name: p.name,
    state: p.state,
    progress: Math.round((p.progress || 0) * 100),
    startDate: p.startDate,
    targetDate: p.targetDate,
    lead: p.lead?.name || null,
    teams: (p.teams?.nodes || []).map((t: any) => t.name),
  })))
}

// --- 10. list_linear_teams ---

export const listLinearTeamsSchema = z.object({})

export async function listLinearTeams() {
  const data = await linearQuery(`{
    teams {
      nodes {
        id name key description
        members { nodes { name email } }
      }
    }
  }`)
  return JSON.stringify(data.teams.nodes.map((t: any) => ({
    id: t.id,
    name: t.name,
    key: t.key,
    description: t.description,
    memberCount: t.members?.nodes?.length || 0,
  })))
}

// --- 11. get_linear_cycles ---

export const getLinearCyclesSchema = z.object({
  team_id: z.string().optional().describe('Team ID (uses default if not set)'),
  include_completed: z.boolean().default(false).describe('Include completed cycles'),
})

export async function getLinearCycles(input: z.infer<typeof getLinearCyclesSchema>) {
  const { defaultTeamId } = getLinearConfig()
  const teamId = input.team_id || defaultTeamId
  if (!teamId) throw new Error('team_id is required (no default team configured)')
  const filter = input.include_completed ? '' : ', filter: { isActive: { eq: true } }'
  const data = await linearQuery(`query($teamId: String!) {
    team(id: $teamId) {
      cycles(first: 10${filter}) {
        nodes {
          id name number
          startsAt endsAt
          progress
        }
      }
    }
  }`, { teamId })
  return JSON.stringify(data.team.cycles.nodes.map((c: any) => ({
    id: c.id,
    name: c.name || `Cycle ${c.number}`,
    number: c.number,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    progress: Math.round((c.progress || 0) * 100),
  })))
}

// --- 12. create_linear_project ---

export const createLinearProjectSchema = z.object({
  name: z.string().describe('Project name'),
  description: z.string().optional().describe('Project description'),
  team_ids: z.array(z.string()).describe('Team IDs to associate'),
  lead_id: z.string().optional().describe('Project lead user ID'),
  target_date: z.string().optional().describe('Target date (YYYY-MM-DD)'),
})

export async function createLinearProject(input: z.infer<typeof createLinearProjectSchema>) {
  const vars: Record<string, any> = {
    name: input.name,
    teamIds: input.team_ids,
  }
  if (input.description) vars.description = input.description
  if (input.lead_id) vars.leadId = input.lead_id
  if (input.target_date) vars.targetDate = input.target_date

  const data = await linearQuery(`mutation($input: ProjectCreateInput!) {
    projectCreate(input: $input) {
      success
      project { id name url }
    }
  }`, { input: vars })
  const project = data.projectCreate.project
  return JSON.stringify({ id: project.id, name: project.name, url: project.url })
}

// --- 13. assign_linear_issue ---

export const assignLinearIssueSchema = z.object({
  issue_id: z.string().describe('Issue identifier (e.g. ENG-123)'),
  assignee_id: z.string().nullable().describe('User ID to assign, or null to unassign'),
})

export async function assignLinearIssue(input: z.infer<typeof assignLinearIssueSchema>) {
  const issueData = await linearQuery(`query($id: String!) {
    issue(id: $id) { id }
  }`, { id: input.issue_id })
  const data = await linearQuery(`mutation($id: String!, $input: IssueUpdateInput!) {
    issueUpdate(id: $id, input: $input) {
      success
      issue { identifier assignee { name } }
    }
  }`, { id: issueData.issue.id, input: { assigneeId: input.assignee_id } })
  const issue = data.issueUpdate.issue
  return JSON.stringify({ id: issue.identifier, assignee: issue.assignee?.name || null })
}

// --- 14. list_linear_labels ---

export const listLinearLabelsSchema = z.object({
  team_id: z.string().optional().describe('Team ID (uses default if not set)'),
})

export async function listLinearLabels(input: z.infer<typeof listLinearLabelsSchema>) {
  const { defaultTeamId } = getLinearConfig()
  const teamId = input.team_id || defaultTeamId
  const filter = teamId ? `(filter: { team: { id: { eq: "${teamId}" } } })` : ''
  const data = await linearQuery(`{
    issueLabels${filter} {
      nodes { id name color }
    }
  }`)
  return JSON.stringify(data.issueLabels.nodes.map((l: any) => ({
    id: l.id,
    name: l.name,
    color: l.color,
  })))
}
