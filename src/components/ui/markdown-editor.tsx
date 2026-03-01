import { useRef, useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { MarkdownContent } from '@/components/ui/markdown'
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  FileCode,
  Link,
  Minus,
  Table,
  Eye,
  Columns2,
  Pencil,
} from 'lucide-react'

type ViewMode = 'edit' | 'preview' | 'split'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
}

interface ToolbarAction {
  icon: React.ElementType
  label: string
  action: (textarea: HTMLTextAreaElement, value: string) => { newValue: string; cursorPos: number }
}

function wrapSelection(
  textarea: HTMLTextAreaElement,
  value: string,
  before: string,
  after: string
): { newValue: string; cursorPos: number } {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = value.slice(start, end)

  if (selected) {
    const newValue = value.slice(0, start) + before + selected + after + value.slice(end)
    return { newValue, cursorPos: end + before.length + after.length }
  }

  const newValue = value.slice(0, start) + before + after + value.slice(end)
  return { newValue, cursorPos: start + before.length }
}

function insertAtLine(
  textarea: HTMLTextAreaElement,
  value: string,
  prefix: string
): { newValue: string; cursorPos: number } {
  const start = textarea.selectionStart
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const newValue = value.slice(0, lineStart) + prefix + value.slice(lineStart)
  return { newValue, cursorPos: start + prefix.length }
}

function insertBlock(
  textarea: HTMLTextAreaElement,
  value: string,
  block: string,
  cursorOffset: number
): { newValue: string; cursorPos: number } {
  const start = textarea.selectionStart
  const needsNewline = start > 0 && value[start - 1] !== '\n' ? '\n' : ''
  const newValue = value.slice(0, start) + needsNewline + block + value.slice(start)
  return { newValue, cursorPos: start + needsNewline.length + cursorOffset }
}

const TOOLBAR_ACTIONS: (ToolbarAction | 'separator')[] = [
  {
    icon: Bold, label: 'Bold (Ctrl+B)',
    action: (ta, v) => wrapSelection(ta, v, '**', '**'),
  },
  {
    icon: Italic, label: 'Italic (Ctrl+I)',
    action: (ta, v) => wrapSelection(ta, v, '_', '_'),
  },
  {
    icon: Strikethrough, label: 'Strikethrough',
    action: (ta, v) => wrapSelection(ta, v, '~~', '~~'),
  },
  {
    icon: Code, label: 'Inline code',
    action: (ta, v) => wrapSelection(ta, v, '`', '`'),
  },
  'separator',
  {
    icon: Heading1, label: 'Heading 1',
    action: (ta, v) => insertAtLine(ta, v, '# '),
  },
  {
    icon: Heading2, label: 'Heading 2',
    action: (ta, v) => insertAtLine(ta, v, '## '),
  },
  {
    icon: Heading3, label: 'Heading 3',
    action: (ta, v) => insertAtLine(ta, v, '### '),
  },
  'separator',
  {
    icon: List, label: 'Bullet list',
    action: (ta, v) => insertAtLine(ta, v, '- '),
  },
  {
    icon: ListOrdered, label: 'Numbered list',
    action: (ta, v) => insertAtLine(ta, v, '1. '),
  },
  {
    icon: CheckSquare, label: 'Checklist',
    action: (ta, v) => insertAtLine(ta, v, '- [ ] '),
  },
  'separator',
  {
    icon: Quote, label: 'Blockquote',
    action: (ta, v) => insertAtLine(ta, v, '> '),
  },
  {
    icon: FileCode, label: 'Code block',
    action: (ta, v) => insertBlock(ta, v, '```\n\n```\n', 4),
  },
  {
    icon: Link, label: 'Link',
    action: (ta, v) => {
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const selected = v.slice(start, end)
      if (selected) {
        const newValue = v.slice(0, start) + `[${selected}](url)` + v.slice(end)
        return { newValue, cursorPos: end + 3 }
      }
      const newValue = v.slice(0, start) + '[text](url)' + v.slice(end)
      return { newValue, cursorPos: start + 1 }
    },
  },
  {
    icon: Minus, label: 'Horizontal rule',
    action: (ta, v) => insertBlock(ta, v, '---\n', 4),
  },
  {
    icon: Table, label: 'Table',
    action: (ta, v) => insertBlock(ta, v, '| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n', 2),
  },
]

export function MarkdownEditor({ value, onChange, placeholder, className, minHeight = '400px' }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('edit')

  const applyAction = useCallback(
    (action: ToolbarAction) => {
      const textarea = textareaRef.current
      if (!textarea) return
      const { newValue, cursorPos } = action.action(textarea, value)
      onChange(newValue)
      // Restore cursor position after React re-renders
      requestAnimationFrame(() => {
        textarea.focus()
        textarea.setSelectionRange(cursorPos, cursorPos)
      })
    },
    [value, onChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget
      // Ctrl/Cmd + B = Bold
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        const { newValue, cursorPos } = wrapSelection(textarea, value, '**', '**')
        onChange(newValue)
        requestAnimationFrame(() => textarea.setSelectionRange(cursorPos, cursorPos))
      }
      // Ctrl/Cmd + I = Italic
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault()
        const { newValue, cursorPos } = wrapSelection(textarea, value, '_', '_')
        onChange(newValue)
        requestAnimationFrame(() => textarea.setSelectionRange(cursorPos, cursorPos))
      }
      // Tab = indent
      if (e.key === 'Tab') {
        e.preventDefault()
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newValue = value.slice(0, start) + '  ' + value.slice(end)
        onChange(newValue)
        requestAnimationFrame(() => textarea.setSelectionRange(start + 2, start + 2))
      }
    },
    [value, onChange]
  )

  const viewModes: { value: ViewMode; icon: React.ElementType; label: string }[] = [
    { value: 'edit', icon: Pencil, label: 'Edit' },
    { value: 'split', icon: Columns2, label: 'Split' },
    { value: 'preview', icon: Eye, label: 'Preview' },
  ]

  return (
    <div className={cn('rounded-lg border border-white/[0.1] bg-white/[0.04] overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.04] px-2 py-1">
        <div className="flex items-center gap-0.5">
          {TOOLBAR_ACTIONS.map((item, i) => {
            if (item === 'separator') {
              return <div key={i} className="w-px h-4 bg-white/[0.1] mx-1" />
            }
            const Icon = item.icon
            return (
              <button
                key={i}
                type="button"
                onClick={() => applyAction(item)}
                title={item.label}
                className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
              >
                <Icon size={14} />
              </button>
            )
          })}
        </div>

        {/* View mode switcher */}
        <div className="flex items-center bg-white/[0.08] rounded-md p-0.5">
          {viewModes.map(mode => {
            const Icon = mode.icon
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => setViewMode(mode.value)}
                title={mode.label}
                className={cn(
                  'p-1 px-2 rounded text-xs flex items-center gap-1 transition-colors',
                  viewMode === mode.value
                    ? 'bg-white/[0.1] text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                <Icon size={12} />
                <span className="hidden sm:inline">{mode.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content area */}
      <div className={cn('flex', viewMode === 'split' ? 'divide-x divide-white/[0.08]' : '')}>
        {/* Editor */}
        {viewMode !== 'preview' && (
          <div className={cn('flex-1 relative', viewMode === 'split' ? 'w-1/2' : 'w-full')}>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={e => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              spellCheck={false}
              className="w-full bg-black/20 text-[13px] text-zinc-200 font-mono leading-[1.75] placeholder:text-zinc-600 px-5 py-4 resize-none focus:outline-none border-none"
              style={{ minHeight }}
            />
          </div>
        )}

        {/* Preview */}
        {viewMode !== 'edit' && (
          <div
            className={cn(
              'prose-docs flex-1 overflow-y-auto px-6 py-5',
              viewMode === 'split' ? 'w-1/2' : 'w-full'
            )}
            style={{ minHeight }}
          >
            {value ? (
              <MarkdownContent raw>{value}</MarkdownContent>
            ) : (
              <p className="text-sm text-zinc-600 italic">Nothing to preview</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
