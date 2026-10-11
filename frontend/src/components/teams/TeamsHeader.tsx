import { useTranslation } from 'react-i18next'

interface TeamsHeaderProps {
  totalCount?: number
}

export function TeamsHeader({ totalCount = 0 }: TeamsHeaderProps) {
  const { t } = useTranslation()
  const formattedCount = String(totalCount).padStart(2, '0')

  return (
    <h1 className="flex items-center font-heading text-lg font-bold tracking-wide text-white sm:text-xl md:text-2xl">
      {t('teams.title')}
      {totalCount > 0 && (
        <span
          className="ml-2 sm:ml-2.5 font-heading"
          aria-label={t('teams.totalAria', { count: totalCount })}
          title={t('teams.totalAria', { count: totalCount })}
        >
          <span className="text-primary select-none">//</span>{' '}
          <span className="text-muted-foreground">{formattedCount}</span>
        </span>
      )}
    </h1>
  )
}
