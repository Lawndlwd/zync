import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-react'
import type { PendingComment } from '@/types/gitlab'

interface DiffCommentProps {
  filePath: string
  oldPath: string
  startLine: number
  endLine: number
  lineType: 'new' | 'old'
  oldLine: number | null
  newLine: number | null
  onAdd: (comment: PendingComment) => void
  onClose: () => void
}

export function DiffComment({
  filePath,
  oldPath,
  startLine,
  endLine,
  lineType,
  oldLine,
  newLine,
  onAdd,
  onClose,
}: DiffCommentProps) {
  const [body, setBody] = useState('')

  const rangeLabel = startLine === endLine
    ? `${filePath}:${endLine}`
    : `${filePath}:${startLine}-${endLine}`

  const handleSubmit = () => {
    if (!body.trim()) return
    onAdd({
      id: crypto.randomUUID(),
      filePath,
      oldPath,
      body: body.trim(),
      lineType,
      startLine,
      endLine,
      oldLine,
      newLine,
    })
    onClose()
  }

  return (
    <tr className="bg-white/[0.03]">
      <td colSpan={3} className="p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-sm text-zinc-500 min-w-0 truncate">
            Comment on <code className="text-indigo-400" title={rangeLabel}>{rangeLabel}</code>
          </span>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 shrink-0">
            <X size={18} />
          </Button>
        </div>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a comment..."
          rows={2}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
          }}
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={handleSubmit} disabled={!body.trim()}>
            <Plus size={18} className="mr-2" />
            Add comment
          </Button>
        </div>
      </td>
    </tr>
  )
}
