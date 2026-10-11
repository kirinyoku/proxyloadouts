import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  ATTRIBUTE_ICONS,
  getAttributeLabel,
  SPECIALTY_ICONS,
  getSpecialtyLabel,
} from '@/lib/design-tokens'
import type { Attribute, Specialty } from '@/types'

export interface AttributeBadgeProps {
  attribute: Attribute
  label?: string
  className?: string
}

/**
 * Clean vector attribute (element) icon with accessibility label.
 */
export function AttributeBadge({ attribute, label, className }: AttributeBadgeProps) {
  const { t } = useTranslation()
  const iconUrl = ATTRIBUTE_ICONS[attribute]
  const resolvedName =
    label ||
    (attribute ? t(`attributes.${attribute}`, getAttributeLabel(attribute)) : getAttributeLabel(attribute))
  const title = t('gear.attributeLabel', { name: resolvedName })

  return (
    <span
      className={cn(
        'inline-flex size-5.5 shrink-0 items-center justify-center transition-transform hover:scale-110',
        className,
      )}
      title={title}
      aria-label={title}
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt=""
          className="size-full object-contain select-none pointer-events-none drop-shadow-xs"
        />
      ) : (
        <span className="size-2.5 rounded-full bg-current" />
      )}
    </span>
  )
}

export interface SpecialtyBadgeProps {
  specialty: Specialty
  label?: string
  className?: string
}

/**
 * Clean vector combat specialty (role) icon with accessibility label.
 */
export function SpecialtyBadge({ specialty, label, className }: SpecialtyBadgeProps) {
  const { t } = useTranslation()
  const iconUrl = SPECIALTY_ICONS[specialty]
  const resolvedName =
    label ||
    (specialty ? t(`specialties.${specialty}`, getSpecialtyLabel(specialty)) : getSpecialtyLabel(specialty))
  const title = t('gear.specialtyLabel', { name: resolvedName })

  return (
    <span
      className={cn(
        'inline-flex size-5.5 shrink-0 items-center justify-center transition-transform hover:scale-110',
        className,
      )}
      title={title}
      aria-label={title}
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt=""
          className="size-full object-contain select-none pointer-events-none drop-shadow-xs"
        />
      ) : (
        <span className="font-heading text-xs font-bold">{specialty.slice(0, 2)}</span>
      )}
    </span>
  )
}
