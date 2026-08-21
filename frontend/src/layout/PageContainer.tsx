import { cn } from '@/lib/utils'

type Size = 'page' | 'form'

/**
 * The two measures in the product, and nothing else names a width.
 *
 * `form` is 880px because a settings row has to read as a line of prose —
 * label on the left, control on the right, close enough together that the eye
 * does not have to travel. `page` is a touch wider for lists and tables.
 */
const sizeWidth: Record<Size, string> = {
  page: 'max-w-[900px]',
  form: 'max-w-[880px]',
}

interface PageContainerProps {
  children: React.ReactNode
  className?: string
  size?: Size
}

export function PageContainer({ children, className, size = 'page' }: PageContainerProps) {
  return (
    <div className={cn('mx-auto w-full px-5 py-6', sizeWidth[size], className)}>
      {children}
    </div>
  )
}
