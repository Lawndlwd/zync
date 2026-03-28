import { SmilePlus } from 'lucide-react'
import { useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { usePsyScores, usePsyScoreToday, useUpsertPsyScore } from '@/hooks/useLifeOs'

export function PsyTracker() {
  const { data: scores = [] } = usePsyScores(30)
  const { data: todayScore } = usePsyScoreToday()
  const upsert = useUpsertPsyScore()
  const [hoveredScore, setHoveredScore] = useState<number | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const chartData = [...scores].reverse().map((s) => ({ date: s.date.slice(5), score: s.score }))

  const handleSetScore = (score: number) => {
    upsert.mutate({ date: today, score })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <SmilePlus size={16} className="text-primary" />
          <h3 className="text-sm font-display font-semibold text-foreground">Mood Tracker</h3>
        </div>
        {todayScore && <span className="text-xs text-muted-foreground">Today: {todayScore.score}/10</span>}
      </div>

      {/* Score input */}
      <div className="flex gap-1 mb-3">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => handleSetScore(n)}
            onMouseEnter={() => setHoveredScore(n)}
            onMouseLeave={() => setHoveredScore(null)}
            className={`flex-1 h-6 rounded text-[10px] font-medium transition-colors ${
              (todayScore?.score ?? 0) >= n
                ? 'bg-primary text-white'
                : hoveredScore && hoveredScore >= n
                  ? 'bg-primary/20 text-primary'
                  : 'bg-secondary text-muted-foreground'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="psyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#b91f02" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#b91f02" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 10]} tick={false} axisLine={false} tickLine={false} width={0} />
            <Tooltip
              contentStyle={{ background: 'var(--card)', border: 'none', borderRadius: '8px', fontSize: 11 }}
              labelStyle={{ color: 'var(--muted-foreground)' }}
            />
            <Area type="monotone" dataKey="score" stroke="#b91f02" strokeWidth={2} fill="url(#psyGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
