import { useQuery } from '@tanstack/react-query'
import { useUser } from '@clerk/react'
import { Calendar } from 'lucide-react'
import type { AppointmentItem } from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { PageContainer } from '@/layout/PageContainer'
import { EmptyState } from '@/layout/EmptyState'
import { keys, fetchers } from '@/lib/queries'
import { formatPhone, formatDateTime } from '@/lib/formatters'
import { appointmentStatusConfig } from '@/lib/status-config'

export default function AppointmentsPage() {
  const { user } = useUser()
  const { data, isLoading } = useQuery({
    queryKey: keys.appointments,
    queryFn: fetchers.appointments,
  })

  const appointments = data ?? []

  async function connectGoogleCalendar() {
    const googleAccount = user?.externalAccounts.find((a) => a.provider === 'google')
    if (googleAccount) {
      await googleAccount.reauthorize({
        additionalScopes: ['https://www.googleapis.com/auth/calendar'],
        redirectUrl: `${window.location.origin}/sso-callback?returnTo=/appointments`,
      })
    } else {
      await user?.createExternalAccount({
        strategy: 'oauth_google',
        redirectUrl: `${window.location.origin}/sso-callback?returnTo=/appointments`,
        additionalScopes: ['https://www.googleapis.com/auth/calendar'],
      })
    }
  }

  return (
    <PageContainer size="page" className="flex flex-col flex-1">
      {!isLoading && appointments.length === 0 && (
        <EmptyState
          icon={Calendar}
          title="No appointments yet"
          description="When your agent books appointments through Google Calendar, they'll appear here."
          action={
            <Button onClick={connectGoogleCalendar}>
              <Calendar className="size-3.5" />
              Connect Google Calendar
            </Button>
          }
        />
      )}

      {!isLoading && appointments.length > 0 && (
        <div>
          <div className="grid grid-cols-[1fr_150px_200px_110px] gap-5 px-2.5 pb-2 text-sm text-muted-foreground">
            <div>Service</div>
            <div>Caller</div>
            <div>Date &amp; time</div>
            <div className="justify-self-end">Status</div>
          </div>
          {appointments.map((a: AppointmentItem) => (
            <div
              key={a.id}
              className="grid h-12 grid-cols-[1fr_150px_200px_110px] items-center gap-5 border-t border-border px-2.5"
            >
              <span className="truncate text-sm font-medium text-foreground">{a.service}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {a.callerPhone ? formatPhone(a.callerPhone) : 'Withheld'}
              </span>
              <span className="text-sm text-muted-foreground">
                {a.startTime ? formatDateTime(a.startTime) : 'Time to be confirmed'}
              </span>
              <span className="justify-self-end">
                <StatusBadge value={a.status} config={appointmentStatusConfig} />
              </span>
            </div>
          ))}
        </div>
      )}

    </PageContainer>
  )
}
