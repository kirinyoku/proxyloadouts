import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { RARITY_BADGE, RARITY_ICONS } from '@/lib/design-tokens'
import type { Rarity } from '@/types'

export interface RarityBadgeProps {
  rarity: Rarity
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP = {
  xs: 'size-4.5',
  sm: 'size-5.5',
  md: 'size-6.5',
  lg: 'size-8',
}

/**
 * Item rarity badge (S / A / B) in ZZZ comic style with black border and circular glow.
 */
export function RarityBadge({ rarity, size = 'sm', className }: RarityBadgeProps) {
  const { t } = useTranslation()
  const [hasError, setHasError] = useState(false)
  const iconUrl = RARITY_ICONS[rarity]

  if (iconUrl && !hasError) {
    const label = t('gear.rarityRank', { rarity })
    return (
      <img
        src={iconUrl}
        alt={label}
        title={label}
        draggable={false}
        onError={() => setHasError(true)}
        className={cn(
          'shrink-0 object-contain select-none pointer-events-none drop-shadow-xs',
          SIZE_MAP[size],
          className,
        )}
      />
    )
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-black font-heading font-black leading-none shadow-xs',
        RARITY_BADGE[rarity],
        SIZE_MAP[size],
        className,
      )}
    >
      {rarity}
    </span>
  )
}
