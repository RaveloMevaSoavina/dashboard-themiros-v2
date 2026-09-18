import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import type * as React from "react"

import { cn } from "@/shared/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "text-muted-foreground ring-1 ring-border ring-inset",
        /* La charte n'autorise aucun accent colore : l'alerte se signale
           par le contraste de l'encre, pas par une teinte. */
        warning:
          "bg-foreground/10 text-foreground ring-1 ring-border ring-inset",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
