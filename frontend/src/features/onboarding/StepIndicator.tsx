import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  { n: 1 as const, label: 'Business' },
  { n: 2 as const, label: 'Agent' },
  { n: 3 as const, label: 'Phone' },
]

export function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="mb-7 flex items-center justify-center">
      {STEPS.map((s, i) => {
        const done = current > s.n
        const active = current === s.n
        return (
          <li key={s.n} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  'flex size-8 items-center justify-center rounded-full font-semibold transition-colors',
                  done || active
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-input bg-card text-muted-foreground',
                )}
              >
                {done ? <Check className="size-4" /> : s.n}
              </span>
              <span
                className={cn('font-medium', active ? 'text-primary' : 'text-muted-foreground')}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  'mx-2 mb-5 h-px w-16 transition-colors',
                  current > s.n ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
