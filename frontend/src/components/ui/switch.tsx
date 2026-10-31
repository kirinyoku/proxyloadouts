"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface SwitchProps
  extends Omit<React.ComponentProps<"button">, "onChange" | "value"> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  size?: "default" | "sm"
}

/**
 * Accessible minimalist switch with crisp state feedback.
 *
 * Rendered as a native button carrying `role="switch"` instead of an unmanaged
 * primitive so it stays operable from keyboard and renders deterministically
 * in SSR snapshot testing.
 */
function Switch({
  checked,
  onCheckedChange,
  className,
  disabled,
  size = "default",
  ...props
}: SwitchProps) {
  const isSm = size === "sm"

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-slot="switch"
      data-state={checked ? "checked" : "unchecked"}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "group/switch relative inline-flex shrink-0 items-center rounded-4xl border p-0.5 transition-colors outline-none select-none",
        isSm ? "h-4.5 w-8" : "h-6 w-11",
        "border-white/10 bg-white/[0.08]",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        "focus-visible:ring-2 focus-visible:ring-primary/60",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-4xl shadow-sm transition-transform duration-200 ease-out",
          isSm ? "size-3.5" : "size-5",
          checked
            ? isSm
              ? "translate-x-3.5 bg-primary-foreground"
              : "translate-x-5 bg-primary-foreground"
            : "translate-x-0 bg-white/75"
        )}
      />
    </button>
  )
}

export { Switch }
