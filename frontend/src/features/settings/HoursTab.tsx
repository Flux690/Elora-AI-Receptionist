import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  WEEKDAYS,
  type BusinessHours,
  type BookingPolicy,
  type HoursException,
  type TimeInterval,
  type Weekday,
} from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/apiClient'
import { keys } from '@/lib/queries'
import type { AppSettings } from '@/lib/settings-types'
import { Section, Field } from './Section'

const DAY_LABELS: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/**
 * The same rules the backend enforces, checked here so the user sees the problem
 * next to the field rather than as a rejected save.
 *
 * Deliberately a duplicate of the server's validation, not a replacement for it:
 * the API is reachable without this form.
 */
function intervalProblem(intervals: TimeInterval[]): string | null {
  for (const i of intervals) {
    if (!i.start || !i.end) return 'Fill in both times'
    if (toMinutes(i.end) <= toMinutes(i.start)) return 'Closing must be after opening'
  }
  const sorted = [...intervals].sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
  for (let i = 1; i < sorted.length; i++) {
    if (toMinutes(sorted[i]!.start) < toMinutes(sorted[i - 1]!.end)) {
      return 'Periods on the same day cannot overlap'
    }
  }
  return null
}

function IntervalFields({
  interval,
  onChange,
  onRemove,
}: {
  interval: TimeInterval
  onChange: (patch: Partial<TimeInterval>) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="time"
        value={interval.start}
        onChange={(e) => onChange({ start: e.target.value })}
        className="w-32"
        aria-label="Opens at"
      />
      <span className="text-sm text-muted-foreground">to</span>
      <Input
        type="time"
        value={interval.end}
        onChange={(e) => onChange({ end: e.target.value })}
        className="w-32"
        aria-label="Closes at"
      />
      <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Remove period">
        <X className="size-4" />
      </Button>
    </div>
  )
}

export function HoursTab({ settings }: { settings: AppSettings }) {
  const qc = useQueryClient()
  const [hours, setHours] = useState<BusinessHours>(settings.business.businessHours)
  const [policy, setPolicy] = useState<BookingPolicy>(settings.business.bookingPolicy)

  const save = useMutation({
    mutationFn: () =>
      apiClient.patch('/admin/settings', {
        business: { businessHours: hours, bookingPolicy: policy },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.settings })
      toast.success('Hours saved')
    },
    onError: () => toast.error('Could not save hours. Check the times and try again.'),
  })

  function setDay(day: Weekday, intervals: TimeInterval[]) {
    setHours((h) => ({ ...h, weekly: { ...h.weekly, [day]: intervals } }))
  }

  function setExceptions(exceptions: HoursException[]) {
    setHours((h) => ({ ...h, exceptions }))
  }

  const dayProblems = WEEKDAYS.map((d) => intervalProblem(hours.weekly[d] ?? []))
  const exceptionProblems = hours.exceptions.map((e) => intervalProblem(e.intervals))
  const hasProblem = [...dayProblems, ...exceptionProblems].some(Boolean)

  return (
    <div>
      <Section
        title="Opening hours"
        lede="Your agent answers &ldquo;are you open Saturday?&rdquo; from this, and only offers times inside it."
      >
        <div className="flex flex-col">
          {WEEKDAYS.map((day, dayIndex) => {
            const intervals = hours.weekly[day] ?? []
            const problem = dayProblems[dayIndex]

            return (
              <div
                key={day}
                className="grid grid-cols-[104px_1fr] items-start gap-4 py-1.5"
              >
                <span className="pt-1.5 text-sm font-medium text-foreground">
                  {DAY_LABELS[day]}
                </span>

                <div className="flex flex-col gap-2">
                  {intervals.length === 0 ? (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">Closed</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDay(day, [{ start: '09:00', end: '17:00' }])}
                      >
                        <Plus className="size-3.5" />
                        Open this day
                      </Button>
                    </div>
                  ) : (
                    <>
                      {intervals.map((interval, i) => (
                        <IntervalFields
                          key={i}
                          interval={interval}
                          onChange={(patch) =>
                            setDay(
                              day,
                              intervals.map((v, idx) => (idx === i ? { ...v, ...patch } : v)),
                            )
                          }
                          onRemove={() =>
                            setDay(
                              day,
                              intervals.filter((_, idx) => idx !== i),
                            )
                          }
                        />
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="self-start"
                        onClick={() =>
                          setDay(day, [...intervals, { start: '14:00', end: '18:00' }])
                        }
                      >
                        <Plus className="size-3.5" />
                        Add another period
                      </Button>
                    </>
                  )}

                  {problem && <p className="text-sm text-destructive">{problem}</p>}
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section
        title="Holidays"
        lede="A date that ignores the weekly pattern. Leave it with no periods to close for the day."
      >

        {hours.exceptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {hours.exceptions.map((exception, i) => {
              const patch = (next: Partial<HoursException>) =>
                setExceptions(
                  hours.exceptions.map((e, idx) => (idx === i ? { ...e, ...next } : e)),
                )

              return (
                <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={exception.date}
                      onChange={(e) => patch({ date: e.target.value })}
                      className="w-44"
                      aria-label="Date"
                    />
                    <Input
                      value={exception.label ?? ''}
                      onChange={(e) => patch({ label: e.target.value })}
                      placeholder="Reason (optional)"
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setExceptions(hours.exceptions.filter((_, idx) => idx !== i))
                      }
                      aria-label="Remove date"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>

                  {exception.intervals.map((interval, j) => (
                    <IntervalFields
                      key={j}
                      interval={interval}
                      onChange={(next) =>
                        patch({
                          intervals: exception.intervals.map((v, idx) =>
                            idx === j ? { ...v, ...next } : v,
                          ),
                        })
                      }
                      onRemove={() =>
                        patch({
                          intervals: exception.intervals.filter((_, idx) => idx !== j),
                        })
                      }
                    />
                  ))}

                  <div className="flex items-center gap-3">
                    {exception.intervals.length === 0 && (
                      <span className="text-sm text-muted-foreground">Closed all day</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        patch({
                          intervals: [
                            ...exception.intervals,
                            { start: '09:00', end: '17:00' },
                          ],
                        })
                      }
                    >
                      <Plus className="size-3.5" />
                      Open for part of the day
                    </Button>
                  </div>

                  {exceptionProblems[i] && (
                    <p className="text-sm text-destructive">{exceptionProblems[i]}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setExceptions([...hours.exceptions, { date: '', intervals: [], label: '' }])
            }
          >
            <Plus className="size-3.5" />
            Add a date
          </Button>
        </div>
      </Section>

      <Section
        title="Booking window"
        lede="How near and how far ahead a caller may book."
      >
        <Field
          label="Shortest notice"
          help="Won't offer a time sooner than this. Set 0 to allow bookings right now."
          htmlFor="min-notice"
        >
          <div className="relative w-28">
            <Input
              id="min-notice"
              value={String(policy.minNoticeMinutes)}
              onChange={(e) =>
                setPolicy((p) => ({
                  ...p,
                  minNoticeMinutes: Number(e.target.value.replace(/\D/g, '')) || 0,
                }))
              }
              inputMode="numeric"
              className="pr-14"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              min
            </span>
          </div>
        </Field>

        <Field
          label="Furthest ahead"
          help="Stops a caller booking further out than you can plan for."
          htmlFor="max-advance"
        >
          <div className="relative w-28">
            <Input
              id="max-advance"
              value={String(policy.maxAdvanceDays)}
              onChange={(e) =>
                setPolicy((p) => ({
                  ...p,
                  maxAdvanceDays: Number(e.target.value.replace(/\D/g, '')) || 1,
                }))
              }
              inputMode="numeric"
              className="pr-14"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              days
            </span>
          </div>
        </Field>

        <div className="flex justify-start pt-1">
          <Button onClick={() => save.mutate()} disabled={save.isPending || hasProblem}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </Section>
    </div>
  )
}
