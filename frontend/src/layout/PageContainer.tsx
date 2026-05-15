import { cn } from '@/lib/utils'

type Size = 'sm' | 'md' | 'lg'

const sizeWidth: Record<Size, string> = {
  sm: 'max-w-2xl',
  md: 'max-w-4xl',
  lg: 'max-w-5xl',
}

interface PageContainerProps {
  children: React.ReactNode
  className?: string
  size?: Size
}

/**
 * Standard top-level wrapper for every routed page.
 * Replaces the `mx-auto max-w-... px-8 py-8` repeated across all pages.
 */
export function PageContainer({ children, className, size = 'lg' }: PageContainerProps) {
  return (
    <div className={cn('w-full mx-auto px-8 py-8', sizeWidth[size], className)}>
      {children}
    </div>
  )
}
