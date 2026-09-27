import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../api'
import { boardUrl } from '../boards/shared'
import { TextButton } from '../components/Button'
import { Toggle } from '../components/Controls'
import { useToast } from '../components/Dialog'
import { IconBoard, IconCalendar, IconClock, IconFile, IconPeople, IconSpark } from '../icons'
import { fileUrl, useShowHidden, wsUrl } from '../shell/context'
import { Card } from '../ui'

const AGENTS_TEMPLATE = `# Instructions for the AI in this workspace

Every chat and job in this workspace reads this file first.

- What this workspace is about:
- Where things go (notes, reports, …):
- Conventions (language, tone, file names):
`

/**
 * Every file that configures the workspace or the AI, with a direct link — most are hidden
 * dotfiles you wouldn't otherwise find (a board's .board.json, a job's .opencode/jobs/<name>.md).
 */
export function ConfigFiles({ ws }: { ws: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const [hidden, setHidden] = useShowHidden()
  const boards = useQuery({ queryKey: ['boards', ws], queryFn: () => api.boards(ws) }).data ?? []
  const jobs = useQuery({ queryKey: ['jobs', ws], queryFn: () => api.jobs(ws) }).data ?? []
  const root = useQuery({ queryKey: ['tree', ws, '', false], queryFn: () => api.tree(ws, '') }).data
  const hasAgents = root?.entries.some((e) => e.name === 'AGENTS.md')
  const hasCalendar = root?.entries.some((e) => e.name === 'Calendar' && e.type === 'dir')
  const ownJobs = jobs.filter((j) => !j.job?.card)

  const createAgents = async () => {
    try {
      await api.save(ws, 'AGENTS.md', AGENTS_TEMPLATE)
      await qc.invalidateQueries({ queryKey: ['tree', ws] })
      navigate(fileUrl(ws, 'AGENTS.md'))
    } catch (e) {
      toast((e as Error).message, 'bad')
    }
  }

  return (
    <Card title="Config files" meta={`${ws} · and global`}>
      <div className="col">
        <Group label="This workspace">
          <Row
            icon={<IconFile size={14} />}
            name="AGENTS.md"
            hint="Instructions every chat and job in this workspace follows"
            to={hasAgents ? fileUrl(ws, 'AGENTS.md') : undefined}
            action={hasAgents ? undefined : <TextButton onClick={() => void createAgents()}>[+] Create</TextButton>}
          />
          {boards.map((b) => (
            <Row
              key={b.path}
              icon={<IconBoard size={14} />}
              name={`${b.path}/.board.json`}
              hint={`Columns of the board “${b.name}”`}
              to={fileUrl(ws, `${b.path}/.board.json`)}
              action={
                <Link className="link muted" to={boardUrl(ws, b.path)}>
                  [Board]
                </Link>
              }
            />
          ))}
          {ownJobs.map((j) => (
            <Row
              key={j.name}
              icon={<IconClock size={14} />}
              name={`.opencode/jobs/${j.name}.md`}
              hint={j.error ? `Invalid: ${j.error}` : (j.job?.schedule ?? j.job?.at ?? 'Scheduled AI job')}
              bad={!!j.error}
              to={fileUrl(ws, `.opencode/jobs/${j.name}.md`)}
            />
          ))}
          <Row
            icon={<IconCalendar size={14} />}
            name="Calendar/"
            hint="Events: one page per event (start, end, people in the frontmatter)"
            to={hasCalendar ? wsUrl(ws, 'files?dir=Calendar') : wsUrl(ws, 'calendar')}
          />
        </Group>
        <Group label="All workspaces">
          <Row
            icon={<IconSpark size={14} />}
            name="opencode.json · agents · commands · skills"
            hint="The AI server’s config and the AI’s agents, commands and skills"
            to={wsUrl(ws, 'opencode')}
          />
          <Row
            icon={<IconPeople size={14} />}
            name="People"
            hint="Who cards and events can be assigned to (.zync/people.json in the workspaces root)"
            to={wsUrl(ws, 'people')}
          />
        </Group>
        <div className="row between g12 cfg-toggle">
          <span className="small muted">Show hidden files (.board.json, .opencode/ …) in the file tree</span>
          <Toggle label="Show hidden files" checked={hidden} onChange={setHidden} />
        </div>
      </div>
    </Card>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="col cfg-group">
      <span className="mh mono-s muted">{label}</span>
      {children}
    </div>
  )
}

function Row({
  icon,
  name,
  hint,
  to,
  action,
  bad,
}: {
  icon: ReactNode
  name: string
  hint: string
  to?: string
  action?: ReactNode
  bad?: boolean
}) {
  const body = (
    <>
      {icon}
      <span className="grow col" style={{ minWidth: 0 }}>
        <span className="oc-name mono-s trunc">{name}</span>
        <span className={`small trunc ${bad ? 'danger-t' : 'muted'}`}>{hint}</span>
      </span>
    </>
  )
  return (
    <div className="row g8 cfg-row">
      {to ? (
        <Link to={to} className="oc-row grow">
          {body}
          <span className="mono-s muted">Open →</span>
        </Link>
      ) : (
        <div className="oc-row grow">{body}</div>
      )}
      {action}
    </div>
  )
}
