import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepIndicatorProps {
  current: 1 | 2 | 3
}

const STEPS = [
  { n: 1 as const, label: 'Business' },
  { n: 2 as const, label: 'Agent' },
  { n: 3 as const, label: 'Phone' },
]

export function StepIndicator({ current }: StepIndicatorProps) {
  return (
    <div className="mb-8 flex items-center justify-center">
      {STEPS.map((s, i) => {
        const done = current > s.n
        const active = current === s.n
        return (
          <div key={s.n} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                  done || active
                    ? 'bg-primary text-primary-foreground'
                    : 'border-[1.5px] border-border bg-card text-muted-foreground',
                )}
              >
                {done ? <Check className="size-4" /> : s.n}
              </div>
              <span
                className={cn(
                  'text-xs font-medium',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'mx-2 mb-5 h-px w-16 transition-colors',
                  current > s.n ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
