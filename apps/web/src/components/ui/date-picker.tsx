import { DayPicker } from 'react-day-picker'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/**
 * A calendar rather than a native date input, which brings an unstyleable button
 * and an autofill tint. Parsed in local parts: `new Date(iso)` is read as UTC.
 */
function parse(value: string): Date | undefined {
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

function serialise(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  id?: string
  placeholder?: string
  className?: string
}

export function DatePicker({
  value,
  onChange,
  id,
  placeholder = 'Pick a date',
  className,
}: DatePickerProps) {
  const selected = parse(value)

  return (
    <Popover>
      <PopoverTrigger
        id={id}
        className={cn(
          'flex h-8 items-center justify-between gap-2 rounded-lg border-[0.5px] border-input bg-card px-2.5 text-sm shadow-control transition-colors outline-none hover:bg-control-hover active:bg-control-active',
          className,
        )}
      >
        <span className={selected ? 'tabular-nums' : 'text-muted-foreground'}>
          {selected
            ? selected.toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : placeholder}
        </span>
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent>
        <DayPicker
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => date && onChange(serialise(date))}
          showOutsideDays
          components={{
            PreviousMonthButton: (props) => (
              <button {...props} type="button">
                <ChevronLeft className="size-4" />
              </button>
            ),
            NextMonthButton: (props) => (
              <button {...props} type="button">
                <ChevronRight className="size-4" />
              </button>
            ),
          }}
          classNames={{
            root: 'text-sm',
            months: 'flex flex-col',
            month: 'flex flex-col gap-2',
            month_caption: 'flex h-8 items-center justify-center font-medium',
            nav: 'absolute inset-x-1 top-1 flex items-center justify-between',
            button_previous:
              'inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-hover hover:text-foreground',
            button_next:
              'inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-hover hover:text-foreground',
            month_grid: 'w-full border-collapse',
            weekdays: 'flex',
            weekday: 'w-9 pb-1 font-normal text-muted-foreground',
            week: 'flex',
            day: 'p-0',
            day_button:
              'inline-flex size-9 items-center justify-center rounded-lg tabular-nums hover:bg-hover',
            selected:
              '[&>button]:bg-primary [&>button]:font-medium [&>button]:text-primary-foreground [&>button]:hover:bg-primary-hover',
            today: '[&>button]:font-semibold [&>button]:text-accent-ink',
            outside: '[&>button]:text-muted-foreground [&>button]:opacity-50',
            disabled: '[&>button]:pointer-events-none [&>button]:opacity-40',
            hidden: 'invisible',
          }}
          className="relative"
        />
      </PopoverContent>
    </Popover>
  )
}
