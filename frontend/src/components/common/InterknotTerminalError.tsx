import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  Clock,
  RefreshCw,
  ServerCrash,
  Terminal,
} from 'lucide-react'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { UidSearchForm } from '@/components/common/UidSearchForm'
import { cn } from '@/lib/utils'

export interface InterknotTerminalErrorProps {
  /** Visual variant: full diagnostic terminal or compact one-line row */
  variant?: 'full' | 'compact'
  /** Error instance or status code */
  error?: unknown
  status?: number
  /** Targeted UID if applicable (for showcase lookup) */
  uid?: string
  /** Targeted query / path if not a UID */
  query?: string
  /** Targeted host name (default: api.enka.network) */
  host?: string
  /** Custom status tag for header */
  statusTag?: string
  /** Custom screen status for CRT monitor */
  screenStatus?: string
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
  /** Custom actions to render in the action panel */
  actions?: React.ReactNode
  className?: string
}

export function InterknotTerminalError({
  variant = 'full',
  error,
  status: explicitStatus,
  uid = '',
  query,
  host,
  statusTag: customStatusTag,
  screenStatus: customScreenStatus,
  onScanUid,
  onRetry,
  isRetrying: propIsRetrying,
  title: customTitle,
  description: customDescription,
  errorCode = '500_ERR',
  actions,
  className,
}: InterknotTerminalErrorProps) {
  const { t } = useTranslation()

  // Determine status code
  let status = explicitStatus
  if (!status && error instanceof ApiError) {
    status = error.status
  }

  // Local state for interactive controls
  const [prevUid, setPrevUid] = useState(uid)
  const [editedUid, setEditedUid] = useState<string | null>(null)
  if (uid !== prevUid) {
    setPrevUid(uid)
    setEditedUid(null)
  }
  const currentUid = editedUid ?? uid

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

  const isUidValid = currentUid.trim().length >= 8

  const handleScanSubmit = (scannedUid: string) => {
    const trimmed = scannedUid.trim()
    if (trimmed.length >= 8) {
      onScanUid?.(trimmed)
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
          'relative w-full overflow-hidden rounded-xl border border-white/[0.08] bg-card/90 shadow-md backdrop-blur-xl',
          className,
        )}
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:px-4 sm:py-3">
          <div className="flex items-center gap-3">
            <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-subtle shadow-inner overflow-hidden font-mono text-[10px] font-black text-red-400 select-none">
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
          'relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/[0.08] bg-card/90 shadow-2xl backdrop-blur-xl',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b-2 border-black bg-elevated px-4 py-2 select-none">
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
          <div className="grid grid-cols-1 md:grid-cols-[210px_1fr] gap-4 sm:gap-5 md:items-stretch">
            <div className="relative rounded-xl border-2 border-black bg-subtle p-3 shadow-[inset_0_0_15px_rgba(0,0,0,0.9)] overflow-hidden h-full flex flex-col justify-between">
              <div
                className="pointer-events-none absolute inset-0 opacity-15"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, #000 0px, #000 1px, transparent 1px, transparent 3px)',
                }}
              />
              <div className="pointer-events-none absolute -top-6 -left-6 size-24 bg-amber-500/10 rounded-full blur-xl" />

              <div className="relative font-mono text-[11px] leading-snug flex flex-col justify-between h-full space-y-2">
                <div className="space-y-2">
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
                </div>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">QUEUE STATE:</span>
                  <span className="text-amber-400 font-semibold animate-pulse">PAUSED</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between h-full space-y-2.5">
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

          <div className="rounded-xl border-2 border-black bg-subtle p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
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
          'relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/[0.08] bg-card/90 shadow-2xl backdrop-blur-xl',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b-2 border-black bg-elevated px-4 py-2 select-none">
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
          <div className="grid grid-cols-1 md:grid-cols-[210px_1fr] gap-4 sm:gap-5 md:items-stretch">
            <div className="relative rounded-xl border-2 border-black bg-subtle p-3 shadow-[inset_0_0_15px_rgba(0,0,0,0.9)] overflow-hidden h-full flex flex-col justify-between">
              <div
                className="pointer-events-none absolute inset-0 opacity-15"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, #000 0px, #000 1px, transparent 1px, transparent 3px)',
                }}
              />
              <div className="pointer-events-none absolute -top-6 -left-6 size-24 bg-red-500/10 rounded-full blur-xl" />

              <div className="relative font-mono text-[11px] leading-snug flex flex-col justify-between h-full space-y-2">
                <div className="space-y-2">
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
                </div>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">HEALTHCHECK:</span>
                  <span className="text-red-400 font-semibold animate-pulse">FAILING</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between h-full space-y-2.5">
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

          <div className="rounded-xl border-2 border-black bg-subtle p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
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
  // FULL VARIANT: 400 BAD REQUEST (Invalid UID format)
  // ==========================================================================
  if (status === 400) {
    const badReqStatusTag = customStatusTag ?? t('terminalError.badRequest.statusTag')
    const badReqStatusSub = t('terminalError.badRequest.statusSub')
    const badReqScreenStatus = customScreenStatus ?? t('terminalError.badRequest.screenStatus')
    const badReqTitle = customTitle ?? t('terminalError.badRequest.title')
    const badReqDesc = customDescription ?? t('terminalError.badRequest.desc')

    return (
      <div
        role="alert"
        className={cn(
          'relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/[0.08] bg-card/90 shadow-2xl backdrop-blur-xl',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b-2 border-black bg-elevated px-4 py-2 select-none">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-black tracking-wider uppercase text-amber-400">
              <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
              <span>{badReqStatusTag}</span>
            </div>
            <span className="text-white/20">|</span>
            <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
              {badReqStatusSub}
            </span>
          </div>
          <span className="rounded bg-black/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground border border-white/10">
            {t('terminalError.systemOffline')}
          </span>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-[210px_1fr] gap-4 sm:gap-5 md:items-stretch">
            <div className="relative rounded-xl border-2 border-black bg-subtle p-3 shadow-[inset_0_0_15px_rgba(0,0,0,0.9)] overflow-hidden h-full flex flex-col justify-between">
              <div
                className="pointer-events-none absolute inset-0 opacity-15"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, #000 0px, #000 1px, transparent 1px, transparent 3px)',
                }}
              />
              <div className="pointer-events-none absolute -top-6 -left-6 size-24 bg-amber-500/10 rounded-full blur-xl" />

              <div className="relative font-mono text-[11px] leading-snug flex flex-col justify-between h-full space-y-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-white/10 pb-1 text-muted-foreground">
                    <span className="flex items-center gap-1 text-[10px]">
                      <Terminal className="size-3 text-amber-400" />
                      {t('terminalError.diagnostic')}
                    </span>
                    <span className="text-[9px] text-amber-400 font-bold">ERR_FORMAT</span>
                  </div>

                  <div className="space-y-1 text-white/80 text-[10px]">
                    {currentUid ? (
                      <p className="text-muted-foreground">&gt; QUERY: UID_{currentUid}</p>
                    ) : null}
                    <p className="text-muted-foreground">&gt; HOST: api.enka.network</p>
                    <p className="text-amber-300 font-bold">&gt; STATUS: {badReqScreenStatus}</p>
                    <p className="text-[9px] text-white/50 pt-1">&gt; PREFIX: UNRECOGNIZED</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">{t('terminalError.radarScan')}</span>
                  <span className="text-amber-400 font-semibold animate-pulse">{t('terminalError.noMatch')}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between h-full space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="inline-block rounded-[4px_4px_0_4px] bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                    HTTP 400
                  </span>
                  <h3 className="font-heading text-base sm:text-lg font-bold uppercase tracking-wide text-foreground">
                    {badReqTitle}
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {badReqDesc}
                </p>
              </div>

              {/* Action Row: Compact UID Input + Retry */}
              {(onScanUid || onRetry) && (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {onScanUid && (
                    <UidSearchForm
                      uidInput={currentUid}
                      isUidValid={isUidValid}
                      onUidInputChange={(val) => setEditedUid(val)}
                      onScan={handleScanSubmit}
                      placeholder={t('terminalError.correctUidPlaceholder')}
                      searchButtonTitle={t('terminalError.find')}
                      searchButtonAria={t('terminalError.find')}
                      className="w-44 sm:w-48 shrink-0"
                    />
                  )}

                  {onRetry && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-[8px_8px_0_8px] border-2 border-black bg-elevated px-3 text-xs font-semibold cursor-pointer shadow-[inset_0_0_0_1px_var(--border),0_2px_8px_-4px_rgba(0,0,0,0.5)]"
                      onClick={handleRetry}
                      loading={isRetrying}
                    >
                      {!isRetrying && <RefreshCw className="size-3.5 mr-1.5" />}
                      {isRetrying ? t('terminalError.retrying') : t('terminalError.retry')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {!onScanUid && !onRetry && (
            <div className="rounded-xl border-2 border-black bg-subtle p-3.5 sm:p-4 text-xs text-muted-foreground font-mono">
              {t('terminalError.badRequest.waitNote')}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ==========================================================================
  // FULL VARIANT: 404 NOT FOUND (or Default with UID Search)
  // ==========================================================================
  const is404 = status === 404 || !status
  const statusTag = customStatusTag ?? (is404 ? t('terminalError.notFound.statusTag') : t('terminalError.default.statusTag'))
  const statusSub = is404 ? t('terminalError.notFound.statusSub') : t('terminalError.default.statusSub')
  const screenStatus = customScreenStatus ?? (is404 ? t('terminalError.notFound.screenStatus') : t('terminalError.default.screenStatus'))
  const displayTitle = customTitle ?? (is404 ? t('terminalError.notFound.title') : t('terminalError.default.title'))
  const displayDesc = customDescription ?? (is404 ? t('terminalError.notFound.desc') : t('terminalError.default.desc'))

  return (
    <div
      role="alert"
      className={cn(
        'relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/[0.08] bg-card/90 shadow-2xl backdrop-blur-xl',
        className,
      )}
    >
      {/* Top Terminal Status Header */}
      <div className="flex items-center justify-between border-b-2 border-black bg-elevated px-4 py-2 select-none">
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
        <div className="grid grid-cols-1 md:grid-cols-[210px_1fr] gap-4 sm:gap-5 md:items-stretch">
          {/* CRT Monitor Block */}
          <div className="relative rounded-xl border-2 border-black bg-subtle p-3 shadow-[inset_0_0_15px_rgba(0,0,0,0.9)] overflow-hidden h-full flex flex-col justify-between">
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

            <div className="relative font-mono text-[11px] leading-snug flex flex-col justify-between h-full space-y-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-white/10 pb-1 text-muted-foreground">
                  <span className="flex items-center gap-1 text-[10px]">
                    <Terminal className="size-3 text-red-400" />
                    {t('terminalError.diagnostic')}
                  </span>
                  <span className="text-[9px] text-red-400 font-bold">ERR_NULL</span>
                </div>

                <div className="space-y-1 text-white/80 text-[10px]">
                  {query ? (
                    <p className="text-muted-foreground truncate">&gt; QUERY: <span className="text-primary font-bold">{query}</span></p>
                  ) : currentUid ? (
                    <p className="text-muted-foreground">&gt; QUERY: UID_{currentUid}</p>
                  ) : null}
                  <p className="text-muted-foreground">&gt; HOST: {host ?? 'api.enka.network'}</p>
                  <p className="text-red-400 font-bold">&gt; STATUS: {screenStatus}</p>
                  <p className="text-[9px] text-white/50 pt-1">&gt; 0 RECORDS RETURNED</p>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">{t('terminalError.radarScan')}</span>
                <span className="text-amber-400 font-semibold animate-pulse">{t('terminalError.noMatch')}</span>
              </div>
            </div>
          </div>

          {/* Right Text & Primary Message */}
          <div className="flex flex-col justify-between h-full space-y-3">
            <div className="space-y-1.5">
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

            {/* Action Row: Compact UID Input + Retry */}
            {(onScanUid || onRetry) && (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {onScanUid && (
                  <UidSearchForm
                    uidInput={currentUid}
                    isUidValid={isUidValid}
                    onUidInputChange={(val) => setEditedUid(val)}
                    onScan={handleScanSubmit}
                    placeholder={t('terminalError.correctUidPlaceholder')}
                    searchButtonTitle={t('terminalError.find')}
                    searchButtonAria={t('terminalError.find')}
                    className="w-44 sm:w-48 shrink-0"
                  />
                )}

                {onRetry && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-[8px_8px_0_8px] border-2 border-black bg-elevated px-3 text-xs font-semibold cursor-pointer shadow-[inset_0_0_0_1px_var(--border),0_2px_8px_-4px_rgba(0,0,0,0.5)]"
                    onClick={handleRetry}
                    loading={isRetrying}
                  >
                    {!isRetrying && <RefreshCw className="size-3.5 mr-1.5" />}
                    {isRetrying ? t('terminalError.retrying') : t('terminalError.retry')}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {actions && (
          <div className="rounded-xl border-2 border-black bg-subtle p-3.5 sm:p-4 flex flex-wrap items-center justify-center gap-3 w-full">
            {actions}
          </div>
        )}

        {!onScanUid && !onRetry && !actions && (
          <div className="rounded-xl border-2 border-black bg-subtle p-3.5 sm:p-4 text-xs text-muted-foreground font-mono">
            {t('terminalError.notFound.waitNote')}
          </div>
        )}
      </div>
    </div>
  )
}
