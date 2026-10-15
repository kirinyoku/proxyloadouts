import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface TeamBuilderHeaderProps {
  isEditing: boolean
  teamName?: string
}

export function TeamBuilderHeader({
  isEditing,
}: TeamBuilderHeaderProps) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2.5">
      <Button
        variant="ghost"
        size="icon"
        asChild
        className="size-8 text-muted-foreground hover:text-foreground"
      >
        <Link to="/teams" aria-label={t('roster.toTeamsTitle')} title={t('roster.toTeamsTitle')}>
          <ArrowLeft className="size-4" />
        </Link>
      </Button>
      <h1 className="font-heading text-lg font-black uppercase tracking-wide text-foreground sm:text-2xl">
        {isEditing ? t('teamBuilder.editTitle') : t('teamBuilder.newTitle')}
      </h1>
    </div>
  )
}

