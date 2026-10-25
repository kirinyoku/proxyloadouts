import { useState } from 'react'
import { ArrowRight, ScanLine, Search, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { preloadRoute } from '@/lib/route-preload'
import { persistLastUid, UID_PATTERN } from '@/lib/uid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HowItWorks } from '@/components/home/HowItWorks'

export function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [uidInput, setUidInput] = useState('')

  const isInputValid = UID_PATTERN.test(uidInput)

  function handleScan(targetUid: string) {
    const trimmed = targetUid.trim()
    if (!UID_PATTERN.test(trimmed)) return
    persistLastUid(trimmed)
    navigate(`/showcase?uid=${trimmed}`)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-12 py-6 sm:py-14">
      <title>{t('home.pageTitle', 'Agent Build Manager for Zenless Zone Zero')}</title>
      <meta name="description" content={t('home.subtitle')} />
      {/* 1. Introduction and search */}
      <section className="text-center space-y-4">
        <div className="mx-auto max-w-3xl space-y-3">
          <h1 className="font-heading text-xl font-bold uppercase tracking-wider sm:text-3xl lg:text-4xl text-foreground">
            <span className="block sm:whitespace-nowrap">{t('home.title1')}</span>{' '}
            <span className="block mt-1 sm:whitespace-nowrap bg-gradient-to-r from-primary via-brand to-primary bg-clip-text text-transparent drop-shadow-[0_2px_12px_color-mix(in_oklch,var(--primary)_20%,transparent)]">
              {t('home.title2', 'Zenless Zone Zero')}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground/90 font-medium leading-relaxed max-w-lg mx-auto">
            {t('home.subtitle')}
          </p>
        </div>

        {/* UID Search Box */}
        <div className="mx-auto mt-6 max-w-md">
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
            onSubmit={(event) => {
              event.preventDefault()
              if (isInputValid) handleScan(uidInput)
            }}
            noValidate
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
              <Input
                inputMode="numeric"
                placeholder={t('home.searchPlaceholder')}
                value={uidInput}
                onChange={(event) =>
                  setUidInput(event.target.value.replace(/\D/g, '').slice(0, 10))
                }
                autoComplete="off"
                aria-label={t('home.uidAria')}
                className="h-11 rounded-[14px_14px_0_14px] border-border/80 bg-card/70 pl-10 pr-9 font-mono text-sm tracking-wider focus-visible:border-primary/60"
              />
              {uidInput.length > 0 && (
                <button
                  type="button"
                  onClick={() => setUidInput('')}
                  aria-label={t('home.clearInput')}
                  className="absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <Button
              type="submit"
              disabled={!isInputValid}
              className="h-11 shrink-0 px-5"
            >
              <ScanLine className="size-4" />
              {t('home.showShowcase')}
            </Button>
          </form>

          {uidInput.length > 0 && !isInputValid && (
            <p className="mt-2 text-left text-xs text-destructive" role="alert">
              {t('home.uidError')}
            </p>
          )}
        </div>
      </section>

      {/* 2. 5-step process walkthrough & link to About */}
      <div className="space-y-8 sm:space-y-10">
        <HowItWorks />

        <div className="text-center">
          <Link
            to="/about"
            onMouseEnter={() => preloadRoute('/about')}
            onFocus={() => preloadRoute('/about')}
            className="group inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline decoration-white/20 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <span>{t('home.aboutPromptLink')}</span>
            <ArrowRight
              aria-hidden="true"
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </div>
    </div>
  )
}
