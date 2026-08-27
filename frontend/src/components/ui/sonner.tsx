import { Toaster as SonnerToaster } from "sonner"

/**
 * The toast, wearing the product's own tokens.
 *
 * Hand-written on purpose, unlike every other primitive here. The shadcn
 * registry's `sonner` is written for Next: it pulls `useTheme` from
 * `next-themes` and an `IconPlaceholder` from an internal path in shadcn's own
 * docs app, neither of which exists in a Vite build. This is the same component
 * the registry wraps — sonner's own `<Toaster />` — configured rather than
 * reimplemented.
 *
 * Settings follow sonner's author on why the defaults are what they are
 * (emilkowal.ski/ui/building-a-toast-component): 4s before auto-dismiss,
 * swipe-to-dismiss on velocity as well as distance, and hover to pause. All of
 * that is sonner's own behaviour and wants no configuration. `expand` is the
 * one thing the article says to turn on, so a second toast does not hide behind
 * the first.
 */
function Toaster({ ...props }: React.ComponentProps<typeof SonnerToaster>) {
  return (
    <SonnerToaster
      data-ground="menu"
      position="bottom-right"
      /* All toasts visible rather than stacked — the article's one explicit
         recommendation. Stacking looks better and hides what you needed to
         read. */
      expand
      /* The product is light-only. Sonner's default is `light` already, but
         stating it stops the component ever deciding otherwise. */
      theme="light"
      /* The same 10px gutter the stage floats on, so a toast sits on the
         product's margin rather than the library's. */
      offset={10}
      /* No close button.
         A toast here already leaves three ways: it dismisses itself after four
         seconds, it pauses that timer while the pointer is over it, and it can
         be swiped away. An × on top of all that is furniture on a panel that
         was never going to stay. */
      toastOptions={{
        classNames: {
          /* A toast is a menu-depth surface: it takes the menu ground, the
             hairline and the medium shadow, exactly like a dropdown.
             `text-base` is the design system's 16px rung — sonner sets no font
             size of its own on the title or description, so both inherit it.

             The `!` on almost every utility here is load-bearing rather than
             habit. Sonner styles the panel through
             `[data-sonner-toast][data-styled='true']` — two attribute selectors,
             which beats a bare utility class. Without them the radius, the fill,
             the hairline and both ink rungs silently stay sonner's own, and
             because its light defaults are ALSO a white rounded panel the result
             looks right while nothing in it comes from the ladder. Measured, not
             assumed: the title was `#171717` and the description `#3f3f3f`. */
          toast:
            "group rounded-xl! border! border-border! bg-popover! p-4! text-base! text-popover-foreground! shadow-medium!",
          title: "font-medium text-foreground!",
          description: "text-muted-foreground!",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-control text-secondary-foreground shadow-control",
          /* `richColors` is off, which stops sonner painting a green panel for
             a booking and an amber one for a warning. The ICONS are a separate
             path and still carry a hue of their own, so they are pinned here
             too — otherwise the colour this product deliberately removed comes
             back in at 16px.

             Red is the one exception, because red is destructive and destructive
             is the one thing worth a colour. */
          icon: "text-muted-foreground",
          error: "text-destructive [&_[data-icon]]:text-destructive",
          success: "text-foreground",
          warning: "text-foreground",
          info: "text-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
