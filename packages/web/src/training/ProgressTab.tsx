import { useState } from 'react'

import { Card } from '../components/Card'
import { Segmented } from '../components/Segmented'
import { trainingUrl } from '../helpers/urls'
import { useTrainingProgress } from '../hooks/useTrainingProgress'
import type { ProgressRange, Units } from '../types/training'
import { BodyTrend } from './BodyTrend'
import { PrList } from './PrList'
import { VolumeBars } from './VolumeBars'

const RANGES: Array<{ value: ProgressRange; label: string }> = [
  { value: '8w', label: '8 weeks' },
  { value: '6m', label: '6 months' },
  { value: 'all', label: 'All time' },
]

/** How training adds up: volume over time, estimated one-rep-max records, body weight. */
export function ProgressTab({ ws, units }: { ws: string; units: Units }) {
  const [range, setRange] = useState<ProgressRange>('8w')
  const { data, error, isLoading } = useTrainingProgress(ws, range)
  const exerciseLink = (id: string) => `${trainingUrl(ws, 'progress')}?exercise=${encodeURIComponent(id)}`

  return (
    <div className="col g16">
      <Segmented label="Range" value={range} options={RANGES} onChange={setRange} />
      {error && <p className="lede danger-t">{error.message}</p>}
      {isLoading && <div className="skel" style={{ height: 320 }} />}
      {data && (
        <div className="tr-progress">
          <Card title="Volume" meta="kg × reps, done sets">
            {data.volume.length ? (
              <VolumeBars points={data.volume} units={units} />
            ) : (
              <span className="small muted">No workouts in this range.</span>
            )}
          </Card>
          <Card title="Body weight" meta={units}>
            <BodyTrend points={data.body} units={units} />
          </Card>
          <Card title="Records" meta="best e1RM" className="tr-wide">
            <PrList prs={data.prs} units={units} linkTo={exerciseLink} />
          </Card>
        </div>
      )}
    </div>
  )
}
