"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface SwitchProps
  extends Omit<React.ComponentProps<"button">, "onChange" | "value"> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
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
  ...props
}: SwitchProps) {
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
        "group/switch relative inline-flex h-6 w-11 shrink-0 items-center rounded-4xl border p-0.5 transition-colors outline-none select-none",
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
          "pointer-events-none block size-5 rounded-4xl shadow-sm transition-transform duration-200 ease-out",
          checked
            ? "translate-x-5 bg-[#111400]"
            : "translate-x-0 bg-white/75"
        )}
      />
    </button>
  )
}

export { Switch }
