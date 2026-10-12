import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  Check,
  Clock,
  Copy,
  RefreshCw,
  Search,
  ServerCrash,
  Terminal,
} from 'lucide-react'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface InterknotTerminalErrorProps {
  /** Visual variant: full diagnostic terminal or compact one-line row */
  variant?: 'full' | 'compact'
  /** Error instance or status code */
  error?: unknown
  status?: number
  /** Targeted UID if applicable (for showcase lookup) */
  uid?: string
  /** Callback when user submits a new/corrected UID */
  onScanUid?: (newUid: string) => void
  /** Retry callback */
  onRetry?: () => void
  /** Loading state during retry */
  isRetrying?: boolean
  /** Custom title override */
  title?: string
  /** Custom description override */
  description?: string
  /** Error code badge string for compact mode */
  errorCode?: string
  className?: string
}

export function InterknotTerminalError({
  variant = 'full',
  error,
  status: explicitStatus,
  uid = '',
  onScanUid,
  onRetry,
  isRetrying: propIsRetrying,
  title: customTitle,
  description: customDescription,
  errorCode = '500_ERR',
  className,
}: InterknotTerminalErrorProps) {
  const { t } = useTranslation()

  // Determine status code
  let status = explicitStatus
  if (!status && error instanceof ApiError) {
    status = error.status
  }

  // Local state for interactive controls
  const [editedUid, setEditedUid] = useState<string | null>(null)
  const currentUid = editedUid ?? uid

  const [copied, setCopied] = useState(false)
  const [localRetrying, setLocalRetrying] = useState(false)

  useEffect(() => {
    if (!localRetrying) return
    const timer = setTimeout(() => setLocalRetrying(false), 800)
    return () => clearTimeout(timer)
  }, [localRetrying])

  const isRetrying = propIsRetrying ?? localRetrying

  const handleRetry = () => {
    if (propIsRetrying === undefined) {
      setLocalRetrying(true)
    }
    onRetry?.()
  }

  const handleCopy = async () => {
    if (!currentUid) return
    try {
      await navigator.clipboard.writeText(currentUid)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore clipboard error
    }
  }

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (currentUid.trim().length >= 8) {
      onScanUid?.(currentUid.trim())
      setEditedUid(null)
    }
  }

  // ==========================================================================
  // COMPACT VARIANT (for lists like Roster & Teams)
  // ==========================================================================
  if (variant === 'compact') {
    const displayTitle = customTitle ?? (error instanceof Error ? error.message : t('terminalError.default.title'))
    const displayDesc = customDescription ?? t('terminalError.compactSub')

    return (
      <div
        role="alert"
        className={cn(
          'relative w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#111620]/90 shadow-md backdrop-blur-xl',
          className,
        )}
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:px-4 sm:py-3">
          <div className="flex items-center gap-3">
            <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-[#090d12] shadow-inner overflow-hidden font-mono text-[10px] font-black text-red-400 select-none">
              <div
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, #000 0px, #000 1px, transparent 1px, transparent 2px)',
                }}
              />
              <Activity className="size-4 animate-pulse text-red-400" />
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="rounded bg-red-500/20 px-1.5 py-0.2 font-mono text-[9px] font-bold text-red-400 border border-red-500/30">
                  {errorCode}
                </span>
                <p className="text-xs sm:text-sm font-heading uppercase tracking-wide text-foreground">
                  {displayTitle}
                </p>
              </div>
              <p className="font-mono text-[11px] text-muted-foreground">
                {displayDesc}
              </p>
            </div>
          </div>

          {onRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-semibold cursor-pointer shrink-0 self-end sm:self-center"
              onClick={handleRetry}
              loading={isRetrying}
            >
              {!isRetrying && <RefreshCw className="size-3 mr-1.5" />}
              {isRetrying ? t('terminalError.loading') : t('terminalError.retry')}
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ==========================================================================
  // FULL VARIANT: 429 RATE LIMIT
  // ==========================================================================
  if (status === 429) {
    return (
      <div
        role="alert"
        className={cn(
          'relative w-full max-w-3xl overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111620]/90 shadow-2xl backdrop-blur-xl',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b-2 border-black bg-[#171e27] px-4 py-2 select-none">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-black tracking-wider uppercase text-amber-400">
              <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
              <span>{t('terminalError.rateLimited.statusTag')}</span>
            </div>
            <span className="text-white/20">|</span>
            <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
              {t('terminalError.rateLimited.statusSub')}
            </span>
          </div>
          <span className="rounded bg-amber-950/40 px-2 py-0.5 font-mono text-[10px] text-amber-300 border border-amber-500/30">
            {t('terminalError.systemThrottled')}
          </span>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-[230px_1fr] gap-4 sm:gap-5 items-start">
            <div className="relative rounded-xl border-2 border-black bg-[#090d12] p-3 shadow-[inset_0_0_15px_rgba(0,0,0,0.9)] overflow-hidden">
              <div
                className="pointer-events-none absolute inset-0 opacity-15"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, #000 0px, #000 1px, transparent 1px, transparent 3px)',
                }}
              />
              <div className="pointer-events-none absolute -top-6 -left-6 size-24 bg-amber-500/10 rounded-full blur-xl" />

              <div className="relative space-y-2 font-mono text-[11px] leading-snug">
                <div className="flex items-center justify-between border-b border-white/10 pb-1 text-muted-foreground">
                  <span className="flex items-center gap-1 text-[10px]">
                    <Clock className="size-3 text-amber-400" />
                    THROTTLE_LOG
                  </span>
                  <span className="text-[9px] text-amber-400 font-bold">{t('terminalError.rateLimited.screenStatus')}</span>
                </div>
                <div className="space-y-1 text-white/80 text-[10px]">
                  <p className="text-muted-foreground">&gt; HOST: api.enka.network</p>
                  <p className="text-amber-300 font-bold">&gt; LIMIT: 30 REQ/MIN</p>
                  <p className="text-muted-foreground">&gt; RESET_IN: ~60s</p>
                  <p className="text-[9px] text-white/50 pt-1">&gt; REASON: IP_BURST</p>
                </div>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">QUEUE STATE:</span>
                  <span className="text-amber-400 font-semibold animate-pulse">PAUSED</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block rounded-[4px_4px_0_4px] bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                    HTTP 429
                  </span>
                  <h3 className="font-heading text-base sm:text-lg font-bold uppercase tracking-wide text-foreground">
                    {customTitle ?? t('terminalError.rateLimited.title')}
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {customDescription ?? t('terminalError.rateLimited.desc')}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1 font-mono text-xs text-muted-foreground">
                <span>{t('terminalError.rateLimited.recommendedWait')}</span>
                <span className="rounded bg-black/40 border border-white/10 px-2 py-0.5 font-bold text-amber-300">
                  {t('terminalError.rateLimited.waitValue')}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border-2 border-black bg-[#151b24] p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground font-mono">
              {t('terminalError.rateLimited.waitNote')}
            </span>
            {onRetry && (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-9 px-4 font-heading text-xs uppercase font-bold tracking-wider cursor-pointer shadow-sm"
                onClick={handleRetry}
                loading={isRetrying}
              >
                {!isRetrying && <RefreshCw className="size-3.5 mr-1.5" />}
                {isRetrying ? t('terminalError.loading') : t('terminalError.retry')}
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ==========================================================================
  // FULL VARIANT: 502 BAD GATEWAY / SERVICE DOWN
  // ==========================================================================
  if (status === 502) {
    return (
      <div
        role="alert"
        className={cn(
          'relative w-full max-w-3xl overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111620]/90 shadow-2xl backdrop-blur-xl',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b-2 border-black bg-[#171e27] px-4 py-2 select-none">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-black tracking-wider uppercase text-red-400">
              <span className="size-2 rounded-full bg-red-500 animate-ping" />
              <span className="size-2 rounded-full bg-red-500 -ml-3.5" />
              <span>{t('terminalError.gatewayError.statusTag')}</span>
            </div>
            <span className="text-white/20">|</span>
            <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
              {t('terminalError.gatewayError.statusSub')}
            </span>
          </div>
          <span className="rounded bg-red-950/40 px-2 py-0.5 font-mono text-[10px] text-red-300 border border-red-500/30">
            {t('terminalError.systemGatewayDown')}
          </span>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-[230px_1fr] gap-4 sm:gap-5 items-start">
            <div className="relative rounded-xl border-2 border-black bg-[#090d12] p-3 shadow-[inset_0_0_15px_rgba(0,0,0,0.9)] overflow-hidden">
              <div
                className="pointer-events-none absolute inset-0 opacity-15"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, #000 0px, #000 1px, transparent 1px, transparent 3px)',
                }}
              />
              <div className="pointer-events-none absolute -top-6 -left-6 size-24 bg-red-500/10 rounded-full blur-xl" />

              <div className="relative space-y-2 font-mono text-[11px] leading-snug">
                <div className="flex items-center justify-between border-b border-white/10 pb-1 text-muted-foreground">
                  <span className="flex items-center gap-1 text-[10px]">
                    <ServerCrash className="size-3 text-red-400" />
                    GW_STATUS
                  </span>
                  <span className="text-[9px] text-red-400 font-bold">{t('terminalError.gatewayError.screenStatus')}</span>
                </div>
                <div className="space-y-1 text-white/80 text-[10px]">
                  <p className="text-muted-foreground">&gt; GATEWAY: enka.network</p>
                  <p className="text-red-400 font-bold">&gt; RESPONSE: 502_BAD_GW</p>
                  <p className="text-muted-foreground">&gt; HOYOVERSE: NO_ACK</p>
                  <p className="text-[9px] text-white/50 pt-1">&gt; RETRY_IN: EXPONENTIAL</p>
                </div>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">HEALTHCHECK:</span>
                  <span className="text-red-400 font-semibold animate-pulse">FAILING</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block rounded-[4px_4px_0_4px] bg-red-500/20 border border-red-500/40 px-2 py-0.5 font-mono text-[10px] font-bold text-red-400">
                    HTTP 502
                  </span>
                  <h3 className="font-heading text-base sm:text-lg font-bold uppercase tracking-wide text-foreground">
                    {customTitle ?? t('terminalError.gatewayError.title')}
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {customDescription ?? t('terminalError.gatewayError.desc')}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1 font-mono text-xs text-muted-foreground">
                <span>{t('terminalError.gatewayError.stateLabel')}</span>
                <span className="text-red-400 font-semibold">{t('terminalError.gatewayError.stateDesc')}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border-2 border-black bg-[#151b24] p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground font-mono">
              {t('terminalError.gatewayError.waitNote')}
            </span>
            {onRetry && (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-9 px-4 font-heading text-xs uppercase font-bold tracking-wider cursor-pointer"
                onClick={handleRetry}
                loading={isRetrying}
              >
                {!isRetrying && <RefreshCw className="size-3.5 mr-1.5" />}
                {isRetrying ? t('terminalError.loading') : t('terminalError.retry')}
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ==========================================================================
  // FULL VARIANT: 404 NOT FOUND (or Default with UID Search)
  // ==========================================================================
  const is404 = status === 404 || !status
  const statusTag = is404 ? t('terminalError.notFound.statusTag') : t('terminalError.default.statusTag')
  const statusSub = is404 ? t('terminalError.notFound.statusSub') : t('terminalError.default.statusSub')
  const screenStatus = is404 ? t('terminalError.notFound.screenStatus') : t('terminalError.default.screenStatus')
  const displayTitle = customTitle ?? (is404 ? t('terminalError.notFound.title') : t('terminalError.default.title'))
  const displayDesc = customDescription ?? (is404 ? t('terminalError.notFound.desc') : t('terminalError.default.desc'))

  return (
    <div
      role="alert"
      className={cn(
        'relative w-full max-w-3xl overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111620]/90 shadow-2xl backdrop-blur-xl',
        className,
      )}
    >
      {/* Top Terminal Status Header */}
      <div className="flex items-center justify-between border-b-2 border-black bg-[#171e27] px-4 py-2 select-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-black tracking-wider uppercase text-red-400">
            <span className="size-2 rounded-full bg-red-500 animate-ping" />
            <span className="size-2 rounded-full bg-red-500 -ml-3.5" />
            <span>{statusTag}</span>
          </div>
          <span className="text-white/20">|</span>
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
            {statusSub}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded bg-black/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground border border-white/10">
            {t('terminalError.systemOffline')}
          </span>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        {/* Main Diagnostic Split: Left CRT Monitor + Right Detailed Info */}
        <div className="grid grid-cols-1 md:grid-cols-[230px_1fr] gap-4 sm:gap-5 items-start">
          {/* CRT Monitor Block */}
          <div className="relative rounded-xl border-2 border-black bg-[#090d12] p-3 shadow-[inset_0_0_15px_rgba(0,0,0,0.9)] overflow-hidden">
            {/* Scanlines Effect */}
            <div
              className="pointer-events-none absolute inset-0 opacity-15"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, #000 0px, #000 1px, transparent 1px, transparent 3px)',
              }}
            />
            {/* Ambient Screen Glow */}
            <div className="pointer-events-none absolute -top-6 -left-6 size-24 bg-red-500/10 rounded-full blur-xl" />

            <div className="relative space-y-2 font-mono text-[11px] leading-snug">
              <div className="flex items-center justify-between border-b border-white/10 pb-1 text-muted-foreground">
                <span className="flex items-center gap-1 text-[10px]">
                  <Terminal className="size-3 text-red-400" />
                  {t('terminalError.diagnostic')}
                </span>
                <span className="text-[9px] text-red-400 font-bold">ERR_NULL</span>
              </div>

              <div className="space-y-1 text-white/80 text-[10px]">
                {currentUid && <p className="text-muted-foreground">&gt; QUERY: UID_{currentUid}</p>}
                <p className="text-muted-foreground">&gt; HOST: api.enka.network</p>
                <p className="text-red-400 font-bold">&gt; STATUS: {screenStatus}</p>
                <p className="text-[9px] text-white/50 pt-1">&gt; 0 RECORDS RETURNED</p>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">{t('terminalError.radarScan')}</span>
                <span className="text-amber-400 font-semibold animate-pulse">{t('terminalError.noMatch')}</span>
              </div>
            </div>
          </div>

          {/* Right Text & Primary Message */}
          <div className="space-y-2.5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-block rounded-[4px_4px_0_4px] bg-red-500/20 border border-red-500/40 px-2 py-0.5 font-mono text-[10px] font-bold text-red-400">
                  {`HTTP ${status ?? 404}`}
                </span>
                <h3 className="font-heading text-base sm:text-lg font-bold uppercase tracking-wide text-foreground">
                  {displayTitle}
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {displayDesc}
              </p>
            </div>

            {/* Quick UID Display & Copy */}
            {currentUid && (
              <div className="flex items-center gap-2 pt-1 font-mono text-xs">
                <span className="text-muted-foreground">{t('terminalError.currentQuery')}</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 rounded bg-black/40 border border-white/10 px-2 py-0.5 text-foreground hover:border-primary/50 hover:text-primary transition-colors cursor-pointer"
                  title={t('terminalError.copyUid')}
                >
                  <span>{currentUid}</span>
                  {copied ? (
                    <Check className="size-3 text-primary" />
                  ) : (
                    <Copy className="size-3 opacity-60" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action Panel: Integrated Inline Search + Retry */}
        <div className="rounded-xl border-2 border-black bg-[#151b24] p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Left: Instant Correction Form */}
            {onScanUid ? (
              <form onSubmit={handleScanSubmit} className="flex-1 flex items-center gap-2 max-w-md">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs select-none">
                    UID:
                  </span>
                  <input
                    type="text"
                    value={currentUid}
                    onChange={(e) => setEditedUid(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder={t('terminalError.correctUidPlaceholder')}
                    className="w-full rounded-[8px_8px_0_8px] border-2 border-black bg-[#0d1117] pl-12 pr-3 py-2 font-mono text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]"
                  />
                </div>

                <Button
                  type="submit"
                  variant="default"
                  disabled={currentUid.length < 8}
                >
                  <Search className="size-3.5" />
                  {t('terminalError.find')}
                </Button>
              </form>
            ) : (
              <div className="flex-1 text-xs text-muted-foreground font-mono">
                {t('terminalError.notFound.waitNote')}
              </div>
            )}

            {/* Right: Retry button with loading spinner */}
            {onRetry && (
              <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 border-white/10 pt-2 sm:pt-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 font-semibold text-xs cursor-pointer"
                  onClick={handleRetry}
                  loading={isRetrying}
                >
                  {!isRetrying && <RefreshCw className="size-3.5 mr-1.5" />}
                  {isRetrying ? t('terminalError.retrying') : t('terminalError.retry')}
                </Button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
