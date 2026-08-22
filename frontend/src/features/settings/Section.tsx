import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Layout = 'stacked' | 'gutter'

interface SectionProps {
  /**
   * Omit it when the fields already say what they are. A heading reading
   * "Business details" above a field labelled "Business name" is the same
   * sentence twice, and the rule between sections already groups them.
   */
  title?: string
  lede?: string
  /**
   * `stacked` — the heading sits above its fields. The default, and right for a
   * short set of unrelated settings: a name, a description, two numbers.
   *
   * `gutter` — the heading moves into a narrow left column beside the fields.
   * Earns its keep only where the right-hand side is a repeating structure tall
   * enough that a heading above it would scroll out of sight: opening hours,
   * holidays, services, the call phrases. Using it everywhere gave a two-field
   * section the same architecture as a seven-row one.
   */
  layout?: Layout
  children: React.ReactNode
  className?: string
}

export function Section({
  title,
  lede,
  layout = 'stacked',
  children,
  className,
}: SectionProps) {
  const heading = title ? (
    <div className={layout === 'gutter' ? undefined : 'mb-5'}>
      <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      {lede && <p className="mt-1 text-sm text-muted-foreground">{lede}</p>}
    </div>
  ) : (
    // The gutter still needs its left column to exist, or the fields slide into it.
    layout === 'gutter' ? <div /> : null
  )

  return (
    <section
      className={cn(
        // No rule between sections. Space groups them; a line only adds
        // furniture to a page that is already a short list of fields.
        'pb-10 first:pt-0',
        layout === 'gutter' && 'grid grid-cols-[196px_1fr] items-start gap-x-11',
        className,
      )}
    >
      {heading}
      <div className="flex min-w-0 flex-col gap-[18px]">{children}</div>
    </section>
  )
}

interface FieldProps {
  label: string
  /**
   * Always rendered, never behind an icon. A tooltip is a hover nobody performs
   * and touch cannot reach, and it was carrying the only explanation of what
   * these fields did.
   */
  help?: string
  htmlFor?: string
  children: React.ReactNode
}

export function Field({ label, help, htmlFor, children }: FieldProps) {
  return (
    <div className="min-w-0">
      <Label htmlFor={htmlFor} className="block">
        {label}
      </Label>
      {help ? (
        <p className="mt-px mb-[7px] text-sm text-muted-foreground">{help}</p>
      ) : (
        <div className="h-[7px]" />
      )}
      {children}
    </div>
  )
}
