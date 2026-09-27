import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { api } from '../api'
import { Button } from '../components/Button'
import { useConfirm, useToast } from '../components/Dialog'
import { SaveStatus } from '../components/SaveStatus'
import { TextArea } from '../components/TextArea'
import { MarkdownFile } from '../files/MarkdownFile'
import { errorMessage } from '../helpers/format'
import { stripMd } from '../helpers/paths'
import { libraryUrl } from '../helpers/urls'
import { useDebouncedSave } from '../hooks/useDebouncedSave'
import { usePendingRestart } from '../hooks/usePendingRestart'
import type { SaveState } from '../types/save'
import { Crumbs } from './Crumbs'
import { KINDS } from './kinds'
import { RestartBanner } from './RestartBanner'
import { SkillFiles } from './SkillFiles'

export function LibraryFile({ ws, path }: { ws: string; path: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [, markPending] = usePendingRestart()
  const library = useQuery({ queryKey: ['opencode-library'], queryFn: api.opencodeLibrary })
  const { data, error, refetch } = useQuery({
    queryKey: ['opencode-file', path],
    queryFn: () => api.libraryFile(path),
    // Always load the file fresh when the page opens (it's saved with the version it was loaded at).
    gcTime: 0,
    staleTime: Infinity,
  })
  const [loaded, setLoaded] = useState<{ content: string; mtime: number } | null>(null)
  if (data && !loaded) setLoaded(data)
  const [state, setState] = useState<SaveState>('saved')
  // The version on disk our edits build on (null: the one loaded).
  const base = useRef<number | null>(null)
  const saver = useDebouncedSave<string>()
  const flush = saver.flush

  const save = async (content: string) => {
    setState('saving')
    try {
      base.current = (await api.saveLibraryFile(path, content, base.current ?? loaded?.mtime ?? 0)).mtime
      setState('saved')
      markPending()
      void qc.invalidateQueries({ queryKey: ['opencode-library'] })
    } catch (err) {
      setState('error')
      const msg = errorMessage(err)
      if (!/changed on disk/i.test(msg)) {
        toast(msg, 'bad')
        throw err
      }
      const ok = await confirm({
        title: 'Changed on disk',
        body: 'This file changed since you opened it. Load that version? Your edits here are discarded.',
        confirmLabel: 'Load latest',
        destructive: true,
      })
      // Declined: the edit stays pending.
      if (!ok) throw err
      saver.cancel()
      const r = await refetch()
      if (r.data) {
        setLoaded(r.data)
        base.current = r.data.mtime
        setState('saved')
      }
    }
  }
  const onChange = (content: string) => {
    setState('dirty')
    saver.schedule(path, content, save)
  }

  const segs = path.split('/')
  const isSkill = segs[0] === 'skills' || segs[0] === 'skill'
  const item = library.data?.items.find((i) =>
    isSkill ? i.kind === 'skill' && i.path.split('/')[1] === segs[1] : i.path === path,
  )
  const spec = KINDS.find((k) => k.kind === item?.kind)
  const skillRoot = isSkill ? `${segs[0]}/${segs[1]}` : ''

  const remove = async () => {
    const what = isSkill ? `the skill “${segs[1]}” and all its files` : `“${path}”`
    const ok = await confirm({
      title: isSkill && segs[2] === 'SKILL.md' ? 'Delete skill?' : 'Delete file?',
      body: <>This deletes {what}. The AI no longer sees it after the next restart.</>,
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    try {
      saver.cancel()
      const target = isSkill && segs[2] === 'SKILL.md' ? skillRoot : path
      await api.deleteLibraryEntry(target)
      await qc.invalidateQueries({ queryKey: ['opencode-library'] })
      markPending()
      void navigate(isSkill && target !== skillRoot ? libraryUrl(ws, `${skillRoot}/SKILL.md`) : libraryUrl(ws))
    } catch (err) {
      toast(errorMessage(err), 'bad')
    }
  }

  const reset = async () => {
    const ok = await confirm({
      title: 'Reset to zync’s version?',
      body: <>Your changes to the skill “{segs[1]}” are replaced by the version that ships with zync.</>,
      confirmLabel: 'Reset skill',
      destructive: true,
    })
    if (!ok) return
    try {
      saver.cancel()
      await api.resetSkill(segs[1] ?? '')
      await qc.invalidateQueries({ queryKey: ['opencode-library'] })
      const r = await refetch()
      if (r.data) {
        setLoaded(r.data)
        base.current = r.data.mtime
      }
      setState('saved')
      markPending()
      toast('Skill reset')
    } catch (err) {
      toast(errorMessage(err), 'bad')
    }
  }

  return (
    <div className="page col g20">
      <Crumbs ws={ws} parts={segs} status={<SaveStatus state={state} />} />
      <RestartBanner />
      <div className="row between wrap g12">
        <div className="col g6" style={{ minWidth: 0 }}>
          <h1 className="display oc-title">
            {item?.kind === 'command' ? '/' : ''}
            {isSkill ? segs[1] : stripMd(segs.at(-1) ?? '')}
          </h1>
          {spec && <span className="small muted">{spec.help}</span>}
        </div>
        <div className="row g8">
          {isSkill && item?.builtin && item.modified && (
            <Button size="sm" onClick={() => void reset()}>
              Reset to zync’s version
            </Button>
          )}
          <Button size="sm" variant="danger" onClick={() => void remove()}>
            {isSkill && segs[2] === 'SKILL.md' ? 'Delete skill' : 'Delete'}
          </Button>
        </div>
      </div>

      <div className={isSkill ? 'oc-skill' : ''}>
        {isSkill && (
          <SkillFiles ws={ws} root={skillRoot} current={path} files={item?.files ?? []} onAdded={markPending} />
        )}
        <div className="grow" style={{ minWidth: 0 }}>
          {error ? (
            <p className="lede danger-t">{error.message}</p>
          ) : !loaded ? (
            <div className="skel" style={{ height: 240 }} />
          ) : path.endsWith('.md') ? (
            <MarkdownFile key={loaded.mtime} ws="" dir="" content={loaded.content} onChange={onChange} />
          ) : (
            <TextArea
              key={loaded.mtime}
              mono
              className="code-area"
              spellCheck={false}
              aria-label={path}
              defaultValue={loaded.content}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                  e.preventDefault()
                  void flush()
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
