import { Suspense, useState } from 'react'

import { Button } from '../components/Button'
import { IconButton } from '../components/IconButton'
import { LazyMarkdownEditor } from '../components/LazyMarkdownEditor'
import { Select } from '../components/Select'
import { TextInput } from '../components/TextInput'
import { TitleInput } from '../components/TitleInput'
import { Toggle } from '../components/Toggle'
import { usePanelEscape } from '../hooks/usePanelEscape'
import { IconChevDown, IconChevRight, IconCross, IconTrash } from '../icons'
import { type Memory, MEMORY_TYPES, type MemoryDraft, type MemoryPatch } from '../types/memory'
import { scopeName, TYPE_INFO } from './helpers'
import { LiveMarkdown } from './LiveMarkdown'

/**
 * A memory is a markdown page (`.zync/memory/<title>.md`): the title is the file name, the
 * frontmatter is its properties, the body is what the AI reads. Opens beside the Memory list;
 * in create mode the same page fills a draft and "Save memory" writes the file.
 */
export function MemoryPanel({
  ws,
  memory,
  draft: initialDraft,
  onPatch,
  onCreate,
  onDelete,
  onClose,
  error,
}: {
  ws: string
  memory?: Memory
  draft?: MemoryDraft
  onPatch: (patch: MemoryPatch) => Promise<unknown>
  onCreate: (d: MemoryDraft) => Promise<unknown>
  onDelete: () => void
  onClose: () => void
  error: string
}) {
  const creating = !memory
  const [draft, setDraft] = useState<MemoryDraft>(
    () => initialDraft ?? { scope: 'global', title: '', type: 'preference', description: '', pinned: false, body: '' },
  )
  const [busy, setBusy] = useState(false)
  const [propsOpen, setPropsOpen] = useState(true)

  const create = async () => {
    if (!draft.title.trim() || busy) return
    setBusy(true)
    try {
      await onCreate({ ...draft, title: draft.title.trim() })
    } finally {
      setBusy(false)
    }
  }

  usePanelEscape(onClose, creating ? { onSubmit: () => void create() } : {})

  const v = memory
    ? {
        scope: memory.scope,
        title: memory.title,
        type: memory.type,
        description: memory.description ?? '',
        pinned: memory.pinned,
        body: memory.body,
      }
    : draft
  const set = (patch: Partial<MemoryDraft>, server?: MemoryPatch) => {
    if (memory) void onPatch(server ?? patch)
    else setDraft((d) => ({ ...d, ...patch }))
  }
  const file = memory?.file ?? `${v.title.trim() || 'Untitled'}.md`
  const folder = v.scope === 'global' ? '.zync/memory' : `${ws}/.zync/memory`

  return (
    <aside className="panel card-panel" aria-label={creating ? 'New memory' : `Memory: ${memory.title}`}>
      <div className="panel-h">
        <span className="mono muted trunc">Memory / {creating ? 'New' : scopeName(v.scope, ws)}</span>
        <span className="grow" />
        {memory && (
          <IconButton small label="Delete memory" onClick={onDelete}>
            <IconTrash />
          </IconButton>
        )}
        <IconButton small label="Close (Esc)" onClick={onClose}>
          <IconCross size={14} sw={1.5} />
        </IconButton>
      </div>

      <div className="panel-body">
        <div className="doc card-doc in-panel col g20">
          <div className="col g6">
            <TitleInput
              autoFocus={creating}
              key={`${memory?.file ?? 'new'}:${memory?.title ?? ''}`}
              className="doc-title"
              defaultValue={v.title}
              placeholder="e.g. Commit message style"
              aria-label="Title (file name)"
              onChange={memory ? undefined : (e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              onBlur={(e) => {
                const title = e.target.value.trim()
                if (memory && title && title !== memory.title) void onPatch({ title })
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                if (memory) e.currentTarget.blur()
                else void create()
              }}
            />
            <span className="mono-s muted">
              {folder}/{file}
            </span>
          </div>

          <section className="props" aria-label="Properties">
            <div className="props-h">
              <button
                type="button"
                className="mono row g8"
                aria-expanded={propsOpen}
                onClick={() => setPropsOpen((o) => !o)}
              >
                {propsOpen ? <IconChevDown /> : <IconChevRight />}
                Properties <span className="muted">· frontmatter</span>
              </button>
            </div>
            {propsOpen && (
              <div className="kv props-grid">
                <span className="k">type</span>
                <Select
                  compact
                  ariaLabel="type"
                  placeholder="No type"
                  value={v.type}
                  options={MEMORY_TYPES.map((t) => ({
                    value: t,
                    label: TYPE_INFO[t].label,
                    text: TYPE_INFO[t].label,
                    hint: TYPE_INFO[t].hint,
                  }))}
                  onChange={(type) => set({ type })}
                />
                <span className="k">about</span>
                <TextInput
                  compact
                  key={`d:${memory?.file}:${memory?.description ?? ''}`}
                  aria-label="description"
                  placeholder="One line: what this is about"
                  defaultValue={v.description}
                  onChange={memory ? undefined : (e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  onBlur={(e) => {
                    const description = e.target.value.trim()
                    if (memory && description !== (memory.description ?? ''))
                      void onPatch({ description: description || null })
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                  }}
                />
                <span className="k">scope</span>
                {creating ? (
                  <Select
                    compact
                    ariaLabel="scope"
                    value={draft.scope}
                    options={(['global', 'workspace'] as const).map((s) => ({
                      value: s,
                      label: scopeName(s, ws),
                      text: scopeName(s, ws),
                      hint: s === 'global' ? 'Every workspace, every chat' : 'Chats and jobs in this workspace',
                    }))}
                    onChange={(scope) => setDraft((d) => ({ ...d, scope }))}
                  />
                ) : (
                  <span className="small">{scopeName(v.scope, ws)}</span>
                )}
                <span className="k">pinned</span>
                <span className="row g10">
                  <Toggle label="Pinned" checked={v.pinned} onChange={(pinned) => set({ pinned })} />
                  <span className="small muted">
                    {v.pinned ? 'Full text in every prompt' : 'Only the title and line are in the prompt'}
                  </span>
                </span>
              </div>
            )}
          </section>

          {memory ? (
            <LiveMarkdown
              docKey={`${memory.scope}:${memory.file}`}
              ws={ws}
              value={memory.body}
              onSave={(body) => onPatch({ body })}
            />
          ) : (
            <Suspense fallback={<div className="skel" style={{ height: 160 }} />}>
              <LazyMarkdownEditor ws={ws} value={draft.body} onChange={(body) => setDraft((d) => ({ ...d, body }))} />
            </Suspense>
          )}
          <p className="muted" style={{ fontSize: 14, margin: 0 }}>
            Type <span className="kbd">/</span> for blocks · write it the way you'd brief someone: the AI reads it as is
          </p>
          {error && <span className="help err">{error}</span>}
        </div>
      </div>

      <div className="row between panel-f">
        {memory ? (
          <>
            <span className="mono-s muted">Updated {new Date(memory.updated).toLocaleString()}</span>
            <Button variant="danger" size="sm" onClick={onDelete}>
              Delete memory
            </Button>
          </>
        ) : (
          <>
            <span className="mono-s muted">
              <span className="kbd">⌘↵</span> save · <span className="kbd">Esc</span> cancel
            </span>
            <span className="row g8">
              <Button size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                busy={busy}
                disabled={!draft.title.trim()}
                onClick={() => void create()}
              >
                Save memory
              </Button>
            </span>
          </>
        )}
      </div>
    </aside>
  )
}
