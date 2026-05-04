import { useQuery } from '@tanstack/react-query'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { keys, fetchers } from '@/lib/queries'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString()
}

export default function Calls() {
  const { data: calls = [], isLoading } = useQuery({
    queryKey: keys.calls,
    queryFn: fetchers.calls,
  })

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Caller</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Ended</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          )}
          {!isLoading && calls.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No calls yet.
              </TableCell>
            </TableRow>
          )}
          {calls.map((call) => (
            <TableRow key={call.id}>
              <TableCell>{call.callerId ?? 'Unknown'}</TableCell>
              <TableCell>{formatDate(call.startedAt)}</TableCell>
              <TableCell>{call.endedAt ? formatDate(call.endedAt) : '—'}</TableCell>
              <TableCell>{call.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
