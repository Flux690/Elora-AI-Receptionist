import { useEffect, useState } from 'react'

/**
 * One loading boundary per page.
 *
 * A page whose queries land independently paints in pieces, which reads as
 * jitter rather than progress, and a cold database makes the gaps long enough to
 * watch. This holds the skeleton until everything the page needs has settled,
 * then renders once.
 *
 * The skeleton itself waits 200ms before appearing, so a warm load goes straight
 * to content instead of flashing one.
 */
export function usePageReady(pending: boolean, delay = 200): {
  ready: boolean
  showSkeleton: boolean
} {
  const [waited, setWaited] = useState(false)

  useEffect(() => {
    if (!pending) return
    setWaited(false)
    const timer = setTimeout(() => setWaited(true), delay)
    return () => clearTimeout(timer)
  }, [pending, delay])

  return { ready: !pending, showSkeleton: pending && waited }
}
