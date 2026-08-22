import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface SectionProps {
  title: string
  lede: string
  children: React.ReactNode
  className?: string
}

/**
 * A settings section, laid out as a gutter.
 *
 * The section states itself in a narrow left column and the fields it governs
 * stack on the right. Chosen over a panel of label-left/control-right rows
 * because this product has to explain itself — someone setting up a phone agent
 * for their salon is not a power user — and a left column gives that text a home
 * instead of cramming it under every label.
 *
 * The rule between sections is the only line on the page. Rows do not get one,
 * and neither do the collections inside them.
 */
export function Section({ title, lede, children, className }: SectionProps) {
  return (
    <section
      className={cn(
        'grid grid-cols-[196px_1fr] items-start gap-x-11 border-t border-border py-8',
        'first:border-t-0 first:pt-0',
        className,
      )}
    >
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{lede}</p>
      </div>
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
      {help && <p className="mt-px mb-[7px] text-sm text-muted-foreground">{help}</p>}
      {!help && <div className="h-[7px]" />}
      {children}
    </div>
  )
}
