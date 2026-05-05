import { useEffect } from 'react'
import { useUser } from '@clerk/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ExternalLink, Unlink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { keys, fetchers } from '@/lib/queries'
import { apiClient } from '@/lib/apiClient'
import type { Appointment } from '@/types/api'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar'

function formatPhone(raw: string | null): string {
  if (!raw) return 'Private number'
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return raw
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const statusConfig: Record<Appointment['status'], { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  confirmed: { label: 'Confirmed', variant: 'default' },
  requested: { label: 'Requested', variant: 'secondary' },
  cancelled: { label: 'Cancelled', variant: 'outline' },
}

export default function AppointmentsPage() {
  const { user } = useUser()
  const queryClient = useQueryClient()

  const { data: settings } = useQuery({ queryKey: keys.settings, queryFn: fetchers.settings })
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: keys.appointments,
    queryFn: fetchers.appointments,
  })

  const googleAccount = user?.externalAccounts.find(ea => ea.provider === 'google')
  const hasCalendarScope = googleAccount?.approvedScopes?.includes(CALENDAR_SCOPE)
  const isConnected = !!settings?.googleCalendarId && hasCalendarScope

  const saveMutation = useMutation({
    mutationFn: (patch: { googleCalendarId: string | null }) =>
      apiClient.patch('/admin/settings', patch).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.settings }),
  })

  async function handleDisconnect() {
    await saveMutation.mutateAsync({ googleCalendarId: null })
    await user?.reload()
  }

  // Auto-save after OAuth redirect back: scope granted but no calendarId saved yet
  useEffect(() => {
    if (hasCalendarScope && settings && !settings.googleCalendarId && !saveMutation.isPending) {
      saveMutation.mutate({ googleCalendarId: 'primary' })
    }
  }, [hasCalendarScope, settings?.googleCalendarId])

  async function handleConnect() {
    if (!user) return
    try {
      let result
      if (googleAccount) {
        result = await googleAccount.reauthorize({
          additionalScopes: [CALENDAR_SCOPE],
          redirectUrl: `${window.location.origin}/sso-callback`,
        })
      } else {
        result = await user.createExternalAccount({
          strategy: 'oauth_google',
          redirectUrl: `${window.location.origin}/sso-callback`,
          additionalScopes: [CALENDAR_SCOPE],
        })
      }
      const redirectUrl = result.verification?.externalVerificationRedirectURL
      if (redirectUrl) {
        window.location.href = redirectUrl.href
      } else {
        console.error('[calendar] no redirect URL returned', result)
      }
    } catch (err) {
      console.error('[calendar] connect error:', err)
    }
  }

  if (!isConnected) {
    return (
      <div className="p-8">
        <h1 className="font-heading text-2xl font-semibold mb-8">Appointments</h1>
        <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto gap-5">
          <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CalendarDays className="size-7 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-heading text-lg font-semibold">
              {googleAccount ? 'Grant Calendar Access' : 'Connect Google Calendar'}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {googleAccount
                ? 'Your Google account is linked. Grant calendar access so the AI can check availability and book appointments.'
                : 'Connect your Google Calendar so the AI receptionist can check availability and book appointments directly when callers ask.'}
            </p>
          </div>
          <Button onClick={handleConnect}>
            <CalendarDays className="size-4 mr-2" />
            {googleAccount ? 'Grant Calendar Access' : 'Connect Google Calendar'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">Appointments</h1>
        <div className="flex items-center gap-3">
          {googleAccount?.emailAddress && (
            <span className="text-xs text-muted-foreground border rounded-full px-3 py-1">
              Connected as {googleAccount.emailAddress}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            disabled={saveMutation.isPending}
          >
            <Unlink className="size-4 mr-1.5" />
            Disconnect
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Caller</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading || appointments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  {isLoading ? 'Loading…' : 'No appointments yet.'}
                </TableCell>
              </TableRow>
            ) : (
              appointments.map(appt => {
                const cfg = statusConfig[appt.status]
                return (
                  <TableRow key={appt.id} className="even:bg-muted/30">
                    <TableCell className="font-medium">{formatPhone(appt.callerPhone)}</TableCell>
                    <TableCell>{appt.service}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(appt.startTime)}</TableCell>
                    <TableCell>
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {appt.googleEventId && (
                        <a
                          href={`https://calendar.google.com/calendar/event?eid=${appt.googleEventId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
