import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'
import { PxlLogo } from '@/components/common/PxlLogo'
import { preloadRoute } from '@/lib/route-preload'

const ENKA_NETWORK_URL = 'https://enka.network'
const GITHUB_PROFILE_URL = 'https://github.com/kirinyoku'
const CONTACT_EMAIL = 'contact@proxyloadouts.com'

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
        {/* Top header row: Logo + LanguageSwitcher (mobile side-by-side, desktop ends) & Alpha notice */}
        <div className="flex flex-wrap items-center justify-between gap-y-3 sm:flex-nowrap sm:gap-4 lg:gap-5">
          <Link
            to="/"
            aria-label="ProxyLoadouts"
            className="order-1 inline-flex shrink-0 items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <PxlLogo size="sm" showMark />
          </Link>

          <div
            aria-hidden="true"
            className="hidden h-5 w-px shrink-0 bg-white/20 sm:block"
          />

          <p className="order-3 w-full text-[11px] leading-relaxed text-muted-foreground/85 sm:order-2 sm:w-auto sm:flex-1 sm:max-w-3xl">
            <span className="mr-1.5 inline-block font-mono text-[10px] font-bold tracking-wider text-primary">
              [{t('footer.alphaBadge')}]
            </span>
            {t('footer.alphaNoticeLeading')}{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-foreground underline decoration-white/20 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              {CONTACT_EMAIL}
            </a>
            {t('footer.alphaNoticeTrailing')}
          </p>

          <div className="order-2 shrink-0 sm:order-3">
            <LanguageSwitcher
              variant="select"
              align="end"
              className="h-8.5 w-auto min-w-[120px] text-xs sm:min-w-44"
            />
          </div>
        </div>

        <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-muted-foreground/80 sm:mt-5 sm:pt-4">
          <p className="max-w-4xl text-pretty text-muted-foreground/75">
            {t('footer.disclaimer')}
          </p>

          <div className="flex flex-col gap-3 border-t border-white/[0.04] pt-2.5 lg:flex-row lg:items-center lg:justify-between text-muted-foreground/85">
            {/* Attribution: Upstream Data */}
            <p className="min-w-0 leading-relaxed">
              <span>{t('footer.poweredBy')}</span>{' '}
              <a
                href={ENKA_NETWORK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              >
                <span className="underline decoration-white/20 underline-offset-4 transition-colors group-hover:decoration-primary">
                  {t('footer.enkaNetwork')}
                </span>
                <ExternalLink className="size-3 opacity-60 transition-opacity group-hover:opacity-100" />
              </a>
            </p>

            {/* Links, Copyright & Author */}
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 shrink-0">
              <nav
                aria-label={t('footer.aria')}
                className="flex flex-wrap items-center gap-x-4 gap-y-1"
              >
                <Link
                  to="/about"
                  onMouseEnter={() => preloadRoute('/about')}
                  onFocus={() => preloadRoute('/about')}
                  className="inline-flex min-h-7 items-center whitespace-nowrap transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                >
                  {t('footer.about')}
                </Link>
                <Link
                  to="/settings"
                  onMouseEnter={() => preloadRoute('/settings')}
                  onFocus={() => preloadRoute('/settings')}
                  className="inline-flex min-h-7 items-center whitespace-nowrap transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                >
                  {t('settings.title')}
                </Link>
                <Link
                  to="/privacy"
                  onMouseEnter={() => preloadRoute('/privacy')}
                  onFocus={() => preloadRoute('/privacy')}
                  className="inline-flex min-h-7 items-center whitespace-nowrap transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                >
                  {t('footer.privacy')}
                </Link>
              </nav>

              <span aria-hidden="true" className="hidden text-white/20 sm:inline">
                ·
              </span>

              <span className="whitespace-nowrap">© {currentYear} ProxyLoadouts</span>

              <span aria-hidden="true" className="hidden text-white/20 sm:inline">
                ·
              </span>

              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span>{t('footer.createdBy')}</span>
                <a
                  href={GITHUB_PROFILE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                >
                  <span className="underline decoration-white/20 underline-offset-4 transition-colors group-hover:decoration-primary">
                    kirinyoku
                  </span>
                  <ExternalLink className="size-2.5 opacity-60 transition-opacity group-hover:opacity-100" />
                </a>
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
