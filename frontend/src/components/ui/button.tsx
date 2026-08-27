import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive   [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /* `[a]:hover:` only fired when the button rendered as an anchor, so an
           ordinary primary button had no hover state at all. */
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary",
        /* Rest sits on --control, the lightest rung, so the control is raised
           above the stage rather than the same colour as it. Hover and active
           sink it in two steps. It used to rest on --background — the ground,
           the DARKEST surface — and lighten on hover, which is the movement
           inverted. */
        outline:
          "border-border bg-control shadow-low hover:bg-control-hover active:bg-control-active hover:text-foreground aria-expanded:bg-control-hover aria-expanded:text-foreground",
        /* Fill plus a LIT RING rather than a border — white at 14.3%, which
           composites over whatever it lands on, so one value works at every
           depth where a bordered ring would have to re-derive.

           It is not optional here. On a menu or a dialog the ground is already
           at L 100, so `--control` clamps to white and the fill separates the
           button from nothing at all. The ring is the entire edge. */
        secondary:
          "border-transparent bg-control bg-clip-padding text-secondary-foreground shadow-control hover:bg-control-hover active:bg-control-active aria-expanded:bg-control-hover aria-expanded:text-secondary-foreground",
        /* No fill at rest — a ghost is only a control once you point at it —
           then the same two steps as everything else. */
        ghost:
          "hover:bg-hover active:bg-active hover:text-foreground aria-expanded:bg-hover aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 active:bg-destructive/30 focus-visible:border-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
