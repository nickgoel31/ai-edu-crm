"use client"

import * as React from "react"
import { cn } from "cn"
import {
  composeRenderProps,
  Input as InputPrimitive,
} from "react-aria-components"

function Input({
  className,
  type,
  ...props
}: React.ComponentProps<typeof InputPrimitive>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={composeRenderProps(className, (className) =>
        cn(
          "h-9 w-full min-w-0 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/30",
          className
        )
      )}
      {...props}
    />
  )
}

export { Input }
