import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

/**
 * A setting that is on or off, and takes effect the moment it moves.
 *
 * A switch is a labelled state (`role="switch"`, `aria-checked`) rather than a
 * pressed button, and a screen reader announces it accordingly.
 *
 * 30x20, fully rounded. The accent appears only in the on state: an off switch
 * is a neutral track, and its edge is what makes it visible at rest.
 */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-[30px] shrink-0 items-center rounded-full border-[0.5px] border-input bg-sunk p-px transition-colors outline-none",
        "data-[checked]:border-transparent data-[checked]:bg-primary",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        data-on-accent=""
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-white shadow-low transition-transform",
          "data-[checked]:size-[18px] data-[checked]:translate-x-[10px]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
