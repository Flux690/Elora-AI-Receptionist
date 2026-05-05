import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Phone, MessageCircleQuestion, CheckCircle, CalendarDays } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

function formatPhone(raw: string | null): string {
  if (!raw) return 'Private number'
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return raw
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function duration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return '—'
  const secs = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

function startOfWeek(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

export default function Overview() {
  const navigate = useNavigate()

  const { data: metrics, isLoading: loadingMetrics } = useQuery({ queryKey: keys.metrics, queryFn: fetchers.metrics })
  const { data: calls = [], isLoading: loadingCalls } = useQuery({ queryKey: keys.calls, queryFn: fetchers.calls })
  const { data: pendingEscalations = [], isLoading: loadingEscalations } = useQuery({
    queryKey: keys.escalations('pending'),
    queryFn: () => fetchers.escalations('pending'),
  })

  const isLoading = loadingMetrics || loadingCalls || loadingEscalations

  const weekStart = startOfWeek()
  const callsThisWeek = calls.filter(c => new Date(c.startedAt) >= weekStart).length
  const answeredByAI = calls.filter(c => c.outcome === 'answered' || c.outcome === 'booked').length
  const recentCalls = calls.slice(0, 5)
  const topPending = pendingEscalations.slice(0, 3)

  const kpis = [
    {
      label: 'Total Calls',
      value: isLoading ? '—' : (metrics?.totalCalls ?? 0),
      icon: Phone,
      description: 'All time',
    },
    {
      label: 'Answered by AI',
      value: isLoading ? '—' : answeredByAI,
      icon: CheckCircle,
      description: 'Handled without escalation',
    },
    {
      label: 'Pending Questions',
      value: isLoading ? '—' : (metrics?.pendingEscalations ?? 0),
      icon: MessageCircleQuestion,
      description: 'Need your answer',
    },
    {
      label: 'Calls This Week',
      value: isLoading ? '—' : callsThisWeek,
      icon: CalendarDays,
      description: 'Since Monday',
    },
  ]

  return (
    <div className="p-8 space-y-8">
      <h1 className="font-heading text-2xl font-semibold">Overview</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, description }) => (
          <Card key={label} className="kpi-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{value}</div>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent calls */}
      <div>
        <h2 className="font-heading text-base font-semibold mb-3">Recent Calls</h2>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caller</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || recentCalls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    {isLoading ? 'Loading…' : 'No calls yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                recentCalls.map(call => (
                  <TableRow key={call.id} className="even:bg-muted/30">
                    <TableCell className="font-medium">{formatPhone(call.callerPhone)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(call.startedAt)}</TableCell>
                    <TableCell className="text-muted-foreground">{duration(call.startedAt, call.endedAt)}</TableCell>
                    <TableCell>
                      <Badge variant={call.outcome === 'answered' || call.outcome === 'booked' ? 'default' : 'secondary'}>
                        {call.outcome ?? '—'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Top pending questions */}
      {topPending.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-base font-semibold">Questions Needing Answers</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/inbox')}>
              View all
            </Button>
          </div>
          <div className="rounded-lg border bg-card divide-y">
            {topPending.map(esc => (
              <div key={esc.id} className="flex items-center gap-4 px-4 py-3">
                <MessageCircleQuestion className="size-4 text-primary shrink-0" />
                <span className="flex-1 text-sm">{esc.question}</span>
                <Button variant="outline" size="sm" onClick={() => navigate('/inbox')}>
                  Answer
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
