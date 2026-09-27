import { useQuery } from '@tanstack/react-query'
import { Suspense, useState } from 'react'

import { api } from '../api'
import { LazyCodeEditor } from '../components/LazyCodeEditor'
import { SaveStatus } from '../components/SaveStatus'
import { TextArea } from '../components/TextArea'
import { ago } from '../helpers/dates'
import { errorMessage } from '../helpers/format'
import { dirname } from '../helpers/paths'
import { useDebouncedSave } from '../hooks/useDebouncedSave'
import { useFileSnapshot } from '../hooks/useFileSnapshot'
import { IconCheck } from '../icons'
import type { FileData } from '../types/files'
import type { SaveState } from '../types/save'
import { MarkdownFile } from './MarkdownFile'
import { PathBar } from './PathBar'

export function TextFile({ ws, path }: { ws: string; path: string }) {
  const { data, error, isLoading } = useQuery({ queryKey: ['file', ws, path], queryFn: () => api.file(ws, path) })
  const [state, setState] = useState<SaveState>('saved')
  const [saveError, setSaveError] = useState('')
  const [ownMtime, setOwnMtime] = useState<number | null>(null)
  // Version the editor was loaded with. Replaced when the file changes on disk (e.g. the AI edited
  // it) and there are no local edits.
  const { loaded, external } = useFileSnapshot<FileData>(data, { ownMtime, dirty: state !== 'saved' })
  const saver = useDebouncedSave<string>()

  const save = async (content: string) => {
    setState('saving')
    try {
      const res = await api.save(ws, path, content)
      setOwnMtime(res.mtime)
      setState('saved')
      setSaveError('')
    } catch (err) {
      setState('error')
      setSaveError(errorMessage(err))
      throw err
    }
  }
  const onChange = (content: string) => {
    setState('dirty')
    saver.schedule(path, content, save)
  }

  if (isLoading)
    return (
      <div className="fileview">
        <PathBar ws={ws} path={path} />
        <div className="page file-page">
          <div className="doc col g16">
            <div className="skel" style={{ height: 40, width: '60%' }} />
            <div className="skel" style={{ height: 16 }} />
            <div className="skel" style={{ height: 16, width: '80%' }} />
          </div>
        </div>
      </div>
    )
  if (error)
    return (
      <div className="fileview">
        <PathBar ws={ws} path={path} />
        <div className="page file-page">
          <p className="lede danger-t">{error.message}</p>
        </div>
      </div>
    )
  if (!loaded) return null

  return (
    <div className="fileview">
      <PathBar ws={ws} path={path} status={<SaveStatus state={state} error={saveError} />} />
      {external && (
        <div className="toast quiet file-toast" role="status">
          <IconCheck size={13} sw={2} />
          <span>Updated on disk</span>
          <span className="sep">·</span>
          <span className="muted">{ago(new Date(loaded.mtime))}</span>
        </div>
      )}
      <div className="page file-page">
        {loaded.binary ? (
          <div className="doc col g12">
            <p className="lede">
              Binary or large file · <b>{Math.round(loaded.size / 1024)} KB</b>
            </p>
            <a href={api.rawUrl(ws, path)} download className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              Download
            </a>
          </div>
        ) : path.toLowerCase().endsWith('.json') ? (
          <div className="doc col g12" style={{ maxWidth: 1100 }}>
            <div className="code-wrap file-code">
              <Suspense fallback={<div className="skel" style={{ height: 420 }} />}>
                <LazyCodeEditor
                  key={loaded.mtime}
                  value={loaded.content ?? ''}
                  ariaLabel={path}
                  onChange={(v) => {
                    // Never autosave broken JSON: a half-typed .board.json would hide the board.
                    try {
                      JSON.parse(v)
                      onChange(v)
                    } catch {
                      saver.cancel()
                      setState('dirty')
                    }
                  }}
                  onSave={() => void saver.flush()}
                />
              </Suspense>
            </div>
            {path.endsWith('.board.json') && (
              <p className="small muted" style={{ margin: 0 }}>
                The board’s columns:{' '}
                <span className="mono-s">{'{ "columns": [{ "id": "todo", "name": "To do" }, …] }'}</span>. Ids are
                lowercase; cards refer to them in <span className="mono-s">status</span>.
              </p>
            )}
          </div>
        ) : path.toLowerCase().endsWith('.md') ? (
          <MarkdownFile
            key={loaded.mtime}
            ws={ws}
            dir={dirname(path)}
            content={loaded.content ?? ''}
            onChange={onChange}
          />
        ) : (
          <div className="doc col g12" style={{ maxWidth: 1100 }}>
            <TextArea
              key={loaded.mtime}
              mono
              className="code-area"
              spellCheck={false}
              aria-label={path}
              defaultValue={loaded.content ?? ''}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                  e.preventDefault()
                  void saver.flush()
                }
                if (e.key === 'Tab') {
                  e.preventDefault()
                  const t = e.currentTarget
                  const { selectionStart: a, selectionEnd: b } = t
                  t.setRangeText('  ', a, b, 'end')
                  onChange(t.value)
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
