import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

/**
 * A setting that is on or off — not a Toggle.
 *
 * `Toggle` is a pressed/unpressed button (`aria-pressed`), the shape you want
 * for "bold" in an editor. A switch is a labelled state (`role="switch"`,
 * `aria-checked`) that takes effect the moment it moves. Different semantics,
 * and a screen reader announces them differently.
 *
 * Geometry and colour from the token study: 30×20, fully rounded, and the accent
 * appears ONLY in the on state — an off switch is not a coloured thing, it is a
 * neutral track. The track uses `--sunk`, the row-selected rung, because it has
 * to read as a graphical object against the stage rather than as a surface.
 *
 * Transition is on `background-color` alone at 0.15s. The thumb moves with it,
 * but nothing else about the control animates.
 */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-[30px] shrink-0 items-center rounded-full border border-transparent bg-sunk bg-clip-padding p-px shadow-control transition-colors outline-none",
        "focus-visible:border-ring",
        "data-[checked]:bg-primary data-[checked]:shadow-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-[18px] rounded-full bg-white shadow-low transition-transform",
          "data-[checked]:translate-x-[10px]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
