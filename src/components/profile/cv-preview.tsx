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

export function CvPreview({ profile, theme, onChange }: CvPreviewProps) {
  const [zoom, setZoom] = useState(0.6)
  const cvRef = useRef<HTMLDivElement>(null)
  const [editingField, setEditingField] = useState<string | null>(null)
  const editingElRef = useRef<HTMLElement | null>(null)
  const profileRef = useRef(profile)
  profileRef.current = profile

  const clearEdit = () => {
    const el = editingElRef.current
    if (el) {
      el.contentEditable = 'false'
      el.style.outline = ''
      el.style.outlineOffset = ''
      el.style.borderRadius = ''
    }
    editingElRef.current = null
    setEditingField(null)
  }

  const commitAndClear = () => {
    const el = editingElRef.current
    if (!el || !onChange) { clearEdit(); return }

    const field = el.dataset.field!
    const text = el.innerText.trim()
    const p = profileRef.current

    const parts = field.split('.')
    if (parts.length === 1) {
      onChange({ [field]: text })
    } else if (parts.length === 3) {
      const [arrayName, indexStr, prop] = parts
      const index = parseInt(indexStr)
      const key = arrayName as keyof Profile
      const arr = [...(p[key] as any[])]
      if (arr[index]) {
        arr[index] = { ...arr[index], [prop]: text }
        onChange({ [key]: arr })
      }
    } else if (parts.length === 4) {
      const [arrayName, indexStr, prop, subIndexStr] = parts
      const index = parseInt(indexStr)
      const subIndex = parseInt(subIndexStr)
      const key = arrayName as keyof Profile
      const arr = [...(p[key] as any[])]
      if (arr[index] && Array.isArray(arr[index][prop])) {
        const subArr = [...arr[index][prop]]
        subArr[subIndex] = text
        arr[index] = { ...arr[index], [prop]: subArr }
        onChange({ [key]: arr })
      }
    }
    clearEdit()
  }

  const startEdit = (el: HTMLElement) => {
    // Commit any previous edit first
    if (editingElRef.current && editingElRef.current !== el) {
      commitAndClear()
    }

    el.contentEditable = 'true'
    el.focus()
    el.style.outline = '2px solid #6c5ce7'
    el.style.outlineOffset = '2px'
    el.style.borderRadius = '2px'
    editingElRef.current = el
    setEditingField(el.dataset.field!)
  }

  // Click on CV element
  const handleCvClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const editable = target.closest('[data-field]') as HTMLElement | null
    if (!editable || !onChange) return

    e.stopPropagation()
    if (editable === editingElRef.current) return
    startEdit(editable)
  }

  // Click outside to deselect
  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('[data-field]') && !target.closest('.cv-toolbar')) {
      if (editingElRef.current) commitAndClear()
    }
  }

  // Keyboard: Enter commits, Escape cancels
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editingElRef.current) return
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        commitAndClear()
      }
      if (e.key === 'Escape') {
        clearEdit()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value)
    editingElRef.current?.focus()
  }

  const handlePrint = useCallback(() => {
    if (!cvRef.current) return

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.left = '-9999px'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument
    if (!doc) return

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    const head = styles.map((s) => s.outerHTML).join('\n')

    doc.write(`<!DOCTYPE html><html><head>${head}<style>@page{margin:0}[data-field]{outline:none!important}</style></head><body>${cvRef.current.innerHTML}</body></html>`)
    doc.close()

    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()

    setTimeout(() => document.body.removeChild(iframe), 1000)
  }, [])

  return (
    <div className="relative flex h-full flex-col bg-zinc-950" onClick={handleContainerClick}>
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-2">
        <div className="flex items-center gap-1">
          {[0.5, 0.75, 1].map((z) => (
            <Button key={z} variant={zoom === z ? 'secondary' : 'ghost'} size="xs" onClick={() => setZoom(z)}>
              {Math.round(z * 100)}%
            </Button>
          ))}
        </div>

        {/* Formatting toolbar - inline in top bar when editing */}
        {editingField && (
          <>
            <div className="mx-1 h-5 w-px bg-white/[0.1]" />
            <div className="cv-toolbar flex items-center gap-0.5 rounded-md border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5">
              <span className="mr-1.5 text-[10px] text-zinc-500 max-w-28 truncate">{editingField.split('.').pop()}</span>
              <button className="rounded p-1 text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100" title="Bold"
                onMouseDown={e => { e.preventDefault(); execCmd('bold') }}>
                <Bold size={13} />
              </button>
              <button className="rounded p-1 text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100" title="Italic"
                onMouseDown={e => { e.preventDefault(); execCmd('italic') }}>
                <Italic size={13} />
              </button>
              <div className="mx-0.5 h-4 w-px bg-white/[0.08]" />
              <button className="rounded p-1 text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100" title="Smaller"
                onMouseDown={e => { e.preventDefault(); execCmd('fontSize', '2') }}>
                <Type size={11} />
              </button>
              <button className="rounded p-1 text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100" title="Larger"
                onMouseDown={e => { e.preventDefault(); execCmd('fontSize', '5') }}>
                <Type size={16} />
              </button>
              <div className="mx-0.5 h-4 w-px bg-white/[0.08]" />
              <label className="flex cursor-pointer items-center rounded p-1 text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100" title="Color">
                <Palette size={13} />
                <input type="color" className="absolute h-0 w-0 opacity-0"
                  onChange={e => { execCmd('foreColor', e.target.value) }} />
              </label>
            </div>
          </>
        )}

        <div className="flex-1" />

        {onChange && !editingField && (
          <span className="text-[10px] text-zinc-600">Click any text to edit</span>
        )}
        <Button variant="ghost" size="sm" onClick={handlePrint}>
          <Printer size={14} className="mr-1.5" /> Print / PDF
        </Button>
      </div>

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
