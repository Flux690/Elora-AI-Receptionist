import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Calendar } from 'lucide-react'
import type { AppointmentItem } from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
        <Table>
          {/* Headings are labels, not a heading — no rule beneath them. The
              rules in here separate rows, which is the one job they have. */}
          <TableHeader className="[&_tr]:border-b-0">
            <TableRow className="border-b-0 hover:bg-transparent">
              <TableHead className="h-auto px-2.5 pb-2">Service</TableHead>
              <TableHead className="h-auto w-[150px] px-2.5 pb-2">Caller</TableHead>
              <TableHead className="h-auto w-[200px] px-2.5 pb-2">Date &amp; time</TableHead>
              <TableHead className="h-auto w-[110px] px-2.5 pb-2 text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.map((a: AppointmentItem) => (
              <TableRow
                key={a.id}
                className="h-12 border-t border-b-0 border-border hover:bg-transparent"
              >
                <TableCell className="max-w-0 truncate px-2.5 py-0 font-medium text-foreground">
                  {a.service}
                </TableCell>
                <TableCell className="px-2.5 py-0 text-muted-foreground tabular-nums">
                  {a.callerPhone ? formatPhone(a.callerPhone) : 'Withheld'}
                </TableCell>
                <TableCell className="px-2.5 py-0 text-muted-foreground">
                  {a.startTime ? formatDateTime(a.startTime) : 'Time to be confirmed'}
                </TableCell>
                <TableCell className="px-2.5 py-0 text-right">
                  <StatusBadge value={a.status} config={appointmentStatusConfig} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

    </PageContainer>
  )
}
