"use client"

import * as React from "react"
import { cn } from "cn"
import {
  composeRenderProps,
  TextArea as TextareaPrimitive,
} from "react-aria-components"

function Textarea({
  className,
  ...props
}: React.ComponentProps<typeof TextareaPrimitive>) {
  return (
    <TextareaPrimitive
      data-slot="textarea"
      className={composeRenderProps(className, (className) =>
        cn(
          "flex field-sizing-content min-h-16 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/30",
          className
        )
      )}
      {...props}
    />
  )
}

export { Textarea }
