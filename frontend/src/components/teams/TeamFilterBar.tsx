import { ArrowDownAZ, ArrowUpDown, Plus, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type TeamSortOption = 'newest' | 'oldest' | 'name'

interface TeamFilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  sortBy: TeamSortOption
  onSortChange: (sort: TeamSortOption) => void
  totalCount?: number
}

export function TeamFilterBar({
  search,
  onSearchChange,
  sortBy,
  onSortChange,
  totalCount = 0,
}: TeamFilterBarProps) {
  const { t } = useTranslation()
  const isMaxTeams = totalCount >= 15

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

      {/* Sort Select & Create Squad Button */}
      <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
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
            title={t('teams.limitReachedTooltip')}
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
    </div>
  )
}
