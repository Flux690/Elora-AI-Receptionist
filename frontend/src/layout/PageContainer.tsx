import { cn } from '@/lib/utils'

type Size = 'page' | 'form'

/**
 * The two measures in the product, and nothing else names a width.
 *
 * `form` is the settings measure: wide enough for the gutter and the field
 * column beside it, and no wider. `page` is a touch wider for lists and tables.
 */
/**
 * Named in `index.css`, not here. Both measures used to be hardcoded at this
 * call site while `--container-page` and `--container-form` sat in the theme
 * unused — and disagreeing, 880 against 840, with neither obviously wrong.
 *
 * `form` is a 196px gutter, 44px of air and 600px of field. `page` is a touch
 * wider for lists and tables.
 */
const sizeWidth: Record<Size, string> = {
  page: 'max-w-page',
  form: 'max-w-form',
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
