import { useQuery } from '@tanstack/react-query'

import { api } from '../api'
import { Card } from '../components/Card'
import type { WorkspaceData } from '../types/workspace'
import { todaySlots } from './helpers'
import { Tile } from './Tile'

export function Schedule({ data, now }: { data: WorkspaceData; now: Date }) {
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: api.config, staleTime: Infinity })
  const slots = todaySlots(data, now)
  return (
    <Card title="Today’s AI schedule" meta={config?.timezone ?? ''} className="c-sched">
      {!slots.length ? (
        <span className="small muted ov-empty">
          Nothing scheduled today. Assign a card to @ai with a run time, or ask the AI to schedule a job.
        </span>
      ) : (
        <div className="sched-tiles">
          {slots.map((s) => (
            <Tile key={s.key} slot={s} now={now} />
          ))}
        </div>
      )}
    </Card>
  )
}
