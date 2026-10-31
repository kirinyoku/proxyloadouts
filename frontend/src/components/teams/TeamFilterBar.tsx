import { useEffect, useRef, useState } from 'react'
import { ArrowDownAZ, ArrowUpDown, Check, Globe, Lock, Plus, Search, Share2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { createTeamsShare, revokeTeamsShare } from '@/api/client'
import { RevokeShareDialog } from '@/components/roster/RevokeShareDialog'
import { useShareStatus } from '@/components/roster/useShareStatus'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/sonner'
import type { GameAccount } from '@/types'

export type TeamSortOption = 'newest' | 'oldest' | 'name'

interface TeamFilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  sortBy: TeamSortOption
  onSortChange: (sort: TeamSortOption) => void
  totalCount?: number
  maxTeams?: number
  activeAccount?: GameAccount | null
  isPublicTeams?: boolean
  onTogglePublicTeams?: () => void
  isUpdatingVisibility?: boolean
}

export function TeamFilterBar({
  search,
  onSearchChange,
  sortBy,
  onSortChange,
  totalCount = 0,
  maxTeams = 100,
  activeAccount,
  isPublicTeams,
  onTogglePublicTeams,
  isUpdatingVisibility,
}: TeamFilterBarProps) {
  const { t } = useTranslation()
  const isMaxTeams = totalCount >= maxTeams
  const [teamsLinkCopied, setTeamsLinkCopied] = useState(false)
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const shareStatus = useShareStatus('teams', activeAccount?.id)
  const linkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (linkTimerRef.current) clearTimeout(linkTimerRef.current)
    }
  }, [])

  async function handleCopyTeamsLink() {
    if (!activeAccount?.id) return
    try {
      const { token } = await createTeamsShare(activeAccount.id)
      shareStatus.setActive(true)
      const url = `${window.location.origin}/shared/squads/${encodeURIComponent(token)}`
      await navigator.clipboard.writeText(url)
      setTeamsLinkCopied(true)
      if (linkTimerRef.current) clearTimeout(linkTimerRef.current)
      linkTimerRef.current = setTimeout(() => setTeamsLinkCopied(false), 2000)
      toast.success(t('sharing.linkCopied'))
    } catch {
      toast.error(t('sharing.copyError'))
    }
  }

  async function handleRevokeTeamsLink() {
    if (!activeAccount?.id) return
    try {
      await revokeTeamsShare(activeAccount.id)
      shareStatus.setActive(false)
      toast.success(t('sharing.revoked'))
    } catch {
      toast.error(t('sharing.revokeError'))
    }
  }

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
      {/* Search Input - compact width on tablet/desktop */}
      <div className="relative w-full sm:max-w-xs md:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('teams.searchPlaceholder')}
          className="h-9 w-full rounded-[10px_10px_0_10px] border-border/60 bg-card/80 pl-9 pr-8 text-xs placeholder:text-muted-foreground/60 focus-visible:border-primary/80 focus-visible:ring-1 focus-visible:ring-primary/40 sm:text-sm shadow-xs"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label={t('teams.clearSearchAria')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex size-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/80 active:scale-95"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Share, Sort Select & Create Squad Button */}
      <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
        {activeAccount && (
          <DropdownMenu onOpenChange={(open) => { if (open) shareStatus.refresh() }}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={isPublicTeams ? t('teams.statusPublic') : t('teams.statusPrivate')}
                title={isPublicTeams ? t('teams.statusPublic') : t('teams.statusPrivate')}
                className="relative size-9 shrink-0 rounded-lg text-muted-foreground hover:bg-white/[0.08] hover:text-foreground cursor-pointer"
              >
                <Share2 className="size-4" />
                {isPublicTeams && (
                  <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)] p-2">
              <DropdownMenuItem
                role="menuitemcheckbox"
                aria-checked={isPublicTeams}
                disabled={isUpdatingVisibility}
                onSelect={onTogglePublicTeams}
                className="min-h-9 gap-2.5 px-2.5 py-1.5"
              >
                {isPublicTeams ? (
                  <Globe className="size-4 text-primary" />
                ) : (
                  <Lock className="size-4 text-muted-foreground" />
                )}
                {isPublicTeams ? t('teams.statusPublic') : t('teams.statusPrivate')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-9 gap-2.5 px-2.5 py-1.5"
                onSelect={handleCopyTeamsLink}
              >
                {teamsLinkCopied ? (
                  <Check className="size-4 text-primary stroke-[2.5]" />
                ) : (
                  <Share2 className="size-4" />
                )}
                {t('teams.copyPublicLink')}
              </DropdownMenuItem>
              <DropdownMenuLabel className="mt-1 border-t border-white/10 px-2.5 pt-2 pb-1">
                {t(`sharing.linkStatus_${shareStatus.status}`)}
              </DropdownMenuLabel>
              <DropdownMenuItem
                className="min-h-9 gap-2.5 px-2.5 py-1.5"
                disabled={shareStatus.status === 'inactive'}
                onSelect={() => setRevokeDialogOpen(true)}
              >
                <Lock className="size-4" />
                {t('sharing.revokeLink')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="flex-1 sm:w-[160px] sm:flex-none">
          <Select
            value={sortBy}
            onValueChange={(val) => onSortChange(val as TeamSortOption)}
          >
            <SelectTrigger size="sm" className="h-9 w-full text-xs rounded-lg border-border/60 bg-card/80">
              <div className="flex items-center gap-1.5 truncate">
                {sortBy === 'name' ? (
                  <ArrowDownAZ className="size-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ArrowUpDown className="size-3.5 text-muted-foreground shrink-0" />
                )}
                <SelectValue placeholder={t('teams.sortLabel')} />
              </div>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="newest">{t('teams.sortNewest')}</SelectItem>
              <SelectItem value="oldest">{t('teams.sortOldest')}</SelectItem>
              <SelectItem value="name">{t('teams.sortName')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isMaxTeams ? (
          <Button
            disabled
            title={t('teams.limitReachedTooltip', { max: maxTeams })}
            className="h-9 gap-1.5 shrink-0"
          >
            <Plus className="size-4" />
            <span>{t('teams.createSquad')}</span>
          </Button>
        ) : (
          <Button asChild className="h-9 gap-1.5 shrink-0">
            <Link to="/teams/new">
              <Plus className="size-4" />
              <span>{t('teams.createSquad')}</span>
            </Link>
          </Button>
        )}
      </div>

      {activeAccount && (
        <RevokeShareDialog
          open={revokeDialogOpen}
          onOpenChange={setRevokeDialogOpen}
          onConfirm={handleRevokeTeamsLink}
        />
      )}
    </div>
  )
}
