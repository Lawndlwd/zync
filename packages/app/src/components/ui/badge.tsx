import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center rounded-xl px-2.5 py-0.5 text-xs font-medium transition-colors', {
  variants: {
    variant: {
      default: 'bg-secondary text-secondary-foreground',
      primary: 'bg-primary/10 text-primary',
      success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
      warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
      danger: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400',
      info: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
    },
  },
  defaultVariants: { variant: 'default' },
})

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
