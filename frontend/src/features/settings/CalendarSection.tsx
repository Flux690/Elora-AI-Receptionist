import { useState } from 'react'
import { useUser } from '@clerk/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar } from 'lucide-react'
import { toast } from 'sonner'
import type { CalendarOption } from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { apiClient } from '@/lib/apiClient'
import { keys, fetchers } from '@/lib/queries'
import type { AppSettings } from '@/lib/settings-types'

/**
 * Connecting a calendar is two separate acts, and only the first was ever built.
 *
 * Granting Google the calendar scope told us nothing about *which* calendar
 * holds bookings — and nothing ever wrote that choice down, so the agent read
 * "calendar not connected" on every call and the whole booking path was
 * unreachable. This component is the missing second act: pick a calendar, and
 * store it.
 *
 * Most businesses keep bookings in a calendar of their own rather than the
 * owner's personal one, which is why guessing the primary calendar is not good
 * enough — a wrong guess puts customer appointments somewhere nobody looks.
 */
export function CalendarSection({ settings }: { settings: AppSettings }) {
  const qc = useQueryClient()
  const { user } = useUser()
  const [choice, setChoice] = useState<string | null>(null)
  const [showDisconnect, setShowDisconnect] = useState(false)
  const [changing, setChanging] = useState(false)
  const [granting, setGranting] = useState(false)

  const connectedId = settings.business.calendarExternalId
  const connectedName = settings.business.calendarPayload?.summary
  const picking = !connectedId || changing

  // Only hits Google when a picker is actually on screen. A connected tenant
  // reads the calendar's name from what we stored, not from a network call.
  const { data, isLoading } = useQuery({
    queryKey: keys.calendarList,
    queryFn: fetchers.calendarList,
    enabled: picking,
    staleTime: 0,
  })

  const save = useMutation({
    mutationFn: (calendar: CalendarOption) =>
      apiClient.patch('/admin/calendar', {
        calendarId: calendar.id,
        summary: calendar.summary,
        timeZone: calendar.timeZone,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.settings })
      setChanging(false)
      setChoice(null)
      toast.success('Calendar connected — your agent can now book appointments')
    },
    onError: () => toast.error('Could not save that calendar. Try again.'),
  })

  const disconnect = useMutation({
    mutationFn: () => apiClient.delete('/admin/calendar'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.settings })
      qc.invalidateQueries({ queryKey: keys.calendarList })
      toast.success('Calendar disconnected')
    },
    onError: () => toast.error('Could not disconnect. Try again.'),
  })

  /**
   * Asks Clerk for the calendar scope, then sends the browser to Google.
   *
   * That second step is the one that was missing, and it is why connecting a
   * calendar never worked: `createExternalAccount` and `reauthorize` do NOT
   * navigate. They return an ExternalAccount whose
   * `verification.externalVerificationRedirectURL` is the Google consent screen,
   * and it is the caller's job to go there. Without it the promise resolves,
   * nothing visible happens, and no error is thrown — so the button looked
   * inert and `google_calendar_id` was never written for anyone.
   *
   * PLAN.md 2.1 deletes all of this: calendar access should not travel through a
   * sign-in flow at all. Until Better Auth lands, it does.
   */
  async function grantAccess() {
    if (!user) return

    setGranting(true)
    try {
      const redirectUrl = `${window.location.origin}/sso-callback?returnTo=/settings`
      const scopes = ['https://www.googleapis.com/auth/calendar']
      const google = user.externalAccounts.find((a) => a.provider === 'google')

      const account = google
        ? await google.reauthorize({ additionalScopes: scopes, redirectUrl })
        : await user.createExternalAccount({
            strategy: 'oauth_google',
            redirectUrl,
            additionalScopes: scopes,
          })

      const next = account.verification?.externalVerificationRedirectURL
      if (!next) {
        toast.error("Google didn't return a consent link. Please try again.")
        setGranting(false)
        return
      }

      window.location.href = next.href
    } catch (err) {
      console.error('[calendar] could not start Google authorization:', err)
      toast.error("Couldn't open Google. Please try again.")
      setGranting(false)
    }
  }

  const calendars = data?.calendars ?? []
  const selected = calendars.find((cal) => cal.id === choice)

  return (
    <div>
      <span className="text-sm font-medium text-foreground">Google Calendar</span>
      <p className="mt-px mb-[7px] text-sm text-muted-foreground">
        Lets the agent check times and book appointments.
      </p>

      {connectedId && !changing ? (
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {connectedName ?? connectedId}
              </p>
              <p className="text-xs text-muted-foreground">
                Appointments are booked here
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="sm" onClick={() => setChanging(true)}>
              Change
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDisconnect(true)}
              disabled={disconnect.isPending}
              className="text-destructive hover:text-destructive"
            >
              Disconnect
            </Button>
          </div>
        </div>
      ) : isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : !data?.connected ? (
        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            onClick={grantAccess}
            disabled={granting}
            className="self-start"
          >
            <Calendar className="size-3.5" />
            {granting ? 'Opening Google…' : 'Connect Google Calendar'}
          </Button>
        </div>
      ) : calendars.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            This Google account has no calendar you can add events to. Create one in
            Google Calendar, then check again.
          </p>
          <Button
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey: keys.calendarList })}
            className="self-start"
          >
            Check again
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Choose which calendar holds your appointments. Most businesses keep these
            separate from a personal calendar.
          </p>
          <div className="flex gap-2">
            <Select value={choice ?? ''} onValueChange={(v) => setChoice(v ?? null)}>
              <SelectTrigger className="flex-1">
                {/* Base UI's Select.Value renders the VALUE, not the chosen
                    item's label, unless given an `items` map or this children
                    function — it falls through to `resolveSelectedLabel(value,
                    items, …)` and with no items that resolves to the value.

                    Here the value is a Google calendar id, so picking a
                    secondary calendar replaced its name with
                    `c_…@group.calendar.google.com`. It went unnoticed because
                    the product's other two Selects use the same string for value
                    and label, and this picker had only ever seen a PRIMARY
                    calendar — whose id is the account's email address, and so
                    happens to read as a name. */}
                <SelectValue placeholder="Select a calendar">
                  {(value) =>
                    calendars.find((c) => c.id === value)?.summary ?? 'Select a calendar'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {calendars.map((cal) => (
                  <SelectItem key={cal.id} value={cal.id}>
                    {cal.summary}
                    {cal.primary ? ' (main)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => selected && save.mutate(selected)}
              disabled={!selected || save.isPending}
            >
              {save.isPending ? 'Saving…' : 'Use this calendar'}
            </Button>
            {changing && (
              <Button
                variant="outline"
                onClick={() => {
                  setChanging(false)
                  setChoice(null)
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDisconnect}
        onOpenChange={setShowDisconnect}
        title="Disconnect this calendar?"
        description="Your agent will stop checking availability and booking appointments. Existing appointments stay in your calendar."
        confirmLabel="Disconnect"
        variant="destructive"
        onConfirm={async () => {
          await disconnect.mutateAsync()
        }}
      />
    </div>
  )
}
