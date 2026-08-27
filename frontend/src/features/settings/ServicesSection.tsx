import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { Service, ServiceDraft } from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import { Table, TableBody } from '@/components/ui/table'
import { apiClient } from '@/lib/apiClient'
import { keys } from '@/lib/queries'
import { ServiceRow, ServiceCaptions, emptyService } from './ServiceRow'

/**
 * A row being edited: an existing service still carries its id, a new one does
 * not. That distinction is the whole point — see the save handler.
 */
type Row = ServiceDraft & { id?: string }

const toRow = (s: Service): Row => ({ ...s })

function isChanged(row: Row, original: Service): boolean {
  return (
    row.name !== original.name ||
    row.price !== original.price ||
    (row.description ?? '') !== (original.description ?? '') ||
    row.durationMinutes !== original.durationMinutes ||
    row.bufferBeforeMinutes !== original.bufferBeforeMinutes ||
    row.bufferAfterMinutes !== original.bufferAfterMinutes
  )
}

/**
 * Services, saved as a diff rather than a wholesale replace.
 *
 * The tempting shortcut is to delete everything and re-insert the list on every
 * save. It would be wrong: services have permanent ids and appointments point at
 * them, so re-inserting hands every service a new id and quietly detaches every
 * booking ever made against it. Editing a price must not sever the record of
 * what somebody booked — they are still turning up for it.
 *
 * So: existing rows that changed are PATCHed, new rows are POSTed, and rows the
 * user removed are DELETEd. Untouched rows are not written at all.
 */
export function ServicesSection({ services }: { services: Service[] }) {
  const qc = useQueryClient()
  const [rows, setRows] = useState<Row[]>(() => services.map(toRow))

  const save = useMutation({
    mutationFn: async () => {
      const original = new Map(services.map((s) => [s.id, s]))
      const surviving = new Set(rows.map((r) => r.id).filter(Boolean) as string[])

      const removed = services.filter((s) => !surviving.has(s.id))
      const added = rows.filter((r) => !r.id && r.name.trim())
      const edited = rows.filter((r) => {
        const before = r.id ? original.get(r.id) : undefined
        return before && isChanged(r, before)
      })

      // Deletes first: a rename that reuses a deleted service's name should not
      // collide with the row on its way out.
      await Promise.all(
        removed.map((s) => apiClient.delete(`/admin/services/${s.id}`)),
      )
      await Promise.all([
        ...edited.map((r) => apiClient.patch(`/admin/services/${r.id}`, stripId(r))),
        ...added.map((r) => apiClient.post('/admin/services', stripId(r))),
      ])
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keys.settings })
      toast.success('Services saved')
    },
    onError: () => toast.error('Could not save services. Try again.'),
  })

  function update(index: number, patch: Partial<ServiceDraft>) {
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function remove(index: number) {
    setRows((rs) => rs.filter((_, i) => i !== index))
  }

  const unnamed = rows.some((r) => !r.name.trim())

  return (
    <div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No services yet. Your agent needs these to quote prices and work out how
          long a booking takes.
        </p>
      ) : (
        <Table>
          <ServiceCaptions />
          <TableBody>
            {rows.map((row, i) => (
              <ServiceRow
                key={row.id ?? `new-${i}`}
                service={row}
                onChange={(patch) => update(i, patch)}
                onRemove={() => remove(i)}
              />
            ))}
          </TableBody>
        </Table>
      )}

      <p className="mt-3 text-sm text-muted-foreground">
        Minutes. Setup and cleanup block your calendar; callers never hear them.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRows((rs) => [...rs, emptyService()])}
        >
          <Plus className="size-3.5" />
          Add service
        </Button>
        <div className="flex-1" />
        {unnamed && (
          <p className="text-sm text-muted-foreground">Every service needs a name.</p>
        )}
        <Button onClick={() => save.mutate()} disabled={save.isPending || unnamed}>
          {save.isPending ? 'Saving…' : 'Save services'}
        </Button>
      </div>
    </div>
  )
}

function stripId(row: Row): ServiceDraft {
  const { id: _id, ...draft } = row
  return draft
}
