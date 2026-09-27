import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { api } from '../api'
import { Button } from '../components/Button'
import { useConfirm, useToast } from '../components/Dialog'
import { TitleInput } from '../components/TitleInput'
import { MarkdownFile } from '../files/MarkdownFile'
import { formatDateValue } from '../helpers/dates'
import { errorMessage } from '../helpers/format'
import { fileUrl } from '../helpers/urls'
import { useDebouncedSave } from '../hooks/useDebouncedSave'
import { useFileSnapshot } from '../hooks/useFileSnapshot'
import { usePanelEscape } from '../hooks/usePanelEscape'
import type { PanelProps, Repeat } from '../types/calendar'
import type { FileData } from '../types/files'
import { CALENDAR_DIR } from './helpers'
import { PanelShell } from './PanelShell'
import { describeRepeat } from './repeat'
import { RepeatField } from './RepeatField'

export function EventPanel({
  ws,
  file,
  date,
  onSelect,
  onChanged,
  onClose,
}: PanelProps & { file: string; date?: string }) {
  const path = `${CALENDAR_DIR}/${file}`
  const qc = useQueryClient()
  const confirm = useConfirm()
  const toast = useToast()
  const { data, error } = useQuery({ queryKey: ['file', ws, path], queryFn: () => api.file(ws, path) })
  // Same rules as the file view: reload when the file changes underneath (a calendar drag, the AI)
  // unless there are unsaved local edits; never because of our own save.
  const saver = useDebouncedSave<string>()
  const [ownMtime, setOwnMtime] = useState<number | null>(null)
  const { loaded } = useFileSnapshot<FileData>(data, { ownMtime, dirty: saver.pending })
  usePanelEscape(onClose)

  const save = async (content: string) => {
    try {
      setOwnMtime((await api.save(ws, path, content)).mtime)
      onChanged()
    } catch (err) {
      toast(errorMessage(err), 'bad')
      throw err
    }
  }
  const flush = saver.flush

  // The parsed event (for its repeat rule), refetched whenever the file changes.
  const { data: event } = useQuery({
    queryKey: ['event', ws, file, data?.mtime],
    queryFn: () => api.event(ws, file),
    enabled: !!data,
  })
  const setRepeat = async (repeat: Repeat | null) => {
    await flush()
    try {
      await api.updateEvent(ws, file, { repeat })
      await qc.invalidateQueries({ queryKey: ['file', ws, path] })
      onChanged()
    } catch (err) {
      toast(errorMessage(err), 'bad')
    }
  }

  const title = file.replace(/\.md$/, '')
  const rename = async (next: string) => {
    if (!next || next === title) return
    await flush()
    try {
      const e = await api.updateEvent(ws, file, { title: next })
      onChanged()
      onSelect({ type: 'event', file: e.file })
    } catch (err) {
      toast(errorMessage(err), 'bad')
    }
  }

  return (
    <PanelShell
      label={`Event: ${title}`}
      crumb={`${CALENDAR_DIR} / event`}
      open={fileUrl(ws, path)}
      onClose={onClose}
      footer={
        <>
          <span className="mono-s muted trunc">Saved to {path}</span>
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              const ok = await confirm({
                title: 'Delete event?',
                body: (
                  <>
                    <b>{title}</b> and its page <span className="mono-s">{path}</span> are deleted.
                  </>
                ),
                confirmLabel: 'Delete event',
                destructive: true,
              })
              if (!ok) return
              try {
                saver.cancel()
                await api.deleteEvent(ws, file)
                qc.removeQueries({ queryKey: ['file', ws, path] })
                onChanged()
                onClose()
                toast(`Deleted “${title}”`, 'quiet')
              } catch (err) {
                toast(errorMessage(err), 'bad')
              }
            }}
          >
            Delete event
          </Button>
        </>
      }
    >
      <div className="doc card-doc in-panel col g20">
        <div className="col g6">
          <TitleInput
            key={file}
            className="doc-title"
            defaultValue={title}
            aria-label="Title (file name)"
            onBlur={(e) => void rename(e.target.value.trim())}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          <span className="mono-s muted">{path}</span>
        </div>
        {event && (
          <section className="props" aria-label="Repeat">
            <div className="kv props-grid">
              <RepeatField value={event.repeat} start={event.start} onChange={(r) => void setRepeat(r)} />
            </div>
            {event.repeat && (
              <div className="row between g8 wrap repeat-sum">
                <span className="small muted">{describeRepeat(event.repeat, event.start)}</span>
                {date && !event.repeat.except?.includes(date) && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const rep = event.repeat
                      if (!rep) return
                      void setRepeat({ ...rep, except: [...(rep.except ?? []), date] }).then(() => {
                        toast(`Skipped ${formatDateValue(date, false)}`, 'quiet')
                        onClose()
                        return null
                      })
                    }}
                  >
                    Skip {formatDateValue(date, false)}
                  </Button>
                )}
              </div>
            )}
          </section>
        )}
        {error ? (
          <p className="small danger-t">{error.message}</p>
        ) : !loaded ? (
          <div className="skel" style={{ height: 160 }} />
        ) : (
          <MarkdownFile
            key={loaded.mtime}
            ws={ws}
            dir={CALENDAR_DIR}
            content={loaded.content ?? ''}
            onChange={(content) => {
              saver.schedule(path, content, save)
            }}
          />
        )}
      </div>
    </PanelShell>
  )
}
