import * as React from "react"
import { toast as sonnerToast, Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"

export const ERROR_TOASTER_ID = "error-toaster"

// Intercept toast.error so all error popups automatically target the centered error toaster
const originalError = sonnerToast.error.bind(sonnerToast)
sonnerToast.error = ((
  message: Parameters<typeof originalError>[0],
  data?: Parameters<typeof originalError>[1],
) => {
  return originalError(message, {
    ...data,
    toasterId: data?.toasterId ?? ERROR_TOASTER_ID,
  })
}) as typeof sonnerToast.error

export const toast = sonnerToast

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <>
      {/* Standard top-center toaster for non-error notifications (success, info, warning, loading) */}
      <Sonner
        theme="dark"
        className="toaster group"
        position="top-center"
        icons={{
          success: (
            <CircleCheckIcon className="size-4" />
          ),
          info: (
            <InfoIcon className="size-4" />
          ),
          warning: (
            <TriangleAlertIcon className="size-4" />
          ),
          loading: (
            <Spinner size="xs" color="primary" />
          ),
        }}
        style={
          {
            "--normal-bg": "var(--popover)",
            "--normal-text": "var(--popover-foreground)",
            "--normal-border": "var(--border)",
            "--border-radius": "var(--radius)",
          } as React.CSSProperties
        }
        toastOptions={{
          classNames: {
            toast: "cn-toast",
          },
        }}
        {...props}
      />

      {/* Dedicated centered toaster for all error popups/modals */}
      <Sonner
        id={ERROR_TOASTER_ID}
        theme="dark"
        className="toaster-error-center group"
        position="top-center"
        closeButton
        duration={5000}
        icons={{
          error: (
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/20 text-destructive">
              <OctagonXIcon className="size-4.5" />
            </div>
          ),
        }}
        style={
          {
            "--normal-bg": "#121620",
            "--normal-text": "var(--foreground)",
            "--normal-border": "rgba(224, 45, 27, 0.45)",
            "--border-radius": "var(--radius-card, 20px 20px 0 20px)",
          } as React.CSSProperties
        }
        toastOptions={{
          classNames: {
            toast: "cn-error-toast",
            title: "font-heading text-sm font-bold text-foreground tracking-wide",
            description: "text-xs text-muted-foreground",
            closeButton: "cn-error-close-btn",
          },
        }}
      />
    </>
  )
}

export { Toaster }

