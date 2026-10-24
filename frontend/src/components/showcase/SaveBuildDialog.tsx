import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/client'
import { useMe, useSaveBuild } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { agentRoleCircleUrl } from '@/lib/agent-icons'
import { cn } from '@/lib/utils'
import type { Agent, GameAccount } from '@/types'

const DEFAULT_MAX_BUILDS_PER_AGENT = 10

export interface SaveBuildDialogProps {
  agent: Agent | null
  targetAccount: GameAccount
  existingBuildsCount: number
  onSaved?: (agent: Agent) => void
  onOpenChange: (open: boolean) => void
  open?: boolean
}

export function SaveBuildDialog({
  agent,
  targetAccount,
  existingBuildsCount,
  onSaved,
  onOpenChange,
  open = true,
}: SaveBuildDialogProps) {
  const { t } = useTranslation()
  const { data: me } = useMe()
  const saveMutation = useSaveBuild()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const isSubmitting = saveMutation.isPending
  const isNameEmpty = name.trim().length === 0

  if (!agent) return null

  const maxBuilds = me?.limits?.max_builds_per_agent ?? DEFAULT_MAX_BUILDS_PER_AGENT
  const isLimitReached = existingBuildsCount >= maxBuilds

  function handleSave() {
    const finalName = name.trim()
    if (isLimitReached || !agent || !finalName) return
    const finalDesc = description.trim() || null

    saveMutation.mutate(
      {
        game_account_id: targetAccount.id,
        raw_agent_payload: agent,
        name: finalName,
        description: finalDesc,
      },
      {
        onSuccess: () => {
          setName('')
          setDescription('')
          onSaved?.(agent)
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
          noValidate
          className="space-y-4"
        >
          {/* Header with subtle agent circle */}
          <DialogHeader className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <img
                src={agentRoleCircleUrl(agent.id) || agent.splash_art_url}
                alt={agent.name}
                className="size-7 rounded-full border border-border/70 bg-muted/30 object-cover shrink-0"
              />
              <DialogTitle className="text-base font-heading tracking-wide">
                {t('saveBuild.title', { name: agent.name })}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground leading-normal">
              {t('saveBuild.description')}
            </DialogDescription>
          </DialogHeader>

          {/* Compact Account & Builds Quota Card */}
          <div className="rounded-xl border border-border/60 bg-card/60 px-3.5 py-2.5 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground whitespace-nowrap">{t('saveBuild.accountLabel')}</span>
              <div className="flex items-center gap-2 font-mono whitespace-nowrap">
                <span className="font-bold text-foreground">{targetAccount.uid}</span>
                <span className="rounded bg-subtle px-1.5 py-0.5 text-[11px] text-muted-foreground font-sans">
                  {targetAccount.region}
                </span>
              </div>
            </div>

            <div className="h-px bg-border/40" />

            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground whitespace-nowrap">{t('saveBuild.buildsCount')}</span>
              <span
                className={cn(
                  'font-mono font-bold whitespace-nowrap',
                  isLimitReached ? 'text-destructive' : 'text-primary',
                )}
              >
                {`${existingBuildsCount} / ${maxBuilds}`}
              </span>
            </div>
          </div>

          {/* Body: Form or Limit Reached Alert */}
          {isLimitReached ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">{t('saveBuild.limitReachedTitle', { count: existingBuildsCount, max: maxBuilds })}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t('saveBuild.limitReachedDesc', { name: agent.name, count: existingBuildsCount, max: maxBuilds })}{' '}
                  <Link to="/roster" className="underline font-medium text-foreground hover:text-primary">
                    {t('nav.roster')}
                  </Link>
                  .
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Build Name */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="save-build-name" className="text-xs font-medium">
                    {t('saveBuild.nameLabel')}
                  </Label>
                  <span className="font-mono text-[11px] text-muted-foreground/60 whitespace-nowrap">
                    {`${name.length} / 100`}
                  </span>
                </div>

                <div className="relative">
                  <Input
                    id="save-build-name"
                    autoFocus
                    placeholder={t('saveBuild.namePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    className={cn('h-9 text-xs', name && 'pr-8')}
                  />
                  {name && (
                    <button
                      type="button"
                      onClick={() => setName('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                      title="Очистить"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                {isNameEmpty && (
                  <p className="text-[11px] text-destructive font-medium">
                    {t('saveBuild.nameRequiredHint')}
                  </p>
                )}
              </div>

              {/* Description / Notes */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="save-build-desc" className="text-xs font-medium">
                    {t('saveBuild.descLabel')}
                  </Label>
                  <span className="font-mono text-[11px] text-muted-foreground/60 whitespace-nowrap">
                    {`${description.length} / 250`}
                  </span>
                </div>

                <Input
                  id="save-build-desc"
                  placeholder={t('saveBuild.descPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={250}
                  className="h-9 text-xs"
                />
              </div>

              {saveMutation.isError && (
                <p className="text-xs text-destructive font-medium" role="alert">
                  {saveMutation.error instanceof ApiError
                    ? saveMutation.error.message
                    : t('saveBuild.error')}
                </p>
              )}
            </div>
          )}

          {/* Footer */}
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {isLimitReached ? t('saveBuild.close') : t('saveBuild.cancel')}
            </Button>
            {!isLimitReached && (
              <Button
                type="submit"
                size="sm"
                disabled={isNameEmpty}
                loading={isSubmitting}
              >
                {t('saveBuild.submit')}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
