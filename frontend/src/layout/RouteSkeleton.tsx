import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer } from './PageContainer'

/** Suspense fallback for a lazy route. Matches the page shell so nothing jumps. */
export function RouteSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-2 h-5 w-72" />
      <div className="mt-7 flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </PageContainer>
  )
}
