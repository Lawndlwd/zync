import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { DiffComment } from './diff-comment'
import { MarkdownContent } from '@/components/ui/markdown'
import { useSettingsStore } from '@/store/settings'
import { useSubmitReview } from '@/hooks/useGitlab'
import type { GitLabMRChange, GitLabNote, GitLabDiffRefs, PendingComment, PRAgentItem } from '@/types/gitlab'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/lib/utils'
import { highlightLines, THEMES } from '@/lib/syntax-highlight'
import type { BundledTheme } from 'shiki'
import { AlertCircle, AlertTriangle, ChevronDown, ChevronRight, Info, Lightbulb, MessageSquare, Palette, Send, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'

interface DiffViewerProps {
  changes: GitLabMRChange[]
  selectedFile: string | null
  projectId: number
  mrIid: number
  notes?: GitLabNote[]
  diffRefs?: GitLabDiffRefs
  reviewItems?: PRAgentItem[]
}

interface DiffHunk {
  header: string
  oldStart: number
  newStart: number
  lines: DiffLine[]
}

interface DiffLine {
  type: 'add' | 'del' | 'context' | 'header'
  content: string
  oldLine: number | null
  newLine: number | null
}

interface Selection {
  startLine: number
  endLine: number
  lineType: 'new' | 'old'
  oldLine: number | null
  newLine: number | null
  selecting: boolean
}

function parseDiff(diffText: string): DiffHunk[] {
  const hunks: DiffHunk[] = []
  const lines = diffText.split('\n')
  let currentHunk: DiffHunk | null = null
  let oldLine = 0
  let newLine = 0

  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/)
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10)
      newLine = parseInt(hunkMatch[2], 10)
      currentHunk = {
        header: line,
        oldStart: oldLine,
        newStart: newLine,
        lines: [{ type: 'header', content: hunkMatch[3] || '', oldLine: null, newLine: null }],
      }
      hunks.push(currentHunk)
      continue
    }

    if (!currentHunk) continue

    if (line.startsWith('+')) {
      currentHunk.lines.push({ type: 'add', content: line.slice(1), oldLine: null, newLine: newLine++ })
    } else if (line.startsWith('-')) {
      currentHunk.lines.push({ type: 'del', content: line.slice(1), oldLine: oldLine++, newLine: null })
    } else if (line.startsWith(' ') || line === '') {
      currentHunk.lines.push({ type: 'context', content: line.slice(1), oldLine: oldLine++, newLine: newLine++ })
    }
  }

  return hunks
}

function useHighlightedDiff(hunks: DiffHunk[], filePath: string, theme: BundledTheme) {
  const [highlighted, setHighlighted] = useState<Map<number, string>>(new Map())

  useEffect(() => {
    const allLines: { idx: number; content: string }[] = []
    let idx = 0
    for (const hunk of hunks) {
      for (const line of hunk.lines) {
        if (line.type !== 'header') {
          allLines.push({ idx, content: line.content })
        }
        idx++
      }
    }

    if (allLines.length === 0) return

    highlightLines(
      allLines.map((l) => l.content),
      filePath,
      theme
    ).then((htmlLines) => {
      const map = new Map<number, string>()
      allLines.forEach((l, i) => map.set(l.idx, htmlLines[i]))
      setHighlighted(map)
    })
  }, [hunks, filePath, theme])

  return highlighted
}

function InlineNote({ note, projectId }: { note: GitLabNote; projectId: number }) {
  const gitlabBaseUrl = useSettingsStore((s) => s.settings.gitlab.baseUrl)

  return (
    <tr className="bg-indigo-950/20">
      <td colSpan={3} className="px-3 py-2">
        <div className="flex gap-2 items-start">
          {note.author.avatar_url ? (
            <img src={note.author.avatar_url} alt="" className="h-5 w-5 shrink-0 rounded-full mt-0.5" />
          ) : (
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[9px] font-semibold text-zinc-300 mt-0.5">
              {note.author.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-semibold text-zinc-300">{note.author.name}</span>
              <span className="text-[10px] text-zinc-600">{relativeTime(note.created_at)}</span>
            </div>
            <div className="mt-0.5 text-xs text-zinc-400 leading-relaxed">
              <MarkdownContent raw gitlabBaseUrl={gitlabBaseUrl} gitlabProjectId={projectId}>{note.body}</MarkdownContent>
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}

function PendingBadge({ comment, onRemove }: { comment: PendingComment; onRemove: () => void }) {
  const rangeLabel = comment.startLine === comment.endLine
    ? `L${comment.endLine}`
    : `L${comment.startLine}-${comment.endLine}`

  return (
    <tr className="bg-amber-950/20">
      <td colSpan={3} className="px-3 py-2">
        <div className="flex items-start gap-2">
          <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
            Pending
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] text-zinc-500 font-mono">{rangeLabel}</span>
            <p className="text-xs text-zinc-300 mt-0.5 whitespace-pre-wrap">{comment.body}</p>
          </div>
          <button
            onClick={onRemove}
            className="shrink-0 rounded p-1 text-zinc-500 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
            title="Remove pending comment"
          >
            <X size={12} />
          </button>
        </div>
      </td>
    </tr>
  )
}

const INLINE_SEVERITY = {
  critical: { icon: AlertCircle, bg: 'bg-red-950/20', color: 'text-red-400', badge: 'bg-red-500/20 text-red-400' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-950/20', color: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-400' },
  suggestion: { icon: Lightbulb, bg: 'bg-blue-950/20', color: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-400' },
  info: { icon: Info, bg: 'bg-white/[0.05]', color: 'text-zinc-400', badge: 'bg-zinc-500/20 text-zinc-400' },
}

function InlineReviewItem({ item }: { item: PRAgentItem }) {
  const config = INLINE_SEVERITY[item.severity]
  const Icon = config.icon

  return (
    <tr className={config.bg}>
      <td colSpan={3} className="px-3 py-2">
        <div className="flex gap-2 items-start">
          <Icon size={14} className={`mt-0.5 shrink-0 ${config.color}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-zinc-200">{item.title}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${config.badge}`}>
                {item.severity}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-zinc-400 leading-relaxed">
              <MarkdownContent>{item.body}</MarkdownContent>
            </div>
            {item.suggestion && (
              <pre className="mt-1 p-2 rounded bg-white/[0.04] border border-white/[0.08] text-[11px] text-zinc-300 overflow-x-auto">
                {item.suggestion}
              </pre>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}

function FileDiff({
  change,
  projectId,
  fileNotes,
  theme,
  pendingComments,
  onAddPending,
  onRemovePending,
  isActiveFile,
  onActivate,
  isSelected,
  fileReviewItems,
}: {
  change: GitLabMRChange
  projectId: number
  fileNotes: GitLabNote[]
  theme: BundledTheme
  pendingComments: PendingComment[]
  onAddPending: (comment: PendingComment) => void
  onRemovePending: (id: string) => void
  isActiveFile: boolean
  onActivate: () => void
  isSelected: boolean
  fileReviewItems: PRAgentItem[]
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [showComment, setShowComment] = useState(false)

  // Clear selection when another file becomes active
  useEffect(() => {
    if (!isActiveFile) {
      setSelection(null)
      setShowComment(false)
    }
  }, [isActiveFile])
  const hunks = useMemo(() => parseDiff(change.diff), [change.diff])
  const highlighted = useHighlightedDiff(hunks, change.new_path, theme)

  // Index notes by new_line for quick lookup
  const notesByLine = useMemo(() => {
    const map = new Map<number, GitLabNote[]>()
    for (const note of fileNotes) {
      const line = note.position?.new_line ?? note.position?.old_line
      if (line) {
        const existing = map.get(line) ?? []
        existing.push(note)
        map.set(line, existing)
      }
    }
    return map
  }, [fileNotes])

  // Index pending comments by endLine for display
  const pendingByEndLine = useMemo(() => {
    const map = new Map<number, PendingComment[]>()
    for (const pc of pendingComments) {
      const existing = map.get(pc.endLine) ?? []
      existing.push(pc)
      map.set(pc.endLine, existing)
    }
    return map
  }, [pendingComments])

  // Index review items by line
  const reviewByLine = useMemo(() => {
    const map = new Map<number, PRAgentItem[]>()
    for (const item of fileReviewItems) {
      if (item.line != null) {
        const existing = map.get(item.line) ?? []
        existing.push(item)
        map.set(item.line, existing)
      }
    }
    return map
  }, [fileReviewItems])

  const handleMouseDown = useCallback((lineNum: number, oldLine: number | null, newLine: number | null) => {
    onActivate()
    setShowComment(false)
    setSelection({
      startLine: lineNum,
      endLine: lineNum,
      lineType: 'new',
      oldLine,
      newLine,
      selecting: true,
    })
  }, [onActivate])

  const handleMouseEnter = useCallback((lineNum: number) => {
    setSelection((prev) => {
      if (!prev || !prev.selecting) return prev
      return { ...prev, endLine: lineNum }
    })
  }, [])

  // Finalize selection on mouseup
  useEffect(() => {
    const handleMouseUp = () => {
      setSelection((prev) => {
        if (!prev || !prev.selecting) return prev
        // Normalize: ensure start <= end
        const start = Math.min(prev.startLine, prev.endLine)
        const end = Math.max(prev.startLine, prev.endLine)
        setShowComment(true)
        return { ...prev, startLine: start, endLine: end, selecting: false }
      })
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])

  const isLineSelected = useCallback(
    (lineNum: number) => {
      if (!selection) return false
      const start = Math.min(selection.startLine, selection.endLine)
      const end = Math.max(selection.startLine, selection.endLine)
      return lineNum >= start && lineNum <= end
    },
    [selection]
  )

  const handleAddComment = useCallback(
    (comment: PendingComment) => {
      onAddPending(comment)
      setSelection(null)
      setShowComment(false)
    },
    [onAddPending]
  )

  const handleCloseComment = useCallback(() => {
    setSelection(null)
    setShowComment(false)
  }, [])

  let globalIdx = 0

  return (
    <div className={cn(
      'mb-4 rounded-lg border transition-colors',
      isSelected ? 'border-indigo-500/60 ring-1 ring-indigo-500/20' : 'border-white/[0.08]'
    )}>
      {/* File header - sticky while scrolling through this file's diff */}
      <button
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-mono text-zinc-300 hover:bg-white/[0.06] sticky top-0 z-10 rounded-t-lg border-b border-white/[0.08]',
          isSelected ? 'bg-indigo-950/30' : 'bg-white/[0.04]'
        )}
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        {change.renamed_file ? (
          <span>
            <span className="text-zinc-500">{change.old_path}</span>
            <span className="text-zinc-600 mx-1">&rarr;</span>
            <span>{change.new_path}</span>
          </span>
        ) : (
          <span>{change.new_path}</span>
        )}
        {change.new_file && <span className="ml-2 text-green-400">(new)</span>}
        {change.deleted_file && <span className="ml-2 text-red-400">(deleted)</span>}
        <span className="ml-auto flex items-center gap-2">
          {fileNotes.length > 0 && (
            <span className="flex items-center gap-1 text-indigo-400">
              <MessageSquare size={11} />
              {fileNotes.length}
            </span>
          )}
          {pendingComments.length > 0 && (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
              {pendingComments.length} pending
            </span>
          )}
        </span>
      </button>

      {!collapsed && (
        <div className="overflow-hidden">
          <table className="w-full text-xs font-mono">
            <tbody>
              {hunks.map((hunk, hi) =>
                hunk.lines.map((line, li) => {
                  if (line.type === 'header') {
                    globalIdx++
                    return (
                      <tr key={`${hi}-${li}`} className="bg-white/[0.03]">
                        <td colSpan={3} className="px-3 py-1 text-zinc-600">
                          {hunk.header}
                        </td>
                      </tr>
                    )
                  }

                  const currentIdx = globalIdx++
                  const html = highlighted.get(currentIdx)
                  const lineNotes = line.newLine ? notesByLine.get(line.newLine) ?? [] : []
                  const linePending = line.newLine ? pendingByEndLine.get(line.newLine) ?? [] : []
                  const lineReview = line.newLine ? reviewByLine.get(line.newLine) ?? [] : []
                  const selected = line.newLine ? isLineSelected(line.newLine) : false

                  return [
                    <tr
                      key={`${hi}-${li}`}
                      className={cn(
                        'group',
                        line.type === 'add' && !selected && 'bg-green-950/20',
                        line.type === 'del' && !selected && 'bg-red-950/20',
                        selected && 'bg-indigo-950/30'
                      )}
                    >
                      <td className="w-12 select-none border-r border-white/[0.08] px-2 text-right text-zinc-600">
                        {line.oldLine ?? ''}
                      </td>
                      <td
                        className="w-12 select-none border-r border-white/[0.08] px-2 text-right text-zinc-600 cursor-pointer"
                        onMouseDown={(e) => {
                          if (line.newLine) {
                            e.preventDefault()
                            handleMouseDown(line.newLine, line.oldLine, line.newLine)
                          }
                        }}
                        onMouseEnter={() => {
                          if (line.newLine) handleMouseEnter(line.newLine)
                        }}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {line.newLine && (
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <MessageSquare size={10} className="text-indigo-400" />
                            </span>
                          )}
                          {line.newLine ?? ''}
                        </div>
                      </td>
                      <td
                        className={cn(
                          'whitespace-pre-wrap break-words px-3 py-0.5',
                          line.type === 'add' && !html && 'text-green-300',
                          line.type === 'del' && !html && 'text-red-300',
                          line.type === 'context' && !html && 'text-zinc-400'
                        )}
                      >
                        <span className="mr-2 select-none text-zinc-600">
                          {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                        </span>
                        {html ? (
                          <span
                            className={cn(
                              line.type === 'add' && '[&_span]:!opacity-90',
                              line.type === 'del' && '[&_span]:!opacity-60'
                            )}
                            dangerouslySetInnerHTML={{ __html: html }}
                          />
                        ) : (
                          line.content
                        )}
                      </td>
                    </tr>,
                    // Render inline notes after matching line
                    ...lineNotes.map((note) => (
                      <InlineNote key={`note-${note.id}`} note={note} projectId={projectId} />
                    )),
                    // Render pending comment badges
                    ...linePending.map((pc) => (
                      <PendingBadge key={`pending-${pc.id}`} comment={pc} onRemove={() => onRemovePending(pc.id)} />
                    )),
                    // Render PR-Agent review items
                    ...lineReview.map((ri, idx) => (
                      <InlineReviewItem key={`review-${line.newLine}-${idx}`} item={ri} />
                    )),
                    // Render comment form after selection ends
                    ...(showComment && selection && !selection.selecting && selection.endLine === line.newLine
                      ? [
                          <DiffComment
                            key="comment-form"
                            filePath={change.new_path}
                            oldPath={change.old_path}
                            startLine={selection.startLine}
                            endLine={selection.endLine}
                            lineType={selection.lineType}
                            oldLine={selection.oldLine}
                            newLine={selection.newLine}
                            onAdd={handleAddComment}
                            onClose={handleCloseComment}
                          />,
                        ]
                      : []),
                  ]
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function DiffViewer({ changes, selectedFile, projectId, mrIid, notes = [], diffRefs, reviewItems = [] }: DiffViewerProps) {
  const [theme, setThemeState] = useState<BundledTheme>(
    () => (localStorage.getItem('diff-theme') as BundledTheme) || 'github-dark'
  )
  const setTheme = (t: BundledTheme) => {
    setThemeState(t)
    localStorage.setItem('diff-theme', t)
  }
  const [pendingComments, setPendingComments] = useState<PendingComment[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const submitReview = useSubmitReview()

  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Scroll to selected file
  useEffect(() => {
    if (!selectedFile) return
    const el = fileRefs.current.get(selectedFile)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedFile])

  // Filter to only diff notes (those with position data)
  const diffNotes = useMemo(
    () => notes.filter((n) => n.position && !n.system),
    [notes]
  )

  const handleAddPending = useCallback((comment: PendingComment) => {
    setPendingComments((prev) => [...prev, comment])
  }, [])

  const handleRemovePending = useCallback((id: string) => {
    setPendingComments((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const handleDiscardAll = useCallback(() => {
    setPendingComments([])
  }, [])

  const handleSubmitReview = useCallback(async () => {
    if (!diffRefs || pendingComments.length === 0) return
    try {
      await submitReview.mutateAsync({
        projectId,
        iid: mrIid,
        comments: pendingComments,
        diffRefs,
      })
      setPendingComments([])
      toast.success(`${pendingComments.length} comment(s) submitted as discussions`)
    } catch {
      toast.error('Failed to submit review')
    }
  }, [diffRefs, pendingComments, projectId, mrIid, submitReview])

  return (
    <div className="relative">
      {/* Theme picker */}
      <div className="flex items-center justify-end gap-2 mb-2 pt-4">
        <Palette size={13} className="text-zinc-500" />
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as BundledTheme)}
          className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-zinc-300 outline-none focus:border-zinc-600"
        >
          {THEMES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {changes.map((change) => {
        const fileNotes = diffNotes.filter(
          (n) => n.position?.new_path === change.new_path
        )
        const filePending = pendingComments.filter(
          (c) => c.filePath === change.new_path
        )
        const fileReview = reviewItems.filter(
          (i) => i.file === change.new_path
        )
        return (
          <div
            key={change.new_path}
            ref={(el) => {
              if (el) fileRefs.current.set(change.new_path, el)
              else fileRefs.current.delete(change.new_path)
            }}
          >
          <FileDiff
            change={change}
            projectId={projectId}
            fileNotes={fileNotes}
            theme={theme}
            pendingComments={filePending}
            onAddPending={handleAddPending}
            onRemovePending={handleRemovePending}
            isActiveFile={activeFile === change.new_path}
            onActivate={() => setActiveFile(change.new_path)}
            isSelected={selectedFile === change.new_path}
            fileReviewItems={fileReview}
          />
          </div>
        )
      })}

      {/* Submit Review bar */}
      {pendingComments.length > 0 && (
        <div className="sticky bottom-0 z-10 mt-4 flex items-center justify-between rounded-lg border border-amber-500/30 bg-white/[0.04] backdrop-blur px-4 py-3">
          <span className="text-sm text-zinc-300">
            <span className="font-semibold text-amber-400">{pendingComments.length}</span>
            {' '}pending comment{pendingComments.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleDiscardAll}>
              <Trash2 size={14} className="mr-1.5" />
              Discard all
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitReview}
              disabled={submitReview.isPending || !diffRefs}
            >
              <Send size={14} className="mr-1.5" />
              {submitReview.isPending ? 'Submitting...' : 'Submit Review'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
