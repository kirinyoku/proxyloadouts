import * as React from "react"
import { toast as sonnerToast, Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, CircleXIcon, InfoIcon, TriangleAlertIcon } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"

export const ERROR_TOASTER_ID = "error-toaster"

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'default'

// Priority hierarchy: higher value = higher urgency/priority
export const TOAST_PRIORITIES: Record<ToastType, number> = {
  error: 4,
  warning: 3,
  success: 2,
  info: 1,
  default: 0,
}

// Adaptive durations by severity (ms)
export const TOAST_DURATIONS: Record<ToastType, number> = {
  error: 5000,
  warning: 4500,
  info: 3500,
  success: 3000,
  default: 4000,
}

// Maximum concurrent toasts allowed on screen to prevent visual overflow
export const MAX_ACTIVE_TOASTS = 4

// Deduplication window in milliseconds
export const DEDUP_WINDOW_MS = 1500

interface QueuedToast {
  id: string | number
  type: ToastType
  message: React.ReactNode
  options?: Parameters<typeof sonnerToast>[1]
  priority: number
  key: string
}

// Keep raw underlying Sonner methods to avoid recursion
const rawToast = sonnerToast
const rawSuccess = sonnerToast.success.bind(sonnerToast)
const rawError = sonnerToast.error.bind(sonnerToast)
const rawWarning = sonnerToast.warning.bind(sonnerToast)
const rawInfo = sonnerToast.info.bind(sonnerToast)
const rawDismiss = sonnerToast.dismiss.bind(sonnerToast)

// Deduplication tracking: key -> { id, timestamp }
const recentToasts = new Map<string, { id: string | number; timestamp: number }>()

// Active toasts tracking: id -> { type, timestamp }
const activeToasts = new Map<string | number, { type: ToastType; timestamp: number }>()

// Queue for collecting synchronous burst triggers
let pendingQueue: QueuedToast[] = []
let isFlushScheduled = false
let toastIdCounter = 1

function cleanStaleToasts() {
  const now = Date.now()
  for (const [key, item] of recentToasts.entries()) {
    if (now - item.timestamp > DEDUP_WINDOW_MS) {
      recentToasts.delete(key)
    }
  }
}

function getToastKey(type: ToastType, message: React.ReactNode): string {
  if (typeof message === 'string' || typeof message === 'number') {
    return `${type}:${message}`
  }
  return ''
}

function enforceMaxActiveLimit() {
  if (activeToasts.size < MAX_ACTIVE_TOASTS) return

  // Find lowest priority active toast to dismiss
  let lowestId: string | number | null = null
  let lowestPriority = Infinity
  let oldestTime = Infinity

  for (const [id, info] of activeToasts.entries()) {
    const priority = TOAST_PRIORITIES[info.type]
    if (priority < lowestPriority || (priority === lowestPriority && info.timestamp < oldestTime)) {
      lowestPriority = priority
      oldestTime = info.timestamp
      lowestId = id
    }
  }

  if (lowestId !== null) {
    activeToasts.delete(lowestId)
    try {
      rawDismiss(lowestId)
    } catch {
      // Ignore dismiss error in non-browser/test envs
    }
  }
}

function executeSonnerCall(type: ToastType, message: React.ReactNode, options: Parameters<typeof sonnerToast>[1]) {
  switch (type) {
    case 'success':
      return rawSuccess(message, options)
    case 'error':
      return rawError(message, options)
    case 'warning':
      return rawWarning(message, options)
    case 'info':
      return rawInfo(message, options)
    default:
      return rawToast(message, options)
  }
}

function flushPendingQueue() {
  isFlushScheduled = false
  if (pendingQueue.length === 0) return

  const items = [...pendingQueue]
  pendingQueue = []

  // Sort burst items by priority ASCENDING so highest priority is dispatched LAST
  // and therefore placed in FRONT in Sonner's stack
  items.sort((a, b) => a.priority - b.priority)

  for (const item of items) {
    enforceMaxActiveLimit()

    const duration = item.options?.duration ?? TOAST_DURATIONS[item.type]
    const finalOptions = {
      ...item.options,
      id: item.id,
      duration,
    }
    if ('toasterId' in finalOptions) {
      delete (finalOptions as Record<string, unknown>).toasterId
    }

    activeToasts.set(item.id, { type: item.type, timestamp: Date.now() })

    if (typeof duration === 'number' && duration > 0 && duration !== Infinity) {
      setTimeout(() => {
        activeToasts.delete(item.id)
      }, duration + 500)
    }

    executeSonnerCall(item.type, item.message, finalOptions)
  }
}

function dispatchSmartToast(
  type: ToastType,
  message: React.ReactNode,
  options?: Parameters<typeof sonnerToast>[1]
): string | number {
  cleanStaleToasts()

  const key = getToastKey(type, message)
  const now = Date.now()

  // 1. Deduplication: if exact same toast was dispatched recently, update it in-place
  if (key && !options?.id) {
    const existing = recentToasts.get(key)
    if (existing && now - existing.timestamp < DEDUP_WINDOW_MS) {
      existing.timestamp = now
      const duration = options?.duration ?? TOAST_DURATIONS[type]
      const updateOptions = { ...options, id: existing.id, duration }
      if ('toasterId' in updateOptions) {
        delete (updateOptions as Record<string, unknown>).toasterId
      }
      executeSonnerCall(type, message, updateOptions)
      return existing.id
    }
  }

  // 2. Determine or generate unique ID
  const id = options?.id ?? `pxl-toast-${toastIdCounter++}`
  if (key) {
    recentToasts.set(key, { id, timestamp: now })
  }

  // 3. Queue for synchronous burst coordination
  pendingQueue.push({
    id,
    type,
    message,
    options,
    priority: TOAST_PRIORITIES[type],
    key,
  })

  if (!isFlushScheduled) {
    isFlushScheduled = true
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(flushPendingQueue)
    } else {
      Promise.resolve().then(flushPendingQueue)
    }
  }

  return id
}

// Smart Toast API facade
type ToastFn = (message: React.ReactNode, data?: Parameters<typeof sonnerToast>[1]) => string | number

interface SmartToastInterface extends ToastFn {
  success: (message: React.ReactNode, data?: Parameters<typeof sonnerToast>[1]) => string | number
  error: (message: React.ReactNode, data?: Parameters<typeof sonnerToast>[1]) => string | number
  warning: (message: React.ReactNode, data?: Parameters<typeof sonnerToast>[1]) => string | number
  info: (message: React.ReactNode, data?: Parameters<typeof sonnerToast>[1]) => string | number
  loading: (message: React.ReactNode, data?: Parameters<typeof sonnerToast>[1]) => string | number
  message: (message: React.ReactNode, data?: Parameters<typeof sonnerToast>[1]) => string | number
  promise: typeof sonnerToast.promise
  custom: typeof sonnerToast.custom
  dismiss: (id?: string | number) => string | number | undefined
  getToasts: typeof sonnerToast.getToasts
  getHistory: typeof sonnerToast.getHistory
}

const smartToast = ((message: React.ReactNode, data?: Parameters<typeof sonnerToast>[1]) => {
  return dispatchSmartToast('default', message, data)
}) as SmartToastInterface

smartToast.success = (message, data) => dispatchSmartToast('success', message, data)
smartToast.error = (message, data) => dispatchSmartToast('error', message, data)
smartToast.warning = (message, data) => dispatchSmartToast('warning', message, data)
smartToast.info = (message, data) => dispatchSmartToast('info', message, data)
smartToast.loading = (message, data) => dispatchSmartToast('default', message, { ...data, duration: data?.duration ?? Infinity })
smartToast.message = (message, data) => dispatchSmartToast('default', message, data)
smartToast.promise = sonnerToast.promise.bind(sonnerToast)
smartToast.custom = sonnerToast.custom.bind(sonnerToast)
smartToast.dismiss = (id?: string | number) => {
  if (id !== undefined) {
    pendingQueue = pendingQueue.filter(item => item.id !== id)
    activeToasts.delete(id)
    for (const [key, item] of recentToasts.entries()) {
      if (item.id === id) recentToasts.delete(key)
    }
  } else {
    pendingQueue = []
    activeToasts.clear()
    recentToasts.clear()
  }
  try {
    return rawDismiss(id)
  } catch {
    return undefined
  }
}
smartToast.getToasts = sonnerToast.getToasts.bind(sonnerToast)
smartToast.getHistory = sonnerToast.getHistory.bind(sonnerToast)

// Assign to sonnerToast for defense-in-depth across direct imports
sonnerToast.error = smartToast.error
sonnerToast.success = smartToast.success
sonnerToast.warning = smartToast.warning
sonnerToast.info = smartToast.info

export const toast = smartToast

const defaultSonnerProps = {
  theme: "dark" as const,
  className: "toaster group",
  position: "top-center" as const,
  closeButton: true,
  visibleToasts: 4,
  expand: false,
  gap: 10,
  icons: {
    success: <CircleCheckIcon className="size-4 shrink-0 text-success" />,
    info: <InfoIcon className="size-4 shrink-0 text-info" />,
    warning: <TriangleAlertIcon className="size-4 shrink-0 text-warning" />,
    error: <CircleXIcon className="size-4 shrink-0 text-destructive" />,
    loading: <Spinner size="xs" color="primary" />,
  },
  style: {
    "--normal-bg": "var(--popover)",
    "--normal-text": "var(--popover-foreground)",
    "--normal-border": "var(--border)",
    "--border-radius": "var(--radius)",
  } as React.CSSProperties,
  toastOptions: {
    classNames: {
      toast: "cn-toast",
    },
  },
}

const Toaster = ({ ...props }: ToasterProps) => {
  return <Sonner {...defaultSonnerProps} {...props} />
}

export { Toaster }


