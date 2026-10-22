import {
  ArrowLeft,
  Clock,
  Cookie,
  Database,
  ExternalLink,
  Gavel,
  Globe,
  Lock,
  Mail,
  Scale,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function PrivacyPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-4xl py-6 sm:py-10">
      <title>{t('privacy.pageTitle')}</title>
      <meta name="description" content={t('privacy.metaDescription')} />
      {/* Back navigation */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <Link to="/">
            <ArrowLeft className="size-4" />
            {t('privacy.backToHome')}
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="mb-8 space-y-3">
        <div className="inline-flex items-center gap-2 font-mono text-[11px] font-bold tracking-wider text-primary">
          <span>// {t('privacy.badge')}</span>
        </div>
        <h1 className="font-heading text-2xl sm:text-3xl text-foreground">
          {t('privacy.title')}
        </h1>
        <p className="font-mono text-xs text-muted-foreground">
          {t('privacy.lastUpdated')}
        </p>
      </div>

      {/* Content Container */}
      <div className="space-y-6">
        {/* Section 1: Overview & Operator */}
        <section className="rounded-[12px_12px_0_12px] border border-white/10 bg-card/95 p-6 sm:p-7 shadow-xs">
          <h2 className="mb-3 font-heading text-base text-foreground flex items-center gap-2">
            <Globe className="size-4 text-primary" />
            {t('privacy.sections.overview.title')}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground mb-4">
            {t('privacy.sections.overview.content')}
          </p>

          <div className="rounded-[8px_8px_0_8px] border border-white/10 bg-black/30 p-4">
            <h3 className="font-heading text-xs uppercase tracking-wider text-foreground mb-1.5 flex items-center gap-1.5">
              <Mail className="size-3.5 text-primary" />
              {t('privacy.sections.overview.operatorTitle')}
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t('privacy.sections.overview.operatorContent')}{' '}
              <a
                href={`mailto:${t('privacy.sections.contact.email')}`}
                className="font-mono text-primary underline-offset-4 hover:underline"
              >
                {t('privacy.sections.contact.email')}
              </a>
            </p>
          </div>
        </section>

        {/* Section 2: Terms of Service & Acceptable Use */}
        <section className="rounded-[12px_12px_0_12px] border border-white/10 bg-card/95 p-6 sm:p-7 shadow-xs">
          <h2 className="mb-3 font-heading text-base text-foreground flex items-center gap-2">
            <Gavel className="size-4 text-primary" />
            {t('privacy.sections.terms.title')}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground mb-4">
            {t('privacy.sections.terms.intro')}
          </p>

          <div className="space-y-3">
            <div className="rounded-[8px_8px_0_8px] border border-white/5 bg-white/[0.02] p-4 text-xs leading-relaxed text-muted-foreground">
              <p>{t('privacy.sections.terms.ruleAup')}</p>
            </div>
            <div className="rounded-[8px_8px_0_8px] border border-white/5 bg-white/[0.02] p-4 text-xs leading-relaxed text-muted-foreground">
              <p>{t('privacy.sections.terms.ruleContent')}</p>
            </div>
            <div className="rounded-[8px_8px_0_8px] border border-white/5 bg-white/[0.02] p-4 text-xs leading-relaxed text-muted-foreground">
              <p>{t('privacy.sections.terms.ruleTermination')}</p>
            </div>
            <div className="rounded-[8px_8px_0_8px] border border-white/5 bg-white/[0.02] p-4 text-xs leading-relaxed text-muted-foreground">
              <p>{t('privacy.sections.terms.ruleLiability')}</p>
            </div>
            <div className="rounded-[8px_8px_0_8px] border border-white/5 bg-white/[0.02] p-4 text-xs leading-relaxed text-muted-foreground">
              <p>{t('privacy.sections.terms.ruleJurisdiction')}</p>
            </div>
          </div>
        </section>

        {/* Section 3: Intellectual Property & HoYoverse Policy */}
        <section className="rounded-[12px_12px_0_12px] border border-white/10 bg-card/95 p-6 sm:p-7 shadow-xs">
          <div className="flex items-start gap-3">
            <Scale className="size-5 shrink-0 text-muted-foreground mt-0.5" />
            <div className="space-y-3">
              <h2 className="font-heading text-base text-foreground">
                {t('privacy.sections.ip.title')}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t('privacy.sections.ip.content')}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground/80 italic">
                {t('privacy.sections.ip.takedown')}
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Data We Collect & Legal Bases */}
        <section className="rounded-[12px_12px_0_12px] border border-white/10 bg-card/95 p-6 sm:p-7 shadow-xs">
          <h2 className="mb-4 font-heading text-base text-foreground flex items-center gap-2">
            <Database className="size-4 text-primary" />
            {t('privacy.sections.collected.title')}
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-[8px_8px_0_8px] border border-white/5 bg-white/[0.02] p-4">
              <h3 className="font-heading text-xs uppercase tracking-wider text-foreground mb-1.5">
                {t('privacy.sections.collected.discordTitle')}
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('privacy.sections.collected.discordDesc')}
              </p>
            </div>

            <div className="rounded-[8px_8px_0_8px] border border-white/5 bg-white/[0.02] p-4">
              <h3 className="font-heading text-xs uppercase tracking-wider text-foreground mb-1.5">
                {t('privacy.sections.collected.uidTitle')}
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('privacy.sections.collected.uidDesc')}
              </p>
            </div>

            <div className="rounded-[8px_8px_0_8px] border border-white/5 bg-white/[0.02] p-4">
              <h3 className="font-heading text-xs uppercase tracking-wider text-foreground mb-1.5">
                {t('privacy.sections.collected.buildsTitle')}
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('privacy.sections.collected.buildsDesc')}
              </p>
            </div>

            <div className="rounded-[8px_8px_0_8px] border border-white/5 bg-white/[0.02] p-4">
              <h3 className="font-heading text-xs uppercase tracking-wider text-foreground mb-1.5">
                {t('privacy.sections.collected.technicalTitle')}
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('privacy.sections.collected.technicalDesc')}
              </p>
            </div>
          </div>
        </section>

        {/* Section 5: Cookies & LocalStorage */}
        <section className="rounded-[12px_12px_0_12px] border border-white/10 bg-card/95 p-6 sm:p-7 shadow-xs">
          <h2 className="mb-3 font-heading text-base text-foreground flex items-center gap-2">
            <Cookie className="size-4 text-primary" />
            {t('privacy.sections.cookies.title')}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground mb-3">
            {t('privacy.sections.cookies.content')}
          </p>

          <ul className="space-y-2.5 text-xs text-muted-foreground mb-4">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <span>{t('privacy.sections.cookies.cookieItem')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <span>{t('privacy.sections.cookies.storageItem')}</span>
            </li>
          </ul>

          <div className="rounded-[8px_8px_0_8px] border border-white/5 bg-white/[0.02] p-3 text-[11px] leading-relaxed text-muted-foreground/90">
            {t('privacy.sections.cookies.noConsentNotice')}
          </div>
        </section>

        {/* Section 6: Account Safety */}
        <section className="rounded-[12px_12px_0_12px] border border-primary/20 bg-primary/[0.03] p-6 sm:p-7">
          <div className="flex items-start gap-3">
            <ShieldCheck className="size-5 shrink-0 text-primary mt-0.5" />
            <div className="space-y-2">
              <h2 className="font-heading text-base text-foreground">
                {t('privacy.sections.safety.title')}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t('privacy.sections.safety.content')}
              </p>
            </div>
          </div>
        </section>

        {/* Section 7: Retention Periods */}
        <section className="rounded-[12px_12px_0_12px] border border-white/10 bg-card/95 p-6 sm:p-7 shadow-xs">
          <h2 className="mb-3 font-heading text-base text-foreground flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            {t('privacy.sections.retention.title')}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground mb-4">
            {t('privacy.sections.retention.content')}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-[8px_8px_0_8px] border border-white/5 bg-white/[0.02] p-3.5 text-xs text-muted-foreground">
              {t('privacy.sections.retention.accountItem')}
            </div>
            <div className="rounded-[8px_8px_0_8px] border border-white/5 bg-white/[0.02] p-3.5 text-xs text-muted-foreground">
              {t('privacy.sections.retention.sessionItem')}
            </div>
            <div className="rounded-[8px_8px_0_8px] border border-white/5 bg-white/[0.02] p-3.5 text-xs text-muted-foreground">
              {t('privacy.sections.retention.transientItem')}
            </div>
          </div>
        </section>

        {/* Section 8: GDPR User Rights */}
        <section className="rounded-[12px_12px_0_12px] border border-white/10 bg-card/95 p-6 sm:p-7 shadow-xs">
          <div className="flex items-start gap-3">
            <ShieldAlert className="size-5 shrink-0 text-primary mt-0.5" />
            <div className="space-y-4 w-full">
              <h2 className="font-heading text-base text-foreground">
                {t('privacy.sections.rights.title')}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t('privacy.sections.rights.content')}
              </p>

              <div className="space-y-2.5">
                <div className="rounded-[8px_8px_0_8px] border border-white/5 bg-white/[0.02] p-3 text-xs leading-relaxed text-muted-foreground">
                  {t('privacy.sections.rights.access')}
                </div>
                <div className="rounded-[8px_8px_0_8px] border border-primary/20 bg-primary/[0.03] p-3 text-xs leading-relaxed text-muted-foreground">
                  {t('privacy.sections.rights.erasure')}
                </div>
                <div className="rounded-[8px_8px_0_8px] border border-white/5 bg-white/[0.02] p-3 text-xs leading-relaxed text-muted-foreground">
                  {t('privacy.sections.rights.restriction')}
                </div>
                <div className="rounded-[8px_8px_0_8px] border border-white/5 bg-white/[0.02] p-3 text-xs leading-relaxed text-muted-foreground">
                  {t('privacy.sections.rights.portability')}
                </div>
                <div className="rounded-[8px_8px_0_8px] border border-white/5 bg-white/[0.02] p-3 text-xs leading-relaxed text-muted-foreground">
                  {t('privacy.sections.rights.complaint')}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 9: Third-Party Services */}
        <section className="rounded-[12px_12px_0_12px] border border-white/10 bg-card/95 p-6 sm:p-7 shadow-xs">
          <h2 className="mb-3 font-heading text-base text-foreground flex items-center gap-2">
            <Lock className="size-4 text-primary" />
            {t('privacy.sections.thirdParty.title')}
          </h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <div>
                <span>{t('privacy.sections.thirdParty.hetzner')}</span>{' '}
                <a
                  href="https://www.hetzner.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary hover:underline"
                >
                  <span>hetzner.com</span>
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <span>{t('privacy.sections.thirdParty.discord')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <div>
                <span>{t('privacy.sections.thirdParty.enka')}</span>{' '}
                <a
                  href="https://enka.network"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary hover:underline"
                >
                  <span>enka.network</span>
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </li>
          </ul>
        </section>

        {/* Section 10: Contacts & Legal Inquiries */}
        <section className="rounded-[12px_12px_0_12px] border border-white/10 bg-card/95 p-6 sm:p-7 shadow-xs">
          <div className="flex items-start gap-3">
            <Mail className="size-5 shrink-0 text-primary mt-0.5" />
            <div className="space-y-2">
              <h2 className="font-heading text-base text-foreground">
                {t('privacy.sections.contact.title')}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t('privacy.sections.contact.content')}{' '}
                <a
                  href={`mailto:${t('privacy.sections.contact.email')}`}
                  className="inline-flex items-center gap-1 font-mono text-primary underline-offset-4 hover:underline"
                >
                  <span>{t('privacy.sections.contact.email')}</span>
                  <ExternalLink className="size-3" />
                </a>
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground/80">
                {t('privacy.sections.contact.responseTime')}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
