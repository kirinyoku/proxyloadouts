import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'
import { PxlLogo } from '@/components/common/PxlLogo'

const ENKA_NETWORK_URL = 'https://enka.network'

export function AppFooter() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <footer
      aria-label={t('footer.aria')}
      className="relative mt-auto border-t-2 border-black bg-background text-muted-foreground"
    >
      {/* Decorative top accent hairline */}
      <div
        aria-hidden
        className="crosshatch absolute inset-x-0 top-0 h-[2px] opacity-70"
        style={{ backgroundColor: 'var(--primary)' }}
      />

      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-5 sm:py-6">
        <div className="grid grid-cols-1 items-center gap-3 min-[350px]:grid-cols-[minmax(0,1fr)_auto] lg:flex lg:flex-wrap lg:gap-x-3">
          <Link
            to="/"
            aria-label="ProxyLoadouts"
            className="group order-1 inline-flex w-fit items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <PxlLogo size="sm" showMark />
          </Link>

          <div
            aria-hidden="true"
            className="hidden h-4 w-px shrink-0 bg-white/20 lg:order-2 lg:block"
          />

          <p className="order-3 min-w-0 text-xs leading-relaxed text-muted-foreground min-[350px]:col-span-2 lg:order-3 lg:col-auto">
            {t('footer.poweredBy')}{' '}
            <a
              href={ENKA_NETWORK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1 whitespace-nowrap font-medium text-foreground transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <span className="underline decoration-white/20 underline-offset-4 transition-colors group-hover:decoration-primary">
                {t('footer.enkaNetwork')}
              </span>
              <ExternalLink className="size-3 opacity-60 transition-opacity group-hover:opacity-100" />
            </a>
          </p>

          <div className="order-2 w-full min-[350px]:w-auto lg:order-4 lg:ml-auto lg:shrink-0">
            <LanguageSwitcher
              variant="select"
              align="end"
              className="h-10 w-full min-w-0 text-xs min-[350px]:min-w-36 lg:h-8.5 lg:w-auto lg:min-w-44"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-muted-foreground/85 sm:mt-5 sm:pt-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-8">
          <p className="max-w-3xl lg:max-w-none">{t('footer.disclaimer')}</p>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between lg:justify-end">
            <nav className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1 sm:flex sm:w-auto sm:items-center sm:gap-4">
              <Link
                to="/settings"
                className="inline-flex min-h-8 w-fit items-center whitespace-nowrap transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              >
                {t('settings.title')}
              </Link>
              <Link
                to="/privacy"
                className="inline-flex min-h-8 w-fit items-center whitespace-nowrap transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              >
                {t('footer.privacy')}
              </Link>
            </nav>
            <span className="whitespace-nowrap">© {currentYear} ProxyLoadouts</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
