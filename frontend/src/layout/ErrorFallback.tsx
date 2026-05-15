import { AlertTriangle } from 'lucide-react'
import type { FallbackProps } from 'react-error-boundary'
import { Button } from '@/components/ui/button'

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string') return err
  return 'An unexpected error occurred.'
}

/**
 * Top-level fallback for the App-root ErrorBoundary.
 * Surfaces the error message and offers a recovery path.
 */
export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex max-w-md flex-col items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10">
          <AlertTriangle className="size-5 text-destructive" strokeWidth={1.75} />
        </div>
        <h2 className="text-base font-semibold text-foreground">Something went wrong</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {errorMessage(error)}
        </p>
        <div className="mt-1 flex gap-2">
          <Button onClick={resetErrorBoundary}>Try again</Button>
          <Button variant="outline" onClick={() => window.location.assign('/')}>
            Go home
          </Button>
        </div>
      </div>
    </div>
  )
}
