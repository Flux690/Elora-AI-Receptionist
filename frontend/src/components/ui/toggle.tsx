import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Retokenised from the registry default, and restructured in one way that
 * matters: the registry bakes `hover:bg-muted` and `aria-pressed:bg-muted` into
 * the ROOT string, where no variant can override them. Every state fill lives in
 * its variant here instead, which is what lets `pill` and `row` behave like the
 * different things they are.
 *
 * The registry's fills were also `--muted`, which in this product IS the stage —
 * so a hovered toggle on a page painted exactly nothing. And its focus was a 3px
 * ring; focus here is one lit outline that never recolours a border, set once
 * globally in `index.css`.
 */
const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-lg text-sm font-medium whitespace-nowrap transition-all outline-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /* No fill at rest — a ghost is only a control once you point at it. */
        default:
          "bg-transparent hover:bg-hover hover:text-foreground aria-pressed:bg-active data-[state=on]:bg-active",
        outline:
          "border border-border bg-control shadow-low hover:bg-control-hover aria-pressed:bg-control-active data-[state=on]:bg-control-active",
        /* A pill is a CONTROL: it carries a fill and a lit ring at rest, and
           sinks when chosen — the unselected one is the RAISED one. A pressed
           thing loses its lift; carrying the shadow into the selected state
           makes it read as raised and dark at once, which is nothing physical. */
        pill: "rounded-full border border-transparent bg-control bg-clip-padding text-muted-foreground shadow-control hover:bg-control-hover hover:text-foreground aria-pressed:bg-control-active aria-pressed:font-medium aria-pressed:text-foreground aria-pressed:shadow-none data-[state=on]:bg-control-active data-[state=on]:font-medium data-[state=on]:text-foreground data-[state=on]:shadow-none",
        /* A row is not a control: no rest fill at all, so its states are the row
           rungs and its hover travels further to say the same amount. */
        /* A row STACKS and WRAPS. The root string is written for a pill —
           `inline-flex items-center justify-center whitespace-nowrap` — which is
           right for a button with an icon and a word, and wrong for a list row
           carrying a title and a line of metadata. Inheriting it laid the two
           side by side on one unwrapping line, so a long question and a full
           date ran straight out of a 320px column.

           A caller that genuinely wants side-by-side says so: `flex-row` and
           `items-center` are the same Tailwind groups as the defaults here, so a
           className overrides them. See `PhoneStep`. */
        row: "w-full flex-col items-start justify-start whitespace-normal bg-transparent text-left font-normal hover:bg-hover aria-pressed:bg-active data-[state=on]:bg-active",
      },
      size: {
        default:
          "h-8 min-w-8 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        sm: "h-7 min-w-7 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 min-w-9 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        /* A row sizes to its own content rather than to a control's rhythm. */
        row: "h-auto min-w-0 px-3 py-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
