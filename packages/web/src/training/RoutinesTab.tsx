import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { api } from '../api'
import { Button } from '../components/Button'
import { useToast } from '../components/Dialog'
import { errorMessage } from '../helpers/format'
import { byFolder, routineSummary } from '../helpers/training'
import { routineUrl } from '../helpers/urls'
import { useRoutines } from '../hooks/useRoutines'
import { useStartWorkout } from '../hooks/useStartWorkout'
import { useTrainingPlan } from '../hooks/useTrainingPlan'
import { IconFolder } from '../icons'

/** Every routine, grouped by folder: start one, or open it in the editor beside the list. */
export function RoutinesTab({ ws, openFile }: { ws: string; openFile: string }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [, setParams] = useSearchParams()
  const routines = useRoutines(ws)
  const starter = useStartWorkout(ws)
  const plan = useTrainingPlan(ws)
  const [creating, setCreating] = useState(false)

  const create = async () => {
    setCreating(true)
    try {
      const made = await api.createRoutine(ws, { name: 'New routine' })
      await qc.invalidateQueries({ queryKey: ['training', ws, 'routines'] })
      setParams({ open: made.file })
    } catch (err) {
      toast(errorMessage(err), 'bad')
    } finally {
      setCreating(false)
    }
  }

  const list = routines.data ?? []

  return (
    <div className="col g16">
      <div className="row g8 wrap">
        <Button variant="primary" busy={creating} onClick={() => void create()}>
          [+] Routine
        </Button>
        <Button busy={plan.busy} onClick={() => void plan.start()}>
          [↗] Build with AI
        </Button>
        <Button busy={starter.busy} onClick={() => void starter.start()}>
          Empty workout
        </Button>
      </div>

      {routines.error && <p className="lede danger-t">{routines.error.message}</p>}
      {routines.isLoading && <div className="skel" style={{ height: 200 }} />}
      {routines.data && list.length === 0 && (
        <p className="small muted">
          No routines yet. Write one, or let the AI build a plan from your setup — it picks real exercises from the
          library.
        </p>
      )}

      {byFolder(list).map((g) => (
        <section key={g.folder || '—'} className="col g8" aria-label={g.folder || 'Routines'}>
          <span className="mono muted row g6">
            {g.folder && <IconFolder size={13} />}
            {g.folder || (list.some((r) => r.folder) ? 'Not in a folder' : 'Routines')}
          </span>
          <div className="tr-routines">
            {g.routines.map((r) => (
              <article key={r.file} className={`card tr-routine col g10${r.file === openFile ? ' sel' : ''}`}>
                <Link to={routineUrl(ws, r.file)} className="col g4" style={{ minWidth: 0 }}>
                  <span className="h3 trunc">{r.name}</span>
                  <span className="mono-s muted">{routineSummary(r)}</span>
                </Link>
                <p className="small muted clamp2" style={{ margin: 0 }}>
                  {r.exercises.map((e) => e.name).join(' · ') || 'No exercises yet'}
                </p>
                <div className="row g8">
                  <Button size="sm" variant="primary" busy={starter.busy} onClick={() => void starter.start(r.file)}>
                    Start
                  </Button>
                  <Link to={routineUrl(ws, r.file)} className="link muted">
                    [Edit]
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
