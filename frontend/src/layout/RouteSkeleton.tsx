import { Skeleton } from '@/components/ui/skeleton'

/**
 * Generic Suspense fallback for lazy-loaded routes.
 * Mimics page-shell density so chunk-load doesn't flash blank.
 */
export function RouteSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <Skeleton className="mb-6 h-7 w-48" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
}
