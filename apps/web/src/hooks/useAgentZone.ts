import { useQuery } from '@tanstack/react-query'
import { keys, fetchers } from '@/lib/queries'

/** The business's timezone. Undefined while settings load, so `toLocaleString`
 *  falls back to the viewer's zone for one frame. */
export function useAgentZone(): string | undefined {
  const { data } = useQuery({ queryKey: keys.settings, queryFn: fetchers.settings })
  return data?.business.timezone
}
