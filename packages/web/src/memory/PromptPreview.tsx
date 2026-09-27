import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { api } from '../api'
import { IconChevDown, IconChevRight } from '../icons'

/** The exact block added to the AI's system prompt, for when you wonder what it knows. */
export function PromptPreview({ ws }: { ws: string }) {
  const [open, setOpen] = useState(false)
  const { data } = useQuery({
    queryKey: ['memory', 'prompt', ws],
    queryFn: () => api.memoryPrompt(ws),
    enabled: open,
  })
  return (
    <section className="props" aria-label="What the AI sees">
      <div className="props-h">
        <button type="button" className="mono row g8" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? <IconChevDown /> : <IconChevRight />}
          What the AI sees <span className="muted">· added to every prompt in {ws}</span>
        </button>
      </div>
      {open && (
        <pre
          className="mono-s"
          style={{ margin: 0, padding: '12px 14px', whiteSpace: 'pre-wrap', maxHeight: 420, overflow: 'auto' }}
        >
          {data?.text ?? 'Loading…'}
        </pre>
      )}
    </section>
  )
}
