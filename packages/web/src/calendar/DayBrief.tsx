import { Link } from 'react-router'

import { BriefSetup } from '../briefs/BriefSetup'
import { BriefTodos } from '../briefs/BriefTodos'
import { Card } from '../components/Card'
import { MarkdownLite } from '../components/MarkdownLite'
import { briefFile } from '../helpers/briefs'
import { ymd } from '../helpers/dates'
import { errorMessage } from '../helpers/format'
import { fileUrl } from '../helpers/urls'
import { useBrief } from '../hooks/useBrief'

/** The day view's brief: suggested to-dos, then the brief itself (Briefs/<date>.md). */
export function DayBrief({ ws, date }: { ws: string; date: string }) {
  const brief = useBrief(ws, date)
  const today = ymd(new Date())
  if (brief.isLoading) return null
  return (
    <Card
      title="Brief"
      className="day-brief"
      meta={
        brief.data ? (
          <Link className="link" to={fileUrl(ws, briefFile(date))}>
            [Open page ↗]
          </Link>
        ) : undefined
      }
    >
      {brief.error ? (
        <span className="help err">{errorMessage(brief.error)}</span>
      ) : brief.data ? (
        <div className="col g16">
          <BriefTodos ws={ws} date={date} todos={brief.data.todos} />
          {brief.data.body && (
            <details open className="day-brief-body">
              <summary className="mono-s muted">The brief</summary>
              <MarkdownLite ws={ws} source={brief.data.body} />
            </details>
          )}
          {date === today && <BriefSetup ws={ws} canRun hasBrief />}
        </div>
      ) : (
        <div className="col g10">
          <span className="small muted">No brief for this day.</span>
          <BriefSetup ws={ws} canRun={date === today} hasBrief={false} />
        </div>
      )}
    </Card>
  )
}
