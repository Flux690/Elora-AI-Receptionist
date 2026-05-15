import { useQuery } from '@tanstack/react-query'
import { useUser } from '@clerk/react'
import { Calendar } from 'lucide-react'
import type { AppointmentItem } from '@receptionist/shared'
import { Card } from '@/components/ui/card'
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
    <PageContainer size="md" className="flex flex-col flex-1">
      <h1 className="mb-6 text-lg font-semibold text-foreground">Appointments</h1>

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
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-sm font-medium text-muted-foreground">Service</TableHead>
                <TableHead className="text-sm font-medium text-muted-foreground">Caller</TableHead>
                <TableHead className="text-sm font-medium text-muted-foreground">Date / Time</TableHead>
                <TableHead className="text-sm font-medium text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.map((a: AppointmentItem) => (
                <TableRow key={a.id}>
                  <TableCell className="text-sm font-medium text-foreground">{a.service}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatPhone(a.callerPhone)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {a.startTime ? formatDateTime(a.startTime) : 'Time TBD'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={a.status} config={appointmentStatusConfig} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </PageContainer>
  )
}
