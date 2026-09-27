import { Suspense, useRef, useState } from 'react'

import { LazyMarkdownEditor } from '../components/LazyMarkdownEditor'
import { usePeople } from '../hooks/usePeople'
import { Properties } from './Properties'

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/

/**
 * The WYSIWYG editor doesn't understand YAML frontmatter, so it is edited as a property sheet above
 * the body and the two are re-joined on save. Board cards are markdown files whose fields live there.
 */
export function MarkdownFile({
  ws,
  dir,
  content,
  onChange,
}: {
  ws: string
  dir: string
  content: string
  onChange: (content: string) => void
}) {
  const people = usePeople()
  // Uncontrolled: split once (the parent remounts on a new version); the refs hold the edits.
  const [initial] = useState(() => {
    const match = content.match(FRONTMATTER)
    return { front: match ? (match[1] ?? '') : null, body: match ? content.slice(match[0].length) : content }
  })
  const front = useRef(initial.front)
  const body = useRef(initial.body)
  const emit = () =>
    onChange(
      front.current?.trim() ? `---\n${front.current.trim()}\n---\n\n${body.current.replace(/^\n+/, '')}` : body.current,
    )

  return (
    <div className="doc col g20">
      {initial.front !== null && (
        <Properties
          source={initial.front}
          people={people}
          onChange={(yaml) => {
            front.current = yaml
            emit()
          }}
        />
      )}
      <Suspense fallback={<div className="skel" style={{ height: 200 }} />}>
        <LazyMarkdownEditor
          ws={ws}
          dir={dir}
          value={initial.body}
          onChange={(md) => {
            body.current = md
            emit()
          }}
        />
      </Suspense>
      <p className="muted" style={{ fontSize: 14, margin: 0 }}>
        Type <span className="kbd">/</span> for blocks · <span className="kbd">@</span> to mention or link a page ·
        changes save automatically
      </p>
    </div>
  )
}
