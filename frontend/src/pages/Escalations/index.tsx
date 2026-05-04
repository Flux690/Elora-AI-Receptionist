import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
import type { Escalation } from '@/types/api'
import ResolveDialog from './ResolveDialog'

function EscalationTable({
  escalations,
  isLoading,
  onResolve,
}: {
  escalations: Escalation[]
  isLoading: boolean
  onResolve?: (e: Escalation) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Question</TableHead>
          <TableHead>Status</TableHead>
          {onResolve && <TableHead className="w-28" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading && (
          <TableRow>
            <TableCell colSpan={onResolve ? 3 : 2} className="text-center text-muted-foreground">
              Loading…
            </TableCell>
          </TableRow>
        )}
        {!isLoading && escalations.length === 0 && (
          <TableRow>
            <TableCell colSpan={onResolve ? 3 : 2} className="text-center text-muted-foreground">
              No escalations.
            </TableCell>
          </TableRow>
        )}
        {escalations.map((esc) => (
          <TableRow key={esc.id}>
            <TableCell>{esc.question}</TableCell>
            <TableCell>
              <Badge variant={esc.status === 'pending' ? 'destructive' : 'secondary'}>
                {esc.status}
              </Badge>
            </TableCell>
            {onResolve && (
              <TableCell>
                <Button size="sm" variant="outline" onClick={() => onResolve(esc)}>
                  Resolve
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default function Escalations() {
  const [selected, setSelected] = useState<Escalation | null>(null)

  const pending = useQuery({
    queryKey: keys.escalations('pending'),
    queryFn: () => fetchers.escalations('pending'),
  })

  const resolved = useQuery({
    queryKey: keys.escalations('resolved'),
    queryFn: () => fetchers.escalations('resolved'),
  })

  return (
    <>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">
          <EscalationTable
            escalations={pending.data ?? []}
            isLoading={pending.isLoading}
            onResolve={setSelected}
          />
        </TabsContent>
        <TabsContent value="resolved" className="mt-4">
          <EscalationTable
            escalations={resolved.data ?? []}
            isLoading={resolved.isLoading}
          />
        </TabsContent>
      </Tabs>

      {selected && (
        <ResolveDialog
          escalation={selected}
          open={true}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
