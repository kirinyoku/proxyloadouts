import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/client'
import { useSaveBuild } from '@/api/hooks'
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
import { cn } from '@/lib/utils'
import type { Agent, GameAccount } from '@/types'

const MAX_BUILDS_PER_AGENT = 5

interface SaveBuildDialogProps {
  agent: Agent | null
  targetAccount: GameAccount
  existingBuildsCount: number
  onSaved?: (agent: Agent) => void
  onOpenChange: (open: boolean) => void
}

export function SaveBuildDialog({
  agent,
  targetAccount,
  existingBuildsCount,
  onSaved,
  onOpenChange,
}: SaveBuildDialogProps) {
  const { t } = useTranslation()
  const saveMutation = useSaveBuild()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  if (!agent) return null

  const isLimitReached = existingBuildsCount >= MAX_BUILDS_PER_AGENT

  function handleSave() {
    if (isLimitReached || !agent) return
    saveMutation.mutate(
      {
        game_account_id: targetAccount.id,
        raw_agent_payload: agent,
        name: name.trim(),
        description: description.trim() || null,
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
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleSave()
          }}
          noValidate
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>
              {t('saveBuild.title', { name: agent.name })}
            </DialogTitle>
            <DialogDescription>
              {t('saveBuild.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5">
            {/* Game account (strictly bound to showcase UID) */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('saveBuild.accountLabel')}</Label>
              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card/80 px-3.5 py-2 text-xs font-mono">
                <span className="font-bold text-foreground">{targetAccount.uid}</span>
                <span className="rounded bg-subtle px-2 py-0.5 text-[11px] text-muted-foreground">
                  {targetAccount.region}
                </span>
              </div>
            </div>

            {/* Agent builds quota counter */}
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-subtle/40 px-3.5 py-2 text-xs">
              <span className="text-muted-foreground">{t('saveBuild.buildsCount')}</span>
              <span
                className={cn(
                  'font-mono font-bold',
                  isLimitReached ? 'text-destructive' : 'text-primary',
                )}
              >
                {existingBuildsCount} / {MAX_BUILDS_PER_AGENT}
              </span>
            </div>

            {isLimitReached && (
              <div className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">{t('saveBuild.limitReachedTitle')}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {t('saveBuild.limitReachedDesc', {
                      name: agent.name,
                    })}{' '}
                    <Link to="/roster" className="underline hover:text-foreground">
                      {t('nav.roster')}
                    </Link>
                    .
                  </p>
                </div>
              </div>
            )}

            {!isLimitReached && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="save-name">{t('saveBuild.nameLabel')}</Label>
                  <Input
                    id="save-name"
                    autoFocus
                    placeholder={t('saveBuild.namePlaceholder')}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={100}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t('saveBuild.nameAutoHint')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="save-description">{t('saveBuild.descLabel')}</Label>
                  <Input
                    id="save-description"
                    placeholder={t('saveBuild.descPlaceholder')}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={250}
                  />
                </div>
              </>
            )}

            {saveMutation.isError && (
              <p className="text-xs text-destructive font-medium" role="alert">
                {saveMutation.error instanceof ApiError
                  ? saveMutation.error.message
                  : t('saveBuild.error')}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {isLimitReached ? t('saveBuild.close') : t('saveBuild.cancel')}
            </Button>
            {!isLimitReached && (
              <Button type="submit" disabled={saveMutation.isPending}>
                {t('saveBuild.submit')}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
