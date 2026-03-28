import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function StatBlock({ label, value, color }: { label: string; value: number | undefined; color: string }) {
  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      {value === undefined ? (
        <Skeleton className="h-8 w-10" />
      ) : (
        <span className={cn('text-2xl font-bold', color)}>{value}</span>
      )}
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}
