import { useTranslation } from 'react-i18next'

const GITHUB_REPO_URL = 'https://github.com/kirinyoku/proxyloadouts'
const CONTACT_EMAIL = 'contact@proxyloadouts.com'

export function AboutPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-2xl py-6 sm:py-10">
      <title>{t('about.pageTitle')}</title>
      <meta name="description" content={t('about.metaDescription')} />

      <div className="border-b border-white/[0.08] pb-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t('about.title')}
        </h1>
      </div>

      <div className="divide-y divide-white/[0.08]">
        <section className="space-y-2 py-6">
          <h2 className="font-heading text-base text-foreground">
            {t('about.project.title')}
          </h2>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            {t('about.project.text')}
          </p>
        </section>

        <section className="space-y-2 py-6">
          <h2 className="font-heading text-base text-foreground">
            {t('about.auth.title')}
          </h2>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            {t('about.auth.text')}
          </p>
        </section>

        <section className="space-y-2 py-6">
          <h2 className="font-heading text-base text-foreground">
            {t('about.limits.title')}
          </h2>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            {t('about.limits.textLeading')}{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-foreground underline decoration-white/25 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
            >
              {CONTACT_EMAIL}
            </a>
            {t('about.limits.textTrailing')}
          </p>
        </section>

        <section className="space-y-2 py-6">
          <h2 className="font-heading text-base text-foreground">
            {t('about.monetization.title')}
          </h2>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            {t('about.monetization.text')}
          </p>
        </section>

        <section className="space-y-2 py-6">
          <h2 className="font-heading text-base text-foreground">
            {t('about.development.title')}
          </h2>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            {t('about.development.textLeading')}{' '}
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline decoration-white/25 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
            >
              GitHub
            </a>{' '}
            {t('about.development.textTrailing')}
          </p>
        </section>
      </div>
    </div>
  )
}
