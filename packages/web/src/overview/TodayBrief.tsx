import { Link } from 'react-router'

import { BriefSetup } from '../briefs/BriefSetup'
import { BriefTodos } from '../briefs/BriefTodos'
import { Card } from '../components/Card'
import { ymd } from '../helpers/dates'
import { plural } from '../helpers/format'
import { wsUrl } from '../helpers/urls'
import { useBrief } from '../hooks/useBrief'

/** Today's brief: its suggested to-dos, with the whole brief one click away in the calendar. */
export function TodayBrief({ ws }: { ws: string }) {
  const today = ymd(new Date())
  const brief = useBrief(ws, today)
  if (brief.isLoading || brief.error) return null
  const todos = brief.data?.todos ?? []
  const open = todos.filter((t) => !t.card && !t.done).length
  return (
    <Card
      title="Today’s brief"
      meta={
        <Link className="link" to={`${wsUrl(ws, 'calendar')}?view=day`}>
          [Open in calendar ↗]
        </Link>
      }
    >
      {brief.data ? (
        <div className="col g10">
          <span className="small muted">
            {todos.length ? `${plural(open, 'to-do')} left of ${todos.length} suggested.` : 'Nothing to do today.'}
          </span>
          <BriefTodos ws={ws} date={today} todos={todos} />
        </div>
      ) : (
        <div className="col g10">
          <span className="small muted">No brief yet today.</span>
          <BriefSetup ws={ws} canRun hasBrief={false} />
        </div>
      )}
    </Card>
  )
}
