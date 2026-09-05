import { useCallback, useEffect, useRef } from 'react'

/**
 * Re-seeds only when there is nothing to lose, or when a save asks for one. An
 * effect on the server object fires on any refetch and eats unsaved work.
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
