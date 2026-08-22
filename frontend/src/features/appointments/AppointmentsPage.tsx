import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Calendar } from 'lucide-react'
import type { AppointmentItem } from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { PageContainer } from '@/layout/PageContainer'
import { PageHeader } from '@/layout/PageHeader'
import { EmptyState } from '@/layout/EmptyState'
import { keys, fetchers } from '@/lib/queries'
import { formatPhone, formatDateTime } from '@/lib/formatters'
import { appointmentStatusConfig } from '@/lib/status-config'

export default function AppointmentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: keys.appointments,
    queryFn: fetchers.appointments,
  })

  const appointments = data ?? []

  return (
    <PageContainer size="page" className="flex flex-col flex-1">
      <PageHeader
        title="Appointments"
        description="Everything your agent has booked, newest first."
      />

      {!isLoading && appointments.length === 0 && (
        <EmptyState
          icon={Calendar}
          title="No appointments yet"
          description="When your agent books appointments through Google Calendar, they'll appear here."
          /* One copy of the connect flow, and it lives where the calendar
             setting lives. This page used to hold a second implementation of
             it that could drift from the real one. */
          action={
            <Button render={<Link to="/settings?tab=business" />} nativeButton={false}>
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
