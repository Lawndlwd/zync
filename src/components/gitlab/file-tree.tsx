import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { GitLabMRChange } from '@/types/gitlab'
import {
  File, FilePlus, FileMinus, FileEdit, ArrowRight,
  FolderOpen, FolderClosed, ChevronRight, List, FolderTree,
} from 'lucide-react'

interface FileTreeProps {
  changes: GitLabMRChange[]
  selectedFile: string | null
  onSelectFile: (file: string | null) => void
}

function getFileIcon(change: GitLabMRChange) {
  if (change.new_file) return <FilePlus size={16} className="text-green-400 shrink-0" />
  if (change.deleted_file) return <FileMinus size={16} className="text-red-400 shrink-0" />
  if (change.renamed_file) return <ArrowRight size={16} className="text-blue-400 shrink-0" />
  return <FileEdit size={16} className="text-yellow-400 shrink-0" />
}

function getFileName(path: string) {
  return path.split('/').pop() || path
}

function countDiffStats(diff: string) {
  const lines = diff.split('\n')
  let additions = 0
  let deletions = 0
  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions++
    if (line.startsWith('-') && !line.startsWith('---')) deletions++
  }
  return { additions, deletions }
}

interface TreeNode {
  name: string
  path: string
  change?: GitLabMRChange
  children: Map<string, TreeNode>
}

function buildTree(changes: GitLabMRChange[]): TreeNode {
  const root: TreeNode = { name: '', path: '', children: new Map() }
  for (const change of changes) {
    const parts = change.new_path.split('/')
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          children: new Map(),
        })
      }
      current = current.children.get(part)!
    }
    current.change = change
  }
  return root
}

// Collapse single-child folders (e.g. src/components → src/components)
function collapseTree(node: TreeNode): TreeNode {
  const collapsed: Map<string, TreeNode> = new Map()
  for (const [, child] of node.children) {
    let current = child
    let label = current.name
    while (current.children.size === 1 && !current.change) {
      const [, only] = [...current.children.entries()][0]
      label += '/' + only.name
      current = only
    }
    const collapsedChild: TreeNode = {
      name: label,
      path: current.path,
      change: current.change,
      children: current.children,
    }
    // Recurse into children
    if (collapsedChild.children.size > 0 && !collapsedChild.change) {
      const recursed = collapseTree(collapsedChild)
      collapsedChild.children = recursed.children
    }
    collapsed.set(label, collapsedChild)
  }
  return { ...node, children: collapsed }
}

function sortEntries(children: Map<string, TreeNode>) {
  return [...children.entries()].sort(([, a], [, b]) => {
    const aIsDir = a.children.size > 0 && !a.change
    const bIsDir = b.children.size > 0 && !b.change
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

// Group changes by folder for list view
function groupByFolder(changes: GitLabMRChange[]) {
  const groups = new Map<string, GitLabMRChange[]>()
  for (const change of changes) {
    const parts = change.new_path.split('/')
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '/'
    if (!groups.has(dir)) groups.set(dir, [])
    groups.get(dir)!.push(change)
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
}

function FileButton({
  change,
  selected,
  onClick,
  indent = 0,
}: {
  change: GitLabMRChange
  selected: boolean
  onClick: () => void
  indent?: number
}) {
  const stats = countDiffStats(change.diff)
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
        selected
          ? 'bg-white/[0.06] text-zinc-100'
          : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-300'
      )}
      style={{ paddingLeft: `${8 + indent * 12}px` }}
      onClick={onClick}
      title={change.new_path}
    >
      {getFileIcon(change)}
      <span className="min-w-0 flex-1 truncate font-medium">
        {getFileName(change.new_path)}
      </span>
      <span className="shrink-0 text-xs">
        <span className="text-green-400">+{stats.additions}</span>{' '}
        <span className="text-red-400">-{stats.deletions}</span>
      </span>
    </button>
  )
}

function TreeFolder({
  node,
  selectedFile,
  onSelectFile,
  depth,
}: {
  node: TreeNode
  selectedFile: string | null
  onSelectFile: (file: string | null) => void
  depth: number
}) {
  const [open, setOpen] = useState(true)
  const entries = sortEntries(node.children)

  return (
    <div>
      <button
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-300 transition-colors"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => setOpen(!open)}
      >
        <ChevronRight
          size={16}
          className={cn('shrink-0 text-zinc-600 transition-transform', open && 'rotate-90')}
        />
        {open ? (
          <FolderOpen size={16} className="text-indigo-400 shrink-0" />
        ) : (
          <FolderClosed size={16} className="text-indigo-400 shrink-0" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {open && (
        <div>
          {entries.map(([key, child]) => {
            if (child.change && child.children.size === 0) {
              return (
                <FileButton
                  key={key}
                  change={child.change}
                  selected={selectedFile === child.change.new_path}
                  onClick={() => onSelectFile(child.change!.new_path)}
                  indent={depth + 1}
                />
              )
            }
            return (
              <TreeFolder
                key={key}
                node={child}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
                depth={depth + 1}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export function FileTree({ changes, selectedFile, onSelectFile }: FileTreeProps) {
  const [mode, setMode] = useState<'tree' | 'list'>('tree')

  const totalStats = useMemo(
    () =>
      changes.reduce(
        (acc, c) => {
          const s = countDiffStats(c.diff)
          return { additions: acc.additions + s.additions, deletions: acc.deletions + s.deletions }
        },
        { additions: 0, deletions: 0 }
      ),
    [changes]
  )

  const tree = useMemo(() => collapseTree(buildTree(changes)), [changes])
  const folders = useMemo(() => groupByFolder(changes), [changes])

  return (
    <div className="rounded-lg border border-white/[0.08] bg-black/20">
      <div className="border-b border-white/[0.08] px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-400">{changes.length} files</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-500">
              <span className="text-green-400">+{totalStats.additions}</span>{' '}
              <span className="text-red-400">-{totalStats.deletions}</span>
            </span>
            <div className="flex border border-white/[0.08] rounded">
              <button
                onClick={() => setMode('tree')}
                className={cn(
                  'p-1 transition-colors',
                  mode === 'tree' ? 'bg-white/[0.06] text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
                )}
                title="Tree view"
              >
                <FolderTree size={16} />
              </button>
              <button
                onClick={() => setMode('list')}
                className={cn(
                  'p-1 transition-colors',
                  mode === 'list' ? 'bg-white/[0.06] text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
                )}
                title="List view"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="p-1">
        <button
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
            selectedFile === null
              ? 'bg-white/[0.06] text-zinc-100'
              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-300'
          )}
          onClick={() => onSelectFile(null)}
        >
          <File size={16} className="shrink-0" />
          All files
        </button>

        {mode === 'tree' ? (
          /* Tree view */
          sortEntries(tree.children).map(([key, node]) => {
            if (node.change && node.children.size === 0) {
              return (
                <FileButton
                  key={key}
                  change={node.change}
                  selected={selectedFile === node.change.new_path}
                  onClick={() => onSelectFile(node.change!.new_path)}
                  indent={0}
                />
              )
            }
            return (
              <TreeFolder
                key={key}
                node={node}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
                depth={0}
              />
            )
          })
        ) : (
          /* List view — grouped by folder */
          folders.map(([dir, files]) => (
            <div key={dir}>
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-500 mt-1">
                <FolderOpen size={16} className="text-indigo-400 shrink-0" />
                <span className="truncate">{dir}</span>
              </div>
              {files.map((change) => (
                <FileButton
                  key={change.new_path}
                  change={change}
                  selected={selectedFile === change.new_path}
                  onClick={() => onSelectFile(change.new_path)}
                  indent={1}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
