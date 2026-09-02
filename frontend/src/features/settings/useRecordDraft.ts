import { useCallback, useState } from 'react'
import { flushSync } from 'react-dom'

/**
 * The drawer has to outlive the record it edits. Base UI holds the panel in the
 * DOM while it animates out, so clearing the record in the same tick as the
 * close unmounts the Sheet mid-transition and the panel vanishes rather than
 * slides. `close` starts the exit; `clear` runs when it has finished.
 */
export function useRecordDraft<T>() {
  const [draft, setDraft] = useState<T | null>(null)
  const [open, setOpen] = useState(false)

  /**
   * Open the drawer on a record. Base UI can only play the enter transition if
   * it sees `open` go false -> true while mounted, and setting both in one
   * render mounts the panel already open, so it appears rather than slides.
   * `flushSync` commits the mount now. Deferring the open to a frame instead
   * works, right up until the tab is not being rendered — then no frame ever
   * arrives, the click does nothing, and the drawer springs open later.
   */
  const edit = useCallback((value: T) => {
    flushSync(() => setDraft(value))
    setOpen(true)
  }, [])

  /** Change the record being edited. */
  const patch = useCallback(
    (next: (value: T) => T) => setDraft((d) => (d === null ? d : next(d))),
    [],
  )

  /** Start the exit. The record survives until the panel has slid away. */
  const close = useCallback(() => setOpen(false), [])

  /** Drop it at once, with no exit — for a re-seed or a discard. */
  const reset = useCallback(() => {
    setOpen(false)
    setDraft(null)
  }, [])

  /** Wire to RecordDrawer's `onClosed`. */
  const clear = useCallback(() => setDraft(null), [])

  return { draft, open, edit, patch, close, reset, clear }
}
