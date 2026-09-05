import { useInfiniteQuery } from '@tanstack/react-query'
import { keys, fetchers } from '@/lib/queries'

const PAGE_SIZE = 25

export function useCallsQuery() {
  return useInfiniteQuery({
    queryKey: keys.calls(),
    queryFn: ({ pageParam }) =>
      fetchers.calls({ limit: PAGE_SIZE, offset: pageParam as number }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
  })
}
