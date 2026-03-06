import { useState, useRef, useCallback, useEffect } from 'react'
import type { Profile, CvTheme } from '@/types/jobs'
import { CvRenderer } from './cv-renderer'
import { Button } from '@/components/ui/button'
import { Printer, Bold, Italic, Type, Palette } from 'lucide-react'

interface CvPreviewProps {
  profile: Profile
  theme: CvTheme
  onChange?: (updates: Partial<Profile>) => void
}

interface FloatingToolbar {
  x: number
  y: number
  el: HTMLElement
  field: string
}

export function CvPreview({ profile, theme, onChange }: CvPreviewProps) {
  const [zoom, setZoom] = useState(0.6)
  const cvRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [toolbar, setToolbar] = useState<FloatingToolbar | null>(null)
  const [editingEl, setEditingEl] = useState<HTMLElement | null>(null)

  // Click on CV element to edit it
  const handleCvClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    // Walk up to find the nearest editable element
    const editable = target.closest('[data-field]') as HTMLElement | null
    if (!editable || !onChange) return

    e.stopPropagation()

    // If already editing this element, don't re-init
    if (editable === editingEl) return

    // Commit previous edit
    if (editingEl) commitEdit(editingEl)

    // Make editable
    editable.contentEditable = 'true'
    editable.focus()
    editable.style.outline = '2px solid #6c5ce7'
    editable.style.outlineOffset = '2px'
    editable.style.borderRadius = '2px'
    setEditingEl(editable)

    // Position toolbar above the element
    const container = containerRef.current
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    const elRect = editable.getBoundingClientRect()
    setToolbar({
      x: elRect.left - containerRect.left,
      y: elRect.top - containerRect.top - 40,
      el: editable,
      field: editable.dataset.field!,
    })
  }, [editingEl, onChange])

  // Commit an edit - read the text and update profile
  const commitEdit = useCallback((el: HTMLElement) => {
    if (!onChange) return
    el.contentEditable = 'false'
    el.style.outline = ''
    el.style.outlineOffset = ''
    el.style.borderRadius = ''

    const field = el.dataset.field!
    const text = el.innerText.trim()

    // Parse the field path and update profile
    // Simple fields: "name", "title", "summary"
    // Array fields: "experiences.0.title", "experiences.0.bullets.1"
    const parts = field.split('.')
    if (parts.length === 1) {
      // Simple field
      onChange({ [field]: text })
    } else if (parts.length === 3) {
      // e.g. experiences.0.title
      const [arrayName, indexStr, prop] = parts
      const index = parseInt(indexStr)
      const key = arrayName as keyof Profile
      const arr = [...(profile[key] as any[])]
      if (arr[index]) {
        arr[index] = { ...arr[index], [prop]: text }
        onChange({ [key]: arr })
      }
    } else if (parts.length === 4) {
      // e.g. experiences.0.bullets.1
      const [arrayName, indexStr, prop, subIndexStr] = parts
      const index = parseInt(indexStr)
      const subIndex = parseInt(subIndexStr)
      const key = arrayName as keyof Profile
      const arr = [...(profile[key] as any[])]
      if (arr[index] && Array.isArray(arr[index][prop])) {
        const subArr = [...arr[index][prop]]
        subArr[subIndex] = text
        arr[index] = { ...arr[index], [prop]: subArr }
        onChange({ [key]: arr })
      }
    }
  }, [onChange, profile])

  // Click outside to deselect
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('[data-field]') && editingEl) {
      commitEdit(editingEl)
      setEditingEl(null)
      setToolbar(null)
    }
  }, [editingEl, commitEdit])

  // Handle blur
  useEffect(() => {
    if (!editingEl) return
    const handleBlur = (e: FocusEvent) => {
      const related = e.relatedTarget as HTMLElement | null
      // Don't blur if clicking toolbar buttons
      if (related?.closest('.cv-toolbar')) return
      commitEdit(editingEl)
      setEditingEl(null)
      setToolbar(null)
    }
    editingEl.addEventListener('blur', handleBlur)
    return () => editingEl.removeEventListener('blur', handleBlur)
  }, [editingEl, commitEdit])

  // Handle Enter to commit (not newline)
  useEffect(() => {
    if (!editingEl) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        commitEdit(editingEl)
        setEditingEl(null)
        setToolbar(null)
      }
      if (e.key === 'Escape') {
        editingEl.contentEditable = 'false'
        editingEl.style.outline = ''
        editingEl.style.outlineOffset = ''
        setEditingEl(null)
        setToolbar(null)
      }
    }
    editingEl.addEventListener('keydown', handleKeyDown)
    return () => editingEl.removeEventListener('keydown', handleKeyDown)
  }, [editingEl, commitEdit])

  // Toolbar actions
  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value)
    editingEl?.focus()
  }

  const handlePrint = useCallback(() => {
    if (!cvRef.current) return
    const printContent = cvRef.current.querySelector('[class^="cv-"]')
    if (!printContent) return

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.left = '-9999px'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument
    if (!doc) return

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    const head = styles.map((s) => s.outerHTML).join('\n')

    doc.write(`<!DOCTYPE html><html><head>${head}<style>@page{margin:0}</style></head><body>${cvRef.current.innerHTML}</body></html>`)
    doc.close()

    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()

    setTimeout(() => document.body.removeChild(iframe), 1000)
  }, [])

  return (
    <div ref={containerRef} className="relative flex h-full flex-col bg-zinc-950" onClick={handleContainerClick}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2">
        <div className="flex items-center gap-1">
          {[0.5, 0.75, 1].map((z) => (
            <Button key={z} variant={zoom === z ? 'secondary' : 'ghost'} size="xs" onClick={() => setZoom(z)}>
              {Math.round(z * 100)}%
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {onChange && (
            <span className="text-[10px] text-zinc-600">Click any text to edit</span>
          )}
          <Button variant="ghost" size="sm" onClick={handlePrint}>
            <Printer size={14} className="mr-1.5" /> Print / PDF
          </Button>
        </div>
      </div>

      {/* Floating toolbar */}
      {toolbar && (
        <div
          className="cv-toolbar absolute z-50 flex items-center gap-0.5 rounded-lg border border-white/[0.12] bg-zinc-900 px-1.5 py-1 shadow-xl"
          style={{ left: toolbar.x, top: toolbar.y + 44 }}
        >
          <button
            className="rounded p-1 text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100"
            title="Bold"
            onMouseDown={e => { e.preventDefault(); execCmd('bold') }}
          >
            <Bold size={14} />
          </button>
          <button
            className="rounded p-1 text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100"
            title="Italic"
            onMouseDown={e => { e.preventDefault(); execCmd('italic') }}
          >
            <Italic size={14} />
          </button>
          <div className="mx-1 h-4 w-px bg-white/[0.1]" />
          <button
            className="rounded p-1 text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100"
            title="Decrease font"
            onMouseDown={e => { e.preventDefault(); execCmd('fontSize', '2') }}
          >
            <Type size={12} />
          </button>
          <button
            className="rounded p-1 text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100"
            title="Increase font"
            onMouseDown={e => { e.preventDefault(); execCmd('fontSize', '5') }}
          >
            <Type size={16} />
          </button>
          <div className="mx-1 h-4 w-px bg-white/[0.1]" />
          <label className="flex cursor-pointer items-center rounded p-1 text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100" title="Text color">
            <Palette size={14} />
            <input
              type="color"
              className="absolute h-0 w-0 opacity-0"
              onChange={e => { execCmd('foreColor', e.target.value) }}
            />
          </label>
        </div>
      )}

      {/* Preview area */}
      <div className="flex-1 overflow-auto p-8">
        <div className="mx-auto" style={{ width: `calc(210mm * ${zoom})` }}>
          <div
            ref={cvRef}
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            onClick={handleCvClick}
          >
            <CvRenderer profile={profile} theme={theme} />
          </div>
        </div>
      </div>
    </div>
  )
}
