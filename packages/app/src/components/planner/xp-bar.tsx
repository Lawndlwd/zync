import type { LifeOsStats } from '@zync/shared/types'
import { Cell, Pie, PieChart } from 'recharts'

export function XpBar({ stats }: { stats?: LifeOsStats | null }) {
  const totalXp = stats?.totalXp ?? 0
  const xpInLevel = totalXp % 1000
  const pct = Math.min(100, (xpInLevel / 1000) * 100)

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-3">
      {/* Growth Rate donut */}
      <div className="rounded-full bg-donut-surface p-3 flex flex-col items-center">
        <div className="relative">
          <PieChart width={180} height={180}>
            {/* Thin background track */}
            <Pie
              data={[{ v: 1 }]}
              cx={85}
              cy={85}
              innerRadius={78}
              outerRadius={90}
              startAngle={90}
              endAngle={-270}
              dataKey="v"
              stroke="none"
              isAnimationActive={false}
            >
              <Cell fill="rgba(255,255,255,0.15)" />
            </Pie>
            {/* Thick filled arc */}
            <Pie
              data={[{ v: pct }]}
              cx={85}
              cy={85}
              innerRadius={62}
              outerRadius={90}
              startAngle={90}
              endAngle={90 - (pct / 100) * 360}
              dataKey="v"
              stroke="none"
              cornerRadius={10}
            >
              <Cell fill="#E86B51" />
            </Pie>
          </PieChart>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-display font-bold text-white">{Math.round(pct)}%</span>
            <span className="text-[10px] uppercase tracking-wider mt-1 text-white">Growth rate</span>
          </div>
        </div>
      </div>
    </div>
  )
}
