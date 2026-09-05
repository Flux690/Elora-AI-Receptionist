import { useCallback, useState } from 'react'
import { flushSync } from 'react-dom'

/**
 * The drawer outlives the record it edits: clearing in the same tick as the close
 * unmounts the Sheet mid-transition and the panel vanishes rather than slides.
 */
export function useRecordDraft<T>() {
  const [draft, setDraft] = useState<T | null>(null)
  const [open, setOpen] = useState(false)

  /**
   * `flushSync` commits the mount, so Base UI sees `open` go false to true while
   * mounted. A deferred frame never arrives in a tab that is not rendering.
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
