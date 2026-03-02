import { useState, useMemo, useRef, useEffect } from 'react'
import { useGitlabMRNotes, useGitlabMRApprovals, useAddMRNote, useGitlabMRChanges, useEditMRNote, useDeleteMRNote } from '@/hooks/useGitlab'
import { useSettingsStore } from '@/store/settings'
import { MarkdownContent } from '@/components/ui/markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DiffViewer } from './diff-viewer'
import { FileTree } from './file-tree'
import { AIReviewPanel } from './ai-review-panel'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import type { GitLabMergeRequest, GitLabNote, GitLabMRChange, PRAgentItem } from '@/types/gitlab'
import { formatDate, relativeTime } from '@/lib/utils'
import {
  ExternalLink, Check, MessageCircle, User, Send, X,
  FileCode, Bot, GitBranch, Clock, Tag, ArrowRight, Shield,
  Maximize2, Minimize2, Pencil, Trash2, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'

const stateVariant = (state: string, draft: boolean) => {
  if (draft) return 'default' as const
  switch (state) {
    case 'merged': return 'primary' as const
    case 'closed': return 'danger' as const
    default: return 'success' as const
  }
}

interface MRDetailProps {
  mr: GitLabMergeRequest
  projectId: number
  onClose?: () => void
  isFullPage?: boolean
  onToggleFullPage?: () => void
}

export function MRDetail({ mr, projectId, onClose, isFullPage, onToggleFullPage }: MRDetailProps) {
  const gitlabBaseUrl = useSettingsStore((s) => s.settings.gitlab.baseUrl)
  const { data: notes } = useGitlabMRNotes(projectId, mr.iid)
  const { data: approvals } = useGitlabMRApprovals(projectId, mr.iid)
  const { data: changesData } = useGitlabMRChanges(projectId, mr.iid)
  const addNote = useAddMRNote()
  const editNote = useEditMRNote()
  const deleteNote = useDeleteMRNote()
  const [reviewItems, setReviewItems] = useState<PRAgentItem[]>([])
  const [noteBody, setNoteBody] = useState('')
  const urlFile = new URLSearchParams(window.location.search).get('file')
  const [selectedFile, setSelectedFileState] = useState<string | null>(urlFile)
  const diffPanelRef = useRef<HTMLDivElement>(null)
  const setSelectedFile = (file: string | null) => {
    // Toggle: clicking the same file deselects it
    const next = file === selectedFile ? null : file
    setSelectedFileState(next)
    const params = new URLSearchParams(window.location.search)
    if (next) params.set('file', next)
    else params.delete('file')
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`)
  }

  // Fetch cached PR-Agent review results
  useEffect(() => {
    fetch(`/api/pr-agent/results/${projectId}/${mr.iid}?tool=review`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.result?.items) setReviewItems(data.result.items)
      })
      .catch(() => {})
  }, [projectId, mr.iid])

  // Persist active tab in URL search params
  const validTabs = ['discussion', 'changes', 'ai-review'] as const
  type Tab = typeof validTabs[number]
  const searchParams = new URLSearchParams(window.location.search)
  const urlTab = searchParams.get('tab') as Tab | null
  const [tab, setTabState] = useState<Tab>(urlTab && validTabs.includes(urlTab) ? urlTab : 'discussion')
  const setTab = (t: Tab) => {
    setTabState(t)
    const params = new URLSearchParams(window.location.search)
    params.set('tab', t)
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`)
  }

  const userNotes = notes?.filter((n) => !n.system) ?? []
  const changes = changesData?.changes ?? []
  const diffRefs = changesData?.diff_refs

  const handleAddNote = async () => {
    if (!noteBody.trim()) return
    try {
      await addNote.mutateAsync({ projectId, iid: mr.iid, body: noteBody })
      setNoteBody('')
      toast.success('Comment added')
    } catch {
      toast.error('Failed to add comment')
    }
  }

  const handleEditNote = async (noteId: number, body: string) => {
    try {
      await editNote.mutateAsync({ projectId, iid: mr.iid, noteId, body })
      toast.success('Comment updated')
    } catch {
      toast.error('Failed to update comment')
    }
  }

  const handleDeleteNote = async (noteId: number) => {
    try {
      await deleteNote.mutateAsync({ projectId, iid: mr.iid, noteId })
      toast.success('Comment deleted')
    } catch {
      toast.error('Failed to delete comment')
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#1a1d1e]/95 backdrop-blur-md shadow-2xl">
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.08] px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <a
              href={mr.web_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded bg-indigo-500/15 px-3 py-0.5 text-sm font-mono font-semibold text-indigo-400 hover:bg-indigo-500/25 transition-colors"
            >
              !{mr.iid}
            </a>
            <Badge variant={stateVariant(mr.state, mr.draft)}>
              {mr.draft ? 'Draft' : mr.state}
            </Badge>
            {approvals?.approved && (
              <Badge variant="success">
                <Check size={14} className="mr-0.5" />
                Approved
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onToggleFullPage && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleFullPage}
                title={isFullPage ? 'Exit full page' : 'Full page'}
              >
                {isFullPage ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open(mr.web_url, '_blank')}
              title="Open in GitLab"
            >
              <ExternalLink size={18} />
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X size={18} />
              </Button>
            )}
          </div>
        </div>
        <h2 className="mt-2 text-base font-semibold text-zinc-100 leading-snug">{mr.title}</h2>
      </div>

      {/* Tab switcher — right after header */}
      <div className="shrink-0 border-b border-white/[0.05] px-5">
        <div className="flex gap-2 -mb-px">
          <TabButton active={tab === 'discussion'} onClick={() => setTab('discussion')}>
            <MessageCircle size={16} />
            Discussion ({userNotes.length})
          </TabButton>
          <TabButton active={tab === 'changes'} onClick={() => setTab('changes')}>
            <FileCode size={16} />
            Changes ({changes.length})
          </TabButton>
          <TabButton active={tab === 'ai-review'} onClick={() => setTab('ai-review')}>
            <Bot size={16} />
            AI Review
          </TabButton>
        </div>
      </div>

      {/* Scrollable content */}
      <div className={`flex-1 ${tab === 'changes' || tab === 'ai-review' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {/* Discussion tab */}
        {tab === 'discussion' && (
          <>
            {/* Description */}
            {mr.description && (
              <div className="border-b border-white/[0.05] px-5 py-5">
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-5 text-base text-zinc-300 leading-relaxed overflow-hidden">
                  <MarkdownContent raw gitlabBaseUrl={gitlabBaseUrl} gitlabProjectId={projectId}>{mr.description}</MarkdownContent>
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="border-b border-white/[0.05] px-5 py-5">
              <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                <MetaField icon={<User size={16} />} label="Author">
                  <div className="flex items-center gap-3">
                    {mr.author.avatar_url ? (
                      <img src={mr.author.avatar_url} alt="" className="h-7 w-7 rounded-full" />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-semibold text-indigo-400">
                        {mr.author.name.charAt(0)}
                      </div>
                    )}
                    <span>{mr.author.name}</span>
                  </div>
                </MetaField>

                <MetaField icon={<GitBranch size={16} />} label="Branches">
                  <div className="flex items-center gap-2 text-sm">
                    <code className="rounded bg-white/[0.06] px-2 py-0.5 font-mono text-zinc-400">{mr.source_branch}</code>
                    <ArrowRight size={14} className="text-zinc-600" />
                    <code className="rounded bg-white/[0.06] px-2 py-0.5 font-mono text-zinc-400">{mr.target_branch}</code>
                  </div>
                </MetaField>

                {mr.reviewers.length > 0 && (
                  <MetaField icon={<User size={16} />} label="Reviewers">
                    <div className="flex flex-wrap gap-2">
                      {mr.reviewers.map((r) => (
                        <div key={r.id} className="flex items-center gap-2">
                          {r.avatar_url ? (
                            <img src={r.avatar_url} alt="" className="h-4 w-4 rounded-full" />
                          ) : (
                            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-700 text-xs font-semibold text-zinc-300">
                              {r.name.charAt(0)}
                            </div>
                          )}
                          <span className="text-sm">{r.name}</span>
                        </div>
                      ))}
                    </div>
                  </MetaField>
                )}

                {approvals && (
                  <MetaField icon={<Shield size={16} />} label="Approvals">
                    <div className="flex items-center gap-3">
                      <span>{approvals.approved_by.length}/{approvals.approvals_required}</span>
                      {approvals.approved_by.map((a) => (
                        <Badge key={a.user.id} variant="success" className="text-xs">
                          <Check size={14} className="mr-0.5" />
                          {a.user.name}
                        </Badge>
                      ))}
                    </div>
                  </MetaField>
                )}

                <MetaField icon={<Clock size={16} />} label="Updated">
                  {relativeTime(mr.updated_at)}
                </MetaField>

                {mr.labels.length > 0 && (
                  <div className="col-span-2">
                    <MetaField icon={<Tag size={16} />} label="Labels">
                      <div className="flex flex-wrap gap-2">
                        {mr.labels.map((l) => (
                          <Badge key={l} variant="default">{l}</Badge>
                        ))}
                      </div>
                    </MetaField>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="px-5 py-5">
              {userNotes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/[0.08] py-6 text-center">
                  <MessageCircle size={20} className="mx-auto mb-2 text-zinc-700" />
                  <p className="text-sm text-zinc-500">No comments yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {userNotes.map((note) => (
                    <NoteItem
                      key={note.id}
                      note={note}
                      changes={changes}
                      gitlabBaseUrl={gitlabBaseUrl}
                      projectId={projectId}
                      onEdit={handleEditNote}
                      onDelete={handleDeleteNote}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Changes tab */}
        {tab === 'changes' && (
          <div className="h-full">
            {changes.length > 0 ? (
              <ResizablePanelGroup orientation="horizontal" className="h-full">
                <ResizablePanel defaultSize="20%" minSize="150px" maxSize="40%">
                  <div className="overflow-y-auto h-full p-4">
                    <FileTree
                      changes={changes}
                      selectedFile={selectedFile}
                      onSelectFile={setSelectedFile}
                    />
                  </div>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize="80%" minSize="300px">
                  <div ref={diffPanelRef} className="overflow-y-auto h-full px-5 pb-4">
                    <DiffViewer
                      changes={changes}
                      selectedFile={selectedFile}
                      projectId={projectId}
                      mrIid={mr.iid}
                      notes={userNotes}
                      diffRefs={diffRefs}
                      reviewItems={reviewItems}
                    />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : (
              <p className="px-5 py-5 text-base text-zinc-500">No changes to display</p>
            )}
          </div>
        )}

        {/* AI Review tab */}
        {tab === 'ai-review' && (
          <div className="px-5 py-5 h-full overflow-hidden">
            <AIReviewPanel
              projectId={projectId}
              mrIid={mr.iid}
              mrWebUrl={mr.web_url}
              headSha={diffRefs?.head_sha}
            />
          </div>
        )}
      </div>

      {/* Comment input — pinned at bottom */}
      {tab === 'discussion' && (
        <div className="shrink-0 border-t border-white/[0.08] px-5 py-4">
          <div className="flex gap-3">
            <Input
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Write a comment..."
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddNote()}
              className="text-base"
            />
            <Button
              size="icon"
              onClick={handleAddNote}
              disabled={!noteBody.trim() || addNote.isPending}
            >
              <Send size={18} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

interface DiffCodeLine {
  type: 'add' | 'del' | 'context'
  content: string
}

function NoteItem({
  note,
  changes,
  gitlabBaseUrl,
  projectId,
  onEdit,
  onDelete,
}: {
  note: GitLabNote
  changes: GitLabMRChange[]
  gitlabBaseUrl: string
  projectId: number
  onEdit: (noteId: number, body: string) => Promise<void>
  onDelete: (noteId: number) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(note.body)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Resolved notes start collapsed
  const [collapsed, setCollapsed] = useState(!!note.resolved)

  const position = note.position
  const codeLines = useMemo(
    () => (position ? extractDiffLines(position, changes) : []),
    [position, changes]
  )

  const handleSaveEdit = async () => {
    if (!editBody.trim()) return
    await onEdit(note.id, editBody)
    setEditing(false)
  }

  const handleConfirmDelete = async () => {
    await onDelete(note.id)
    setConfirmDelete(false)
  }

  // Resolved notes — collapsed view
  if (note.resolved && collapsed) {
    return (
      <div
        className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-3 py-2 cursor-pointer hover:bg-white/[0.05] transition-colors"
        onClick={() => setCollapsed(false)}
      >
        <ChevronRight size={16} className="text-zinc-600 shrink-0" />
        {note.author.avatar_url ? (
          <img src={note.author.avatar_url} alt="" className="h-[18px] w-[18px] shrink-0 rounded-full" />
        ) : (
          <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-zinc-300">
            {note.author.name.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-sm text-zinc-500 truncate">
          <span className="font-medium text-zinc-400">{note.author.name}</span>
          {' — '}
          {note.body.slice(0, 80)}{note.body.length > 80 ? '...' : ''}
        </span>
        <Badge variant="success" className="text-xs ml-auto shrink-0">
          <Check size={14} className="mr-0.5" />
          Resolved
        </Badge>
      </div>
    )
  }

  return (
    <div className="group relative">
      <div className="flex gap-3">
        {/* Avatar */}
        {note.author.avatar_url ? (
          <img src={note.author.avatar_url} alt="" className="h-9 w-9 shrink-0 rounded-full" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-sm font-semibold text-zinc-300">
            {note.author.name.charAt(0).toUpperCase()}
          </div>
        )}
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-zinc-200">
              {note.author.name}
            </span>
            <span className="text-sm text-zinc-600" title={formatDate(note.created_at)}>
              {relativeTime(note.created_at)}
            </span>
            {note.resolved && (
              <button
                onClick={() => setCollapsed(true)}
                className="ml-auto"
                title="Collapse resolved thread"
              >
                <Badge variant="success" className="text-xs cursor-pointer hover:opacity-80">
                  <Check size={14} className="mr-0.5" />
                  Resolved
                </Badge>
              </button>
            )}
            {/* Edit/Delete buttons */}
            <div className={`${note.resolved ? '' : 'ml-auto'} flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity`}>
              <button
                onClick={() => { setEditing(true); setEditBody(note.body) }}
                className="rounded p-1 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]"
                title="Edit"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded p-1 text-zinc-500 hover:text-red-400 hover:bg-white/[0.06]"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Inline code context for diff notes — with diff coloring */}
          {position && codeLines.length > 0 && (
            <div className="mt-1 rounded border border-white/[0.08] bg-white/[0.04] text-sm overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2 border-b border-white/[0.08] bg-white/[0.04]">
                <FileCode size={14} className="text-zinc-500" />
                <span className="font-mono text-zinc-400">
                  {position.new_path}
                  {position.new_line && `:${position.new_line}`}
                </span>
              </div>
              <div className="overflow-x-auto">
                {codeLines.map((line, i) => (
                  <div
                    key={i}
                    className={`px-3 py-0 font-mono text-sm whitespace-pre ${
                      line.type === 'add'
                        ? 'bg-green-950/30 text-green-300'
                        : line.type === 'del'
                          ? 'bg-red-950/30 text-red-300'
                          : 'text-zinc-400'
                    }`}
                  >
                    <span className="select-none text-zinc-600 mr-1 inline-block w-3 text-right">
                      {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                    </span>
                    {line.content}
                  </div>
                ))}
              </div>
            </div>
          )}

          {editing ? (
            <div className="mt-1 space-y-2">
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2 text-base text-zinc-200 focus:border-indigo-500 focus:outline-none resize-y min-h-[60px]"
                rows={3}
              />
              <div className="flex gap-3">
                <Button size="sm" onClick={handleSaveEdit} disabled={!editBody.trim()}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-1 rounded-lg rounded-tl-none bg-white/[0.05] px-3 py-2 text-base text-zinc-300 leading-relaxed overflow-hidden">
              <MarkdownContent raw gitlabBaseUrl={gitlabBaseUrl} gitlabProjectId={projectId}>{note.body}</MarkdownContent>
            </div>
          )}

          {/* Delete confirmation */}
          {confirmDelete && (
            <div className="mt-2 flex items-center gap-3 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2">
              <span className="text-sm text-red-400">Delete this comment?</span>
              <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 h-8 text-sm" onClick={handleConfirmDelete}>
                Delete
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Extracts diff lines around the target position, preserving +/- type info.
 */
function extractDiffLines(
  position: { new_path: string; old_path: string; new_line: number | null; old_line: number | null },
  changes: GitLabMRChange[]
): DiffCodeLine[] {
  const file = changes.find((c) => c.new_path === position.new_path)
  if (!file?.diff) return []

  const targetLine = position.new_line ?? position.old_line
  if (!targetLine) return []

  const rawLines = file.diff.split('\n')
  let newLine = 0
  let oldLine = 0
  const result: DiffCodeLine[] = []
  const contextRadius = 2

  for (const raw of rawLines) {
    const hunkMatch = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10)
      newLine = parseInt(hunkMatch[2], 10)
      continue
    }

    let type: 'add' | 'del' | 'context'
    let currentNew = newLine
    let currentOld = oldLine

    if (raw.startsWith('+')) {
      type = 'add'
      newLine++
    } else if (raw.startsWith('-')) {
      type = 'del'
      oldLine++
    } else if (raw.startsWith(' ') || raw === '') {
      type = 'context'
      newLine++
      oldLine++
    } else {
      continue
    }

    const isNearTarget =
      (position.new_line && type !== 'del' && Math.abs(currentNew - position.new_line) <= contextRadius) ||
      (position.old_line && type !== 'add' && Math.abs(currentOld - position.old_line) <= contextRadius)

    if (isNearTarget) {
      result.push({ type, content: raw.slice(1) })
    }
  }

  return result
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 ${
        active
          ? 'border-indigo-500 text-zinc-100'
          : 'border-transparent text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {children}
    </button>
  )
}

function MetaField({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-zinc-500">
        {icon}
        {label}
      </div>
      <div className="text-base text-zinc-300">{children}</div>
    </div>
  )
}
