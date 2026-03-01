import { useState, useMemo } from 'react'
import { useJiraIssues, useBoardConfig } from '@/hooks/useJiraIssues'
import { useSettingsStore } from '@/store/settings'
import { IssueCard } from '@/components/jira/issue-card'
import { IssueDetail } from '@/components/jira/issue-detail'
import { IssueListSkeleton } from '@/components/jira/issue-list-skeleton'
import { CreateIssueForm } from '@/components/jira/create-issue-form'
import { BoardPicker } from '@/components/jira/board-picker'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import type { JiraIssue } from '@/types/jira'
import { RefreshCw, Search, LayoutGrid, List, Plus } from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'

type ViewMode = 'board' | 'list'

export function JiraPage() {
  const { data, isLoading, isError, error, refetch } = useJiraIssues()
  const boardId = useSettingsStore((s) => s.settings.jira.boardId)
  const jiraBaseUrl = useSettingsStore((s) => s.settings.jira.baseUrl)
  const projectKey = useSettingsStore((s) => s.settings.jira.projectKey)
  const updateJira = useSettingsStore((s) => s.updateJira)
  const { data: boardConfig } = useBoardConfig(boardId)
  const [showCreateForm, setShowCreateForm] = useState(false)
  // Sprint info comes from the board issues response now
  const activeSprint = (data as any)?.sprint ?? null

  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null)
  const selectedIssue = useMemo(
    () => (data?.issues || []).find((i) => i.key === selectedIssueKey) ?? null,
    [data?.issues, selectedIssueKey]
  )
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  const filteredIssues = useMemo(() => {
    let issues = data?.issues || []
    if (search) {
      const q = search.toLowerCase()
      issues = issues.filter(
        (i) =>
          i.key.toLowerCase().includes(q) ||
          i.summary.toLowerCase().includes(q)
      )
    }
    if (statusFilter) {
      issues = issues.filter((i) => i.status.name === statusFilter)
    }
    return issues
  }, [data?.issues, search, statusFilter])

  // Group issues by status for board view
  const statusGroups = useMemo(() => {
    const groups = new Map<string, JiraIssue[]>()
    for (const issue of filteredIssues) {
      const status = issue.status.name
      if (!groups.has(status)) groups.set(status, [])
      groups.get(status)!.push(issue)
    }
    return groups
  }, [filteredIssues])

  // Get column order from board config, or fall back to status names
  const columns = useMemo(() => {
    if (boardConfig?.columns?.length) {
      return boardConfig.columns.map((c) => c.name)
    }
    return Array.from(statusGroups.keys())
  }, [boardConfig, statusGroups])

  // All unique statuses for filter chips
  const allStatuses = useMemo(() => {
    const set = new Set<string>()
    for (const issue of data?.issues || []) set.add(issue.status.name)
    return Array.from(set)
  }, [data?.issues])

  const sprintDaysLeft = activeSprint?.endDate
    ? differenceInDays(parseISO(activeSprint.endDate), new Date())
    : null

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Jira Board</h1>
          <p className="text-sm text-zinc-500">
            {data ? `${data.total} issues` : 'Loading...'}
            {activeSprint && (
              <span>
                {' '}&middot; {activeSprint.name}
                {sprintDaysLeft !== null && sprintDaysLeft >= 0 && (
                  <span className="text-indigo-400"> ({sprintDaysLeft}d left)</span>
                )}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowCreateForm(true)} disabled={!projectKey}>
            <Plus size={14} />
            Create Issue
          </Button>
          <Button
            variant={viewMode === 'board' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('board')}
            title="Board view"
          >
            <LayoutGrid size={14} />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('list')}
            title="List view"
          >
            <List size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {/* Board picker + search */}
      <div className="mb-4 flex gap-3 flex-wrap">
        <BoardPicker
          value={boardId}
          onChange={(id) => updateJira({ boardId: id })}
          className="w-64"
        />

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Status filter chips */}
      {allStatuses.length > 0 && (
        <div className="mb-4 flex gap-2 flex-wrap">
          <Button
            variant={statusFilter === null ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter(null)}
          >
            All
          </Button>
          {allStatuses.map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter(statusFilter === status ? null : status)}
            >
              {status}
              <Badge variant="default" className="ml-1">
                {(data?.issues || []).filter((i) => i.status.name === status).length}
              </Badge>
            </Button>
          ))}
        </div>
      )}

      <ErrorBoundary>
        {isLoading && <IssueListSkeleton />}
        {isError && (
          <div className="rounded-xl border border-red-800/50 bg-red-950/20 p-6 text-center">
            <p className="text-sm text-red-400">Failed to load issues</p>
            <p className="text-xs text-zinc-500 mt-1">{(error as Error)?.message}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}
        {!isLoading && !isError && viewMode === 'list' && (
          <div className="space-y-3">
            {filteredIssues.length === 0 ? (
              <EmptyState search={search} />
            ) : (
              filteredIssues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} onSelect={(i) => setSelectedIssueKey(i.key)} />
              ))
            )}
          </div>
        )}
        {!isLoading && !isError && viewMode === 'board' && (
          <BoardView
            columns={columns}
            statusGroups={statusGroups}
            onSelect={(i) => setSelectedIssueKey(i.key)}
          />
        )}
      </ErrorBoundary>

      {/* Issue detail overlay */}
      {selectedIssue && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedIssueKey(null)}
          />
          <IssueDetail
            issue={selectedIssue}
            jiraBaseUrl={jiraBaseUrl}
            onClose={() => setSelectedIssueKey(null)}
          />
        </>
      )}

      {/* Create issue overlay */}
      {showCreateForm && projectKey && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowCreateForm(false)}
          />
          <CreateIssueForm
            projectKey={projectKey}
            onClose={() => setShowCreateForm(false)}
            onCreated={(issueKey) => {
              setShowCreateForm(false)
              setSelectedIssueKey(issueKey)
            }}
          />
        </>
      )}
    </div>
  )
}

function BoardView({
  columns,
  statusGroups,
  onSelect,
}: {
  columns: string[]
  statusGroups: Map<string, JiraIssue[]>
  onSelect: (issue: JiraIssue) => void
}) {
  if (columns.length === 0) {
    return <EmptyState search="" />
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((colName) => {
        const issues = statusGroups.get(colName) || []
        return (
          <div key={colName} className="w-72 shrink-0">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase text-zinc-400">{colName}</h3>
              <Badge variant="default">{issues.length}</Badge>
            </div>
            <div className="space-y-2">
              {issues.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/[0.08] p-4 text-center">
                  <p className="text-xs text-zinc-600">No issues</p>
                </div>
              )}
              {issues.map((issue) => (
                <Card
                  key={issue.id}
                  className="cursor-pointer p-3 transition-colors hover:border-white/[0.1]"
                  onClick={() => onSelect(issue)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-indigo-400">{issue.key}</span>
                    <Badge
                      variant={
                        issue.priority.name.toLowerCase().includes('high') ||
                        issue.priority.name.toLowerCase().includes('critical')
                          ? 'danger'
                          : issue.priority.name.toLowerCase().includes('medium')
                            ? 'warning'
                            : 'default'
                      }
                      className="text-[10px]"
                    >
                      {issue.priority.name}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-200 line-clamp-2">{issue.summary}</p>
                  {issue.assignee && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded-full bg-white/[0.1] flex items-center justify-center text-[10px] font-medium text-zinc-300">
                        {issue.assignee.displayName.charAt(0)}
                      </div>
                      <span className="text-xs text-zinc-500">{issue.assignee.displayName}</span>
                    </div>
                  )}
                  {issue.labels.length > 0 && (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {issue.labels.slice(0, 3).map((l) => (
                        <Badge key={l} variant="default" className="text-[10px]">
                          {l}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
      <p className="text-sm text-zinc-500">
        {search
          ? 'No issues match your search'
          : 'No issues found. Select a board above or configure Jira in Settings.'}
      </p>
    </div>
  )
}
