import { useQuery } from '@tanstack/react-query'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
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

export function formatPhoneNumber(raw: string | null): string {
  return formatPhone(raw)
}

export default function Calls() {
  const { data: calls = [], isLoading } = useQuery({
    queryKey: keys.calls,
    queryFn: fetchers.calls,
  })

  return (
    <div className="p-8">
      <h1 className="font-heading text-2xl font-semibold mb-6">Calls</h1>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Caller</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && calls.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No calls yet.
                </TableCell>
              </TableRow>
            )}
            {calls.map((call) => (
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
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
