import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/client'
import { useConfirmVerification, useStartVerification } from '@/api/hooks'
import { toast } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import type { GameAccount, Region, VerificationChallengeResponse } from '@/types'

export interface VerifyUidDialogProps {
  account?: GameAccount
  uid?: string
  region?: Region
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (account: GameAccount) => void
}

export function VerifyUidDialog({
  account,
  uid,
  region,
  open,
  onOpenChange,
  onSuccess,
}: VerifyUidDialogProps) {
  const { t } = useTranslation()
  const startMutation = useStartVerification()
  const confirmMutation = useConfirmVerification()

  const [challenge, setChallenge] = useState<VerificationChallengeResponse | null>(null)
  const [copied, setCopied] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null)
  const startMutate = startMutation.mutate

  const targetUid = uid || account?.uid || ''
  const targetRegion = region || account?.region
  const verifyTarget = useMemo(
    () => (account?.id ? account.id : { uid: targetUid, region: targetRegion }),
    [account, targetUid, targetRegion],
  )

  // Fetch challenge when opened
  useEffect(() => {
    if (!open || !targetUid) {
      return
    }

    startMutate(verifyTarget, {
      onSuccess: (data) => {
        setChallenge(data)
      },
    })
  }, [open, targetUid, verifyTarget, startMutate])

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [cooldown])

  // Cleanup copy timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  async function handleCopy() {
    if (!challenge?.code) return
    try {
      await navigator.clipboard.writeText(challenge.code)
      setCopied(true)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
      toast.success(t('settings.codeCopied'))
    } catch {
      // clipboard access error ignored
    }
  }

  function handleConfirm() {
    if (cooldown > 0 || confirmMutation.isPending || !targetUid) return

    confirmMutation.mutate(verifyTarget, {
      onSuccess: (updated) => {
        onSuccess?.(updated)
        onOpenChange(false)
      },
      onError: () => {
        setCooldown(30)
      },
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setChallenge(null)
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="w-[calc(100vw-32px)] sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-base font-heading">
            {t('settings.verifyDialogTitle')}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-0.5">
            {t('settings.verifyDialogDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {startMutation.isPending && !challenge ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Spinner size="md" color="primary" />
              <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
            </div>
          ) : startMutation.isError && !challenge ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <p className="text-xs text-destructive font-medium">
                {startMutation.error instanceof ApiError
                  ? startMutation.error.message
                  : t('settings.verifyError')}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => startMutate(verifyTarget, { onSuccess: (data) => setChallenge(data) })}
              >
                {t('common.retry')}
              </Button>
            </div>
          ) : (
            <>
              {/* Generated Challenge Code Card */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 p-3 sm:p-3.5">
                <div className="min-w-0 space-y-0.5">
                  <span className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    {t('settings.verifyCodeLabel')}
                  </span>
                  <div className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-primary tabular-nums select-all whitespace-nowrap">
                    {challenge?.code || 'PXL-••••'}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="h-8 shrink-0 gap-1.5 border-white/15 bg-white/[0.04] font-mono text-xs font-semibold hover:border-white/25 hover:bg-white/[0.08] active:scale-95 transition-all"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5 text-primary" />
                      <span>{t('settings.codeCopiedShort', t('common.copied'))}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5 opacity-70" />
                      <span>{t('settings.copyCode')}</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Step-by-step Instructions */}
              <ol className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-muted-foreground">
                <li className="flex items-baseline gap-2.5">
                  <span className="font-mono text-[11px] font-bold leading-relaxed text-muted-foreground/60 shrink-0 select-none tabular-nums">
                    01
                  </span>
                  <span className="leading-relaxed">
                    {targetUid
                      ? t('settings.verifyStep1', { uid: targetUid })
                      : t('settings.verifyStep1NoUid')}
                  </span>
                </li>
                <li className="flex items-baseline gap-2.5">
                  <span className="font-mono text-[11px] font-bold leading-relaxed text-muted-foreground/70 shrink-0 select-none tabular-nums">
                    02
                  </span>
                  <span className="leading-relaxed">{t('settings.verifyStep2')}</span>
                </li>
                <li className="flex items-baseline gap-2.5">
                  <span className="font-mono text-[11px] font-bold leading-relaxed text-muted-foreground/70 shrink-0 select-none tabular-nums">
                    03
                  </span>
                  <span className="leading-relaxed">{t('settings.verifyStep3')}</span>
                </li>
              </ol>
            </>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={!challenge || confirmMutation.isPending || cooldown > 0}
            loading={confirmMutation.isPending}
            className="w-full sm:w-auto"
          >
            {cooldown > 0
              ? t('settings.verifyCooldown', { seconds: cooldown })
              : t('settings.verifyCheckButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
