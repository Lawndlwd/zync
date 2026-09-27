import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { api } from '../api'
import { dirname } from '../helpers/paths'

/** Live refresh: file changes on disk (including AI edits) invalidate the matching queries. */
export function useWorkspaceEvents(ws: string) {
  const qc = useQueryClient()
  useEffect(() => {
    const es = new EventSource(api.eventsUrl(ws))
    const pending = new Set<string>()
    let timer: number | undefined
    const flush = () => {
      let visible = false
      for (const p of pending) {
        void qc.invalidateQueries({ queryKey: ['tree', ws, dirname(p)] })
        void qc.invalidateQueries({ queryKey: ['file', ws, p] })
        if (p.startsWith('.zync/memory/')) void qc.invalidateQueries({ queryKey: ['memory'] })
        if (p.startsWith('.opencode/jobs/')) {
          void qc.invalidateQueries({ queryKey: ['jobs', ws] })
          void qc.invalidateQueries({ queryKey: ['runs', ws] })
        }
        if (!p.split('/').some((s) => s.startsWith('.'))) visible = true
        // Boards are ordinary folders: any markdown change may be a card (the AI, the scheduler or
        // the file editor can all write them). Only boards currently on screen refetch.
        if (p.endsWith('.md') || p.endsWith('.board.json')) void qc.invalidateQueries({ queryKey: ['board', ws] })
        if (p.endsWith('.board.json')) void qc.invalidateQueries({ queryKey: ['boards', ws] })
        // Events, cards and jobs (and their runs) all show on the calendar.
        if (p.endsWith('.md') || p.startsWith('.opencode/jobs/'))
          void qc.invalidateQueries({ queryKey: ['calendar', ws] })
      }
      if (visible) void qc.invalidateQueries({ queryKey: ['recent', ws] })
      pending.clear()
    }
    es.addEventListener('message', (e) => {
      try {
        pending.add(JSON.parse(e.data).path)
        clearTimeout(timer)
        timer = window.setTimeout(flush, 250)
      } catch {}
    })
    return () => {
      clearTimeout(timer)
      es.close()
    }
  }, [ws, qc])
}
