import { Router } from 'express'
import multer from 'multer'
import { validate } from '../lib/validate.js'
import { errorResponse } from '../lib/errors.js'
import { JiraTransitionSchema, JiraCommentSchema, JiraCreateIssueSchema } from '@zync/shared/schemas'
import { getSecret } from '../secrets/index.js'

export const jiraRouter = Router()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

function getJiraConfig() {
  const baseUrl = getSecret('JIRA_BASE_URL')
  const email = getSecret('JIRA_EMAIL')
  const apiToken = getSecret('JIRA_API_TOKEN')
  if (!baseUrl || !apiToken) {
    throw new Error('Jira not configured. Set JIRA_BASE_URL and JIRA_API_TOKEN in Settings.')
  }
  // Jira Cloud: Basic auth with email:token
  // Jira Server/Data Center: Bearer token (Personal Access Token)
  const isCloud = baseUrl.includes('atlassian.net')
  const authHeader = isCloud
    ? `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`
    : `Bearer ${apiToken}`
  return { baseUrl, authHeader, isCloud }
}

async function agileFetch(path: string, init?: RequestInit) {
  const { baseUrl, authHeader } = getJiraConfig()
  const url = `${baseUrl}/rest/agile/1.0${path}`
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
    throw new Error(`Jira Agile ${res.status}: ${text}`)
  }
  return res.json()
}

async function jiraFetch(path: string, init?: RequestInit) {
  const { baseUrl, authHeader, isCloud } = getJiraConfig()
  // Jira Cloud uses API v3, Server uses v2
  const apiVersion = isCloud ? '3' : '2'
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

function mapIssue(raw: Record<string, any>) {
  const fields = raw.fields || {}
  return {
    id: raw.id,
    key: raw.key,
    summary: fields.summary || '',
    // v3 (Cloud) uses ADF, v2 (Server) uses plain string
    description: typeof fields.description === 'string'
      ? fields.description
      : fields.description?.content
          ?.map((block: any) =>
            block.content?.map((inline: any) => inline.text || '').join('') || ''
          )
          .join('\n') || null,
    status: {
      id: fields.status?.id || '',
      name: fields.status?.name || '',
      category: fields.status?.statusCategory?.key === 'done'
        ? 'done'
        : fields.status?.statusCategory?.key === 'new'
          ? 'new'
          : 'indeterminate',
    },
    priority: {
      id: fields.priority?.id || '',
      name: fields.priority?.name || 'Medium',
      iconUrl: fields.priority?.iconUrl || '',
    },
    labels: fields.labels || [],
    assignee: fields.assignee
      ? {
          accountId: fields.assignee.accountId,
          displayName: fields.assignee.displayName,
          avatarUrl: fields.assignee.avatarUrls?.['32x32'] || '',
          emailAddress: fields.assignee.emailAddress || '',
        }
      : null,
    reporter: fields.reporter
      ? {
          accountId: fields.reporter.accountId,
          displayName: fields.reporter.displayName,
          avatarUrl: fields.reporter.avatarUrls?.['32x32'] || '',
          emailAddress: fields.reporter.emailAddress || '',
        }
      : null,
    sprint: fields.sprint
      ? {
          id: fields.sprint.id,
          name: fields.sprint.name,
          state: fields.sprint.state,
          startDate: fields.sprint.startDate,
          endDate: fields.sprint.endDate,
        }
      : null,
    created: fields.created || '',
    updated: fields.updated || '',
    attachments: (fields.attachment || []).map((a: any) => ({
      id: a.id,
      filename: a.filename,
      contentUrl: `/api/jira/attachment/${a.id}`,
      mimeType: a.mimeType || '',
      thumbnail: a.thumbnail ? `/api/jira/attachment/${a.id}` : undefined,
    })),
    transitions: [],
    comments: (fields.comment?.comments || []).map((c: any) => ({
      id: c.id,
      author: {
        accountId: c.author?.accountId || '',
        displayName: c.author?.displayName || '',
        avatarUrl: c.author?.avatarUrls?.['32x32'] || '',
        emailAddress: c.author?.emailAddress || '',
      },
      // v3 (Cloud) uses ADF, v2 (Server) uses plain string
      body: typeof c.body === 'string'
        ? c.body
        : c.body?.content
            ?.map((block: any) =>
              block.content?.map((inline: any) => inline.text || '').join('') || ''
            )
            .join('\n') || '',
      created: c.created || '',
      updated: c.updated || '',
    })),
  }
}

// Search issues
jiraRouter.get('/search', async (req, res) => {
  try {
    const jql = (req.query.jql as string) || 'assignee = currentUser() ORDER BY updated DESC'
    const data = await jiraFetch(
      `/search?jql=${encodeURIComponent(jql)}&maxResults=50&fields=summary,status,priority,labels,assignee,reporter,sprint,created,updated,description,comment,attachment`
    )
    res.json({
      issues: (data.issues || []).map(mapIssue),
      total: data.total || 0,
      startAt: data.startAt || 0,
      maxResults: data.maxResults || 50,
    })
  } catch (err) {
    errorResponse(res, err)
  }
})

// Get single issue
jiraRouter.get('/issue/:key', async (req, res) => {
  try {
    const data = await jiraFetch(`/issue/${req.params.key}?fields=summary,status,priority,labels,assignee,reporter,sprint,created,updated,description,comment,attachment`)
    res.json(mapIssue(data))
  } catch (err) {
    errorResponse(res, err)
  }
})

// Get transitions
jiraRouter.get('/issue/:key/transitions', async (req, res) => {
  try {
    const data = await jiraFetch(`/issue/${req.params.key}/transitions`)
    res.json({
      transitions: (data.transitions || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        to: {
          name: t.to?.name || '',
          statusCategory: { key: t.to?.statusCategory?.key || '' },
        },
      })),
    })
  } catch (err) {
    errorResponse(res, err)
  }
})

// Transition issue
jiraRouter.post('/issue/:key/transition', validate(JiraTransitionSchema), async (req, res) => {
  try {
    await jiraFetch(`/issue/${req.params.key}/transitions`, {
      method: 'POST',
      body: JSON.stringify({ transition: { id: req.body.transitionId } }),
    })
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// Add comment
jiraRouter.post('/issue/:key/comment', validate(JiraCommentSchema), async (req, res) => {
  try {
    const { isCloud } = getJiraConfig()
    // Cloud uses ADF format, Server uses plain string
    const commentBody = isCloud
      ? {
          body: {
            type: 'doc',
            version: 1,
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: req.body.body }] },
            ],
          },
        }
      : { body: req.body.body }

    const data = await jiraFetch(`/issue/${req.params.key}/comment`, {
      method: 'POST',
      body: JSON.stringify(commentBody),
    })
    res.json({
      id: data.id,
      author: {
        accountId: data.author?.accountId || '',
        displayName: data.author?.displayName || '',
        avatarUrl: data.author?.avatarUrls?.['32x32'] || '',
        emailAddress: data.author?.emailAddress || '',
      },
      body: req.body.body,
      created: data.created,
      updated: data.updated,
    })
  } catch (err) {
    errorResponse(res, err)
  }
})

// ── Board endpoints (Agile API) ──

// List all boards with pagination and search
jiraRouter.get('/boards', async (req, res) => {
  try {
    const projectKey = req.query.projectKey as string | undefined
    const search = req.query.search as string | undefined
    const startAt = parseInt(req.query.startAt as string) || 0
    const maxResults = parseInt(req.query.maxResults as string) || 50

    const params = new URLSearchParams({
      maxResults: String(maxResults),
      startAt: String(startAt),
    })
    if (projectKey) params.set('projectKeyOrId', projectKey)
    if (search) params.set('name', search)

    const data = await agileFetch(`/board?${params}`)
    res.json({
      boards: (data.values || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        type: b.type,
        projectKey: b.location?.projectKey || null,
      })),
      total: data.total || 0,
      startAt: data.startAt || 0,
      maxResults: data.maxResults || maxResults,
      isLast: data.isLast ?? true,
    })
  } catch (err) {
    errorResponse(res, err)
  }
})

// Get board configuration (columns + filter JQL)
jiraRouter.get('/board/:boardId/config', async (req, res) => {
  try {
    const data = await agileFetch(`/board/${req.params.boardId}/configuration`)
    res.json({
      columns: (data.columnConfig?.columns || []).map((col: any) => ({
        name: col.name,
        statuses: (col.statuses || []).map((s: any) => ({
          id: s.id,
        })),
      })),
      // The board's own filter — this is the JQL Jira uses to populate the board
      filter: data.filter || null,
    })
  } catch (err) {
    errorResponse(res, err)
  }
})

// Get the board's filter JQL, then search with it — fast, single call, all statuses
jiraRouter.get('/board/:boardId/issues', async (req, res) => {
  try {
    const { boardId } = req.params
    const extraJql = req.query.jql as string | undefined
    const fields = 'summary,status,priority,labels,assignee,reporter,sprint,created,updated,description,comment,attachment'

    // 1. Get the board's filter to know its base JQL
    let boardJql = ''
    try {
      const config = await agileFetch(`/board/${boardId}/configuration`)
      if (config.filter?.id) {
        const filter = await jiraFetch(`/filter/${config.filter.id}`)
        boardJql = filter.jql || ''
      }
    } catch {
      // fallback: just use board issue endpoint
    }

    // 2. Combine board JQL with any extra filter
    // Strip existing ORDER BY from board JQL before combining
    const orderByRegex = /\s+ORDER\s+BY\s+.+$/i
    const boardJqlClean = boardJql.replace(orderByRegex, '').trim()
    const extraJqlClean = extraJql ? extraJql.replace(orderByRegex, '').trim() : ''

    let finalJql = ''
    if (boardJqlClean && extraJqlClean) {
      finalJql = `(${boardJqlClean}) AND (${extraJqlClean}) ORDER BY status ASC, updated DESC`
    } else if (boardJqlClean) {
      finalJql = `${boardJqlClean} ORDER BY status ASC, updated DESC`
    } else if (extraJqlClean) {
      finalJql = `${extraJqlClean} ORDER BY status ASC, updated DESC`
    }

    // 3. Single fast search call via REST API (not agile) — gets ALL statuses
    if (finalJql) {
      const data = await jiraFetch(
        `/search?jql=${encodeURIComponent(finalJql)}&maxResults=200&fields=${fields}`
      )

      // Also get active sprint info
      let sprint = null
      try {
        const sprintData = await agileFetch(`/board/${boardId}/sprint?state=active`)
        const s = sprintData?.values?.[0]
        if (s) {
          sprint = { id: s.id, name: s.name, state: s.state, startDate: s.startDate, endDate: s.endDate }
        }
      } catch { /* no sprint */ }

      res.json({
        issues: (data.issues || []).map(mapIssue),
        total: data.total || 0,
        startAt: 0,
        maxResults: data.total || 0,
        sprint,
      })
    } else {
      // No filter found — fallback to agile endpoint
      const data = await agileFetch(
        `/board/${boardId}/issue?maxResults=200&fields=${fields}`
      )
      res.json({
        issues: (data.issues || []).map(mapIssue),
        total: data.total || 0,
        startAt: 0,
        maxResults: data.total || 0,
        sprint: null,
      })
    }
  } catch (err) {
    errorResponse(res, err)
  }
})

// Get active sprint for a board
jiraRouter.get('/board/:boardId/sprint', async (req, res) => {
  try {
    const data = await agileFetch(`/board/${req.params.boardId}/sprint?state=active`)
    const sprint = data.values?.[0]
    res.json(
      sprint
        ? {
            id: sprint.id,
            name: sprint.name,
            state: sprint.state,
            startDate: sprint.startDate,
            endDate: sprint.endDate,
          }
        : null
    )
  } catch (err) {
    errorResponse(res, err)
  }
})

// ── Issue Creation Endpoints ──

// Get project metadata (issue types, components, versions, priorities)
jiraRouter.get('/project/:key/meta', async (req, res) => {
  try {
    const { key } = req.params
    const [project, priorities, labelsData] = await Promise.all([
      jiraFetch(`/project/${key}`),
      jiraFetch('/priority'),
      jiraFetch('/jql/autocompletedata/suggestions?fieldName=labels&fieldValue=').catch(() => ({ results: [] })),
    ])

    const labels: string[] = (labelsData.results || labelsData.suggestions || [])
      .map((l: any) => (typeof l === 'string' ? l : l.value || l.displayName || l.label || ''))
      .filter(Boolean)

    res.json({
      issueTypes: (project.issueTypes || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        iconUrl: t.iconUrl || '',
        subtask: t.subtask || false,
      })),
      components: (project.components || []).map((c: any) => ({
        id: c.id,
        name: c.name,
      })),
      versions: (project.versions || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        released: v.released || false,
      })),
      priorities: (priorities || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        iconUrl: p.iconUrl || '',
      })),
      labels,
    })
  } catch (err) {
    errorResponse(res, err)
  }
})

// Search assignable users
jiraRouter.get('/users/search', async (req, res) => {
  try {
    const { isCloud } = getJiraConfig()
    const query = req.query.query as string || ''
    const projectKey = req.query.projectKey as string | undefined

    const params = new URLSearchParams()
    if (isCloud) {
      params.set('query', query)
    } else {
      params.set('username', query)
    }
    if (projectKey) params.set('project', projectKey)

    const data = await jiraFetch(`/user/assignable/search?${params}`)
    res.json(
      (data || []).map((u: any) => ({
        accountId: u.accountId || u.name || u.key || '',
        displayName: u.displayName || '',
        avatarUrl: u.avatarUrls?.['32x32'] || '',
        emailAddress: u.emailAddress || '',
      }))
    )
  } catch (err) {
    errorResponse(res, err)
  }
})

// Get create issue fields metadata (createmeta)
jiraRouter.get('/project/:key/issuetype/:typeId/fields', async (req, res) => {
  try {
    const { key, typeId } = req.params

    // Known fields rendered by the form natively — skip these from dynamic list
    const KNOWN_FIELDS = new Set([
      'project', 'issuetype', 'summary', 'description', 'priority',
      'labels', 'assignee', 'reporter', 'components', 'fixVersions',
      'attachment', 'issuelinks',
    ])

    let fieldsMap: Record<string, any> = {}

    // Try new createmeta endpoints (Jira 8.4+, required for 9.0+)
    try {
      const data = await jiraFetch(
        `/issue/createmeta/${key}/issuetypes/${typeId}?maxResults=200`
      )
      // New endpoint returns { values: [{ fieldId, name, required, schema, allowedValues, ... }] }
      for (const f of data.values || []) {
        fieldsMap[f.fieldId] = f
      }
    } catch {
      // Fallback to old createmeta endpoint
      const data = await jiraFetch(
        `/issue/createmeta?projectKeys=${key}&issuetypeIds=${typeId}&expand=projects.issuetypes.fields`
      )
      const issueType = data.projects?.[0]?.issuetypes?.[0]
      if (issueType?.fields) {
        for (const [fieldId, meta] of Object.entries<any>(issueType.fields)) {
          fieldsMap[fieldId] = { fieldId, ...meta }
        }
      }
    }

    // Normalize and filter
    const fields = Object.entries(fieldsMap)
      .filter(([id]) => !KNOWN_FIELDS.has(id))
      .map(([id, f]: [string, any]) => ({
        fieldId: f.fieldId || id,
        name: f.name || id,
        required: f.required ?? false,
        schema: f.schema || { type: 'string' },
        allowedValues: f.allowedValues || undefined,
        hasDefaultValue: f.hasDefaultValue ?? false,
        operations: f.operations || [],
      }))

    res.json(fields)
  } catch (err) {
    errorResponse(res, err)
  }
})

// Create issue
jiraRouter.post('/issue', validate(JiraCreateIssueSchema), async (req, res) => {
  try {
    const { isCloud } = getJiraConfig()
    const {
      projectKey,
      issueTypeId,
      summary,
      description,
      priorityId,
      assigneeId,
      reporterId,
      labels,
      componentIds,
      fixVersionIds,
      customFields,
    } = req.body

    const fields: Record<string, any> = {
      project: { key: projectKey },
      issuetype: { id: issueTypeId },
      summary,
    }

    if (description) {
      if (isCloud) {
        fields.description = {
          type: 'doc',
          version: 1,
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: description }] },
          ],
        }
      } else {
        fields.description = description
      }
    }

    if (priorityId) fields.priority = { id: priorityId }
    if (labels?.length) fields.labels = labels
    if (componentIds?.length) {
      fields.components = componentIds.map((id: string) => ({ id }))
    }
    if (fixVersionIds?.length) {
      fields.fixVersions = fixVersionIds.map((id: string) => ({ id }))
    }

    if (assigneeId) {
      fields.assignee = isCloud
        ? { accountId: assigneeId }
        : { name: assigneeId }
    }
    if (reporterId) {
      fields.reporter = isCloud
        ? { accountId: reporterId }
        : { name: reporterId }
    }

    // Merge dynamic custom fields
    if (customFields && typeof customFields === 'object') {
      Object.assign(fields, customFields)
    }

    const data = await jiraFetch('/issue', {
      method: 'POST',
      body: JSON.stringify({ fields }),
    })

    res.json({ id: data.id, key: data.key, self: data.self })
  } catch (err) {
    errorResponse(res, err)
  }
})

// List all projects
jiraRouter.get('/projects', async (req, res) => {
  try {
    const data = await jiraFetch('/project')
    res.json(
      (data || []).map((p: any) => ({
        key: p.key,
        name: p.name,
        avatarUrl: p.avatarUrls?.['32x32'] || '',
      }))
    )
  } catch (err) {
    errorResponse(res, err)
  }
})

// Upload attachments to an issue
jiraRouter.post('/issue/:key/attachments', upload.array('files', 20), async (req, res) => {
  try {
    const { baseUrl, authHeader } = getJiraConfig()
    const files = req.files as Express.Multer.File[]
    if (!files?.length) {
      res.status(400).json({ error: 'No files provided' })
      return
    }

    const { isCloud } = getJiraConfig()
    const apiVersion = isCloud ? '3' : '2'
    const url = `${baseUrl}/rest/api/${apiVersion}/issue/${req.params.key}/attachments`

    const formData = new FormData()
    for (const file of files) {
      formData.append('file', new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname)
    }

    const jiraRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'X-Atlassian-Token': 'no-check',
      },
      body: formData,
    })

    if (!jiraRes.ok) {
      const text = await jiraRes.text()
      throw new Error(`Jira ${jiraRes.status}: ${text}`)
    }

    const result = await jiraRes.json()
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

// Proxy attachment content (images need auth headers)
jiraRouter.get('/attachment/:id', async (req, res) => {
  try {
    const { authHeader } = getJiraConfig()
    const meta = await jiraFetch(`/attachment/${req.params.id}`)
    const contentUrl = meta.content

    if (!contentUrl) {
      res.status(404).json({ error: 'Attachment not found' })
      return
    }

    const fileRes = await fetch(contentUrl, {
      headers: { Authorization: authHeader },
    })

    if (!fileRes.ok || !fileRes.body) {
      res.status(fileRes.status).json({ error: 'Failed to fetch attachment' })
      return
    }

    const contentType = fileRes.headers.get('content-type') || 'application/octet-stream'
    const contentLength = fileRes.headers.get('content-length')
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=86400')
    if (contentLength) res.setHeader('Content-Length', contentLength)

    const reader = fileRes.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
    }
    res.end()
  } catch (err) {
    errorResponse(res, err)
  }
})
