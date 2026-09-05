import { useQuery } from '@tanstack/react-query'
import { keys, fetchers } from '@/lib/queries'

/**
 * The business's timezone, which every date in the dashboard is rendered in.
 * Undefined while settings load, which makes `toLocaleString` fall back to the
 * viewer's zone for one frame.
 */
export function useTenantZone(): string | undefined {
  const { data } = useQuery({ queryKey: keys.settings, queryFn: fetchers.settings })
  return data?.business.timezone
}
