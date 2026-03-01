import { useState, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useGitlabMRs } from '@/hooks/useGitlab'
import { useSettingsStore } from '@/store/settings'
import { MRCard } from '@/components/gitlab/mr-card'
import { ProjectPicker } from '@/components/gitlab/project-picker'
import { CreateMRForm } from '@/components/gitlab/create-mr-form'
import { GitLabStatsPanel } from '@/components/gitlab/stats-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { GitLabProject } from '@/types/gitlab'
import { RefreshCw, Search, Plus, GitMerge, Settings } from 'lucide-react'

type ScopeFilter = 'to_review' | 'mine' | 'all'

const SCOPE_OPTIONS: { value: ScopeFilter; label: string }[] = [
  { value: 'mine', label: 'Mine' },
  { value: 'to_review', label: 'To Review' },
  { value: 'all', label: 'All' },
]

function isValidScope(value: string | null): value is ScopeFilter {
  return value === 'to_review' || value === 'mine' || value === 'all'
}

export function GitLabPage() {
  const gitlabSettings = useSettingsStore((s) => s.settings.gitlab)
  const updateGitlab = useSettingsStore((s) => s.updateGitlab)
  const navigate = useNavigate()

  const [searchParams, setSearchParams] = useSearchParams()
  const scopeParam = searchParams.get('scope')
  const scope: ScopeFilter = isValidScope(scopeParam) ? scopeParam : 'mine'

  const setScope = (newScope: ScopeFilter) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('scope', newScope)
      return next
    }, { replace: true })
  }

  const [selectedProject, setSelectedProject] = useState<GitLabProject | null>(null)
  const projectId = selectedProject?.id ?? gitlabSettings.defaultProjectId
  const [search, setSearch] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  const username = gitlabSettings.username

  const mrFilter = useMemo(() => {
    if (!username) return { scope: 'all' }
    if (scope === 'to_review') return { reviewer_username: username, scope: 'all' }
    if (scope === 'mine') return { author_username: username, scope: 'all' }
    return { scope: 'all' }
  }, [scope, username])

  const { data: mrs, isLoading, isError, error, refetch } = useGitlabMRs(projectId, mrFilter)

  const filteredMRs = useMemo(() => {
    if (!mrs) return []
    if (!search) return mrs
    const q = search.toLowerCase()
    return mrs.filter(
      (mr) =>
        mr.title.toLowerCase().includes(q) ||
        mr.source_branch.toLowerCase().includes(q) ||
        String(mr.iid).includes(q)
    )
  }, [mrs, search])

  const readyMRs = useMemo(() => filteredMRs.filter((mr) => !mr.draft), [filteredMRs])
  const draftMRs = useMemo(() => filteredMRs.filter((mr) => mr.draft), [filteredMRs])

  if (!gitlabSettings.baseUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <GitMerge size={48} className="text-zinc-700 mb-4" />
        <h2 className="text-xl font-semibold text-zinc-200 mb-2">GitLab not configured</h2>
        <p className="text-base text-zinc-500 mb-4">
          Add your GitLab URL and Personal Access Token in Settings, then come back here.
        </p>
        <Button variant="default" onClick={() => window.location.href = '/settings'}>
          <Settings size={18} className="mr-1.5" />
          Go to Settings
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col -mb-6 h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">GitLab</h1>
          <p className="text-base text-zinc-500">
            {mrs ? `${filteredMRs.length} merge requests` : 'Merge requests'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button size="sm" variant="default" onClick={() => setShowCreateForm(true)}>
            <Plus size={18} className="mr-1.5" />
            New MR
          </Button>
          <Button size="sm" variant="ghost" onClick={() => refetch()}>
            <RefreshCw size={18} />
          </Button>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Left: MR list */}
        <div className="flex-1 min-w-0 overflow-y-auto pr-2">
          {/* Project picker */}
          <div className="mb-4">
            <ProjectPicker
              value={projectId}
              onChange={(project) => {
                setSelectedProject(project)
                updateGitlab({ defaultProjectId: project.id })
              }}
            />
          </div>

          {/* Scope filter */}
          <div className="mb-4 flex gap-2">
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setScope(opt.value)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${scope === opt.value
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search size={18} className="absolute left-3 top-2.5 text-zinc-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search MRs..."
              className="pl-9"
            />
          </div>

          {/* MR list */}
          {isLoading && (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          )}

          {isError && (
            <Card className="p-6 text-center">
              <p className="text-base text-red-400">
                {(error as Error)?.message || 'Failed to load merge requests'}
              </p>
              <Button size="sm" variant="ghost" onClick={() => refetch()} className="mt-2">
                Retry
              </Button>
            </Card>
          )}

          {!isLoading && !isError && (
            <div className="space-y-3">
              {readyMRs.map((mr) => (
                <MRCard
                  key={mr.id}
                  mr={mr}
                  onSelect={(m) => navigate(`/gitlab/mr/${projectId}/${m.iid}`)}
                />
              ))}

              {draftMRs.length > 0 && readyMRs.length > 0 && (
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 border-t border-white/[0.08]" />
                  <span className="text-sm font-medium text-zinc-600 uppercase tracking-wider">Draft</span>
                  <div className="flex-1 border-t border-white/[0.08]" />
                </div>
              )}

              {draftMRs.map((mr) => (
                <MRCard
                  key={mr.id}
                  mr={mr}
                  onSelect={(m) => navigate(`/gitlab/mr/${projectId}/${m.iid}`)}
                />
              ))}

              {filteredMRs.length === 0 && projectId && (
                <Card className="p-6 text-center">
                  <p className="text-base text-zinc-500">No merge requests found</p>
                  {!username && scope !== 'all' && (
                    <p className="text-sm text-zinc-600 mt-2">
                      Set your GitLab username in{' '}
                      <a href="/settings" className="text-indigo-400 hover:underline">Settings</a>
                      {' '}to filter by "To Review" and "Mine".
                    </p>
                  )}
                </Card>
              )}
              {!projectId && (
                <Card className="p-6 text-center">
                  <p className="text-base text-zinc-500">Select a project to view merge requests</p>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Right: Stats panel */}
        <div className="hidden lg:block flex-1 min-w-0 overflow-y-auto pl-2">
          <GitLabStatsPanel projectId={projectId} />
        </div>
      </div>

      {/* Create MR dialog */}
      {projectId && (
        <CreateMRForm
          projectId={projectId}
          defaultBranch={selectedProject?.default_branch ?? 'main'}
          open={showCreateForm}
          onClose={() => setShowCreateForm(false)}
        />
      )}
    </div>
  )
}
