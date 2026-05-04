import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { keys, fetchers } from '@/lib/queries'
import { apiClient } from '@/lib/apiClient'

export default function Knowledge() {
  const qc = useQueryClient()
  const { data: items = [], isLoading } = useQuery({
    queryKey: keys.knowledge,
    queryFn: fetchers.knowledge,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/knowledge/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.knowledge }),
  })

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Question</TableHead>
            <TableHead>Answer</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          )}
          {!isLoading && items.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                No knowledge items yet. Resolve escalations to add entries.
              </TableCell>
            </TableRow>
          )}
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="align-top font-medium">{item.question}</TableCell>
              <TableCell className="align-top text-muted-foreground">{item.answer}</TableCell>
              <TableCell className="align-top">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(item.id)}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
