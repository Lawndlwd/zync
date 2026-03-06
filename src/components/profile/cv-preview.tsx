import { useState, useRef, useCallback } from 'react'
import type { Profile, CvTheme } from '@/types/jobs'
import { CvRenderer } from './cv-renderer'
import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'

interface CvPreviewProps {
  profile: Profile
  theme: CvTheme
}

export function CvPreview({ profile, theme }: CvPreviewProps) {
  const [zoom, setZoom] = useState(0.6)
  const cvRef = useRef<HTMLDivElement>(null)

  const handlePrint = useCallback(() => {
    if (!cvRef.current) return
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.left = '-9999px'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument
    if (!doc) return

    // Copy all stylesheets and style tags to ensure CSS custom properties work
    const styles = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]')
    )
    const head = styles.map((s) => s.outerHTML).join('\n')

    doc.write(
      `<!DOCTYPE html><html><head>${head}</head><body>${cvRef.current.innerHTML}</body></html>`
    )
    doc.close()

    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()

    setTimeout(() => document.body.removeChild(iframe), 1000)
  }, [])

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2">
        <div className="flex items-center gap-1">
          {[0.5, 0.75, 1].map((z) => (
            <Button
              key={z}
              variant={zoom === z ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => setZoom(z)}
            >
              {Math.round(z * 100)}%
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={handlePrint}>
          <Printer size={14} className="mr-1.5" /> Print / PDF
        </Button>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto p-8">
        <div
          className="mx-auto"
          style={{ width: `calc(210mm * ${zoom})` }}
        >
          <div
            ref={cvRef}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            <CvRenderer profile={profile} theme={theme} />
          </div>
        </div>
      </div>
    </div>
  )
}
