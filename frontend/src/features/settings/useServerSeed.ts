import { useCallback, useEffect, useRef } from 'react'

/**
 * Re-seed a settings panel from the server without eating unsaved work.
 *
 * Every panel holds the server's values in local state and has to re-seed after
 * a save, so a newly created row picks up the id it was given and cannot be
 * created twice. The obvious way to do that — an effect on the server object —
 * fires on *any* refetch, and React Query gives a new object identity each time
 * one lands. So a background refetch silently overwrote whatever the owner was
 * part-way through typing: toggling the recording switch (its mutation
 * invalidates the settings query) discarded an unedited greeting, and so did
 * leaving the tab for longer than the five-minute `staleTime` and coming back.
 *
 * A re-seed now happens only when there is nothing to lose, or when our own save
 * asked for one by calling the returned function.
 */
export function useServerSeed(server: unknown, dirty: boolean, seed: () => void) {
  const dirtyRef = useRef(dirty)
  const seedRef = useRef(seed)
  const requested = useRef(false)

  dirtyRef.current = dirty
  seedRef.current = seed

  useEffect(() => {
    if (dirtyRef.current && !requested.current) return
    requested.current = false
    seedRef.current()
  }, [server])

  /** Call from a save's `onSuccess`: the next server value is the one we want. */
  return useCallback(() => {
    requested.current = true
  }, [])
}
