import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { User, Bot, FileText, Layout } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFolders, useDocuments } from '@/hooks/useDocuments'

interface MentionPopoverProps {
  query: string
  position: { top: number; left: number }
  onSelect: (mention: string) => void
  onClose: () => void
  visible: boolean
}

interface MentionItem {
  id: string
  label: string
  icon: React.ElementType
  value: string
}

function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++
  }
  return qi === q.length
}

export function MentionPopover({ query, position, onSelect, onClose, visible }: MentionPopoverProps) {
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const { data: folders } = useFolders()
  const { data: documents } = useDocuments()

  const items = useMemo<MentionItem[]>(() => {
    const base: MentionItem[] = [
      { id: 'me', label: 'Assign to me', icon: User, value: '@me' },
      { id: 'ai', label: 'Assign to AI', icon: Bot, value: '@ai' },
    ]

    // Add document entries
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        const slug = doc.title.toLowerCase().replace(/\s+/g, '-')
        base.push({
          id: `doc:${doc.path}`,
          label: `@doc:${doc.title}`,
          icon: FileText,
          value: `[@doc:${doc.title}](/documents/${encodeURIComponent(doc.folder)}/${slug})`,
        })
      }
    } else if (folders && folders.length > 0) {
      // If no documents loaded yet, at least show folder names
      for (const folder of folders) {
        base.push({
          id: `doc-folder:${folder.name}`,
          label: `@doc:${folder.name}/...`,
          icon: FileText,
          value: `@doc:${folder.name}`,
        })
      }
    }

    // Canvas placeholder
    base.push({ id: 'canvas', label: 'Canvas', icon: Layout, value: '@canvas' })

    return base
  }, [folders, documents])

  const filtered = useMemo(() => {
    return items.filter((item) => {
      // Match against the label and the value
      const searchText = item.label + ' ' + item.value
      return fuzzyMatch(query, searchText)
    })
  }, [items, query])

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0)
  }, [filtered.length, query])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.children[highlightedIndex] as HTMLElement | undefined
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setHighlightedIndex((prev) => (prev + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setHighlightedIndex((prev) => (prev - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filtered.length > 0) {
          e.preventDefault()
          e.stopPropagation()
          onSelect(filtered[highlightedIndex].value)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    },
    [visible, filtered, highlightedIndex, onSelect, onClose]
  )

  useEffect(() => {
    if (!visible) return
    // Use capture phase so we intercept before the textarea/editor
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [visible, handleKeyDown])

  if (!visible || filtered.length === 0) return null

  return (
    <div
      className="fixed bg-zinc-900 border border-white/[0.1] rounded-lg shadow-xl p-1 max-h-[200px] overflow-y-auto min-w-[200px] z-[100]"
      style={{ top: position.top, left: position.left }}
      ref={listRef}
    >
      {filtered.map((item, index) => {
        const Icon = item.icon
        return (
          <div
            key={item.id}
            className={cn(
              'px-3 py-2 rounded-md text-sm cursor-pointer hover:bg-white/[0.08] flex items-center gap-2 text-zinc-300',
              index === highlightedIndex && 'bg-white/[0.08]'
            )}
            onMouseEnter={() => setHighlightedIndex(index)}
            onMouseDown={(e) => {
              // Use mouseDown instead of click so it fires before blur
              e.preventDefault()
              onSelect(item.value)
            }}
          >
            <Icon size={14} className="text-zinc-500 shrink-0" />
            <span className="truncate">{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}
