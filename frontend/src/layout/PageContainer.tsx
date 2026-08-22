import { cn } from '@/lib/utils'

type Size = 'page' | 'form'

/**
 * The two measures in the product, and nothing else names a width.
 *
 * `form` is the settings measure: wide enough for the gutter and the field
 * column beside it, and no wider. `page` is a touch wider for lists and tables.
 */
const sizeWidth: Record<Size, string> = {
  page: 'max-w-[900px]',
  // 840 = a 196px gutter, 44px of air, and 600px of field. Down from 880, which
  // predated the gutter and left fields stretching further than any value in
  // them ever needed.
  form: 'max-w-[840px]',
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
