import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, ShieldCheck } from 'lucide-react'
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
      <DialogContent className="w-[calc(100vw-32px)] max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary"
            >
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <span>{t('settings.verifyDialogTitle')}</span>
                {targetUid && (
                  <span className="rounded bg-primary/10 border border-primary/30 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                    UID {targetUid}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {t('settings.verifyDialogDesc')}
              </DialogDescription>
            </div>
          </div>
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
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4">
                <div className="space-y-0.5 text-center sm:text-left">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('settings.verifyCodeLabel')}
                  </span>
                  <div className="font-mono text-3xl font-extrabold tracking-widest text-primary tabular-nums select-all">
                    {challenge?.code || 'PXL-••••'}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCopy}
                  className="h-9 gap-2 font-mono text-xs font-bold shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="size-4 text-primary" />
                      <span>{t('settings.codeCopied')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      <span>{t('settings.copyCode')}</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Step-by-step Instructions */}
              <div className="space-y-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 sm:p-4 text-xs text-muted-foreground">
                <div className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] font-bold text-primary">
                    1
                  </span>
                  <span className="leading-relaxed">{t('settings.verifyStep1')}</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] font-bold text-primary">
                    2
                  </span>
                  <span className="leading-relaxed">{t('settings.verifyStep2')}</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] font-bold text-primary">
                    3
                  </span>
                  <span className="leading-relaxed">{t('settings.verifyStep3')}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!challenge || confirmMutation.isPending || cooldown > 0}
            className="w-full sm:w-auto gap-2"
          >
            {confirmMutation.isPending ? (
              <>
                <Spinner size="xs" color="primary" />
                <span>{t('settings.verifyChecking')}</span>
              </>
            ) : cooldown > 0 ? (
              <span>{t('settings.verifyCooldown', { seconds: cooldown })}</span>
            ) : (
              <span>{t('settings.verifyCheckButton')}</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
