import { useRef, useState } from 'react'
import { Check, ScanLine, TriangleAlert, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { persistLastUid, UID_PATTERN } from '@/lib/uid'

function renderSplitTitle(title: string) {
  const splitAt = title.lastIndexOf(' ')
  if (splitAt <= 0) return title
  return (
    <>
      {title.slice(0, splitAt + 1)}
      <span className="hero-halftone">{title.slice(splitAt + 1)}</span>
    </>
  )
}

export function HomeHeroIntro() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uid, setUid] = useState('')
  const [attempted, setAttempted] = useState(false)

  const valid = UID_PATTERN.test(uid)
  const showError = attempted && !valid

  function handleChange(raw: string) {
    setUid(raw.replace(/\D/g, '').slice(0, 10))
  }

  function handleClear() {
    setUid('')
    setAttempted(false)
    inputRef.current?.focus()
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid) {
      setAttempted(true)
      return
    }
    persistLastUid(uid)
    navigate(`/showcase?uid=${uid}`)
  }

  return (
    <div className="home-intro">
      <div className="home-game">
        <span className="hero-catalog-name">Zenless Zone Zero</span>
        <span className="hero-catalog-rule" aria-hidden="true" />
      </div>

      <h1 id="home-title">{renderSplitTitle(t('home.title'))}</h1>

      <div className="home-lead">
        <p className="home-summary">{t('home.subtitle')}</p>

        <div className="home-scan">
          <Label htmlFor="home-uid" className="sr-only">
            {t('home.uidAria')}
          </Label>

          <form
            className="hero-scan-bar"
            data-invalid={showError ? 'true' : undefined}
            onSubmit={handleSubmit}
            noValidate
          >
            <span className="hero-scan-prefix" aria-hidden="true">
              UID
            </span>
            <input
              ref={inputRef}
              id="home-uid"
              name="uid"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={uid}
              onChange={(event) => handleChange(event.target.value)}
              placeholder={t('home.searchPlaceholder')}
              aria-label={t('home.uidAria')}
              aria-describedby="home-uid-hint"
              aria-invalid={showError}
              className="hero-scan-input"
            />
            {uid.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                title={t('home.clearInput')}
                aria-label={t('home.clearInput')}
                className="hero-scan-clear"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
            <Button type="submit" className="hero-scan-submit">
              <ScanLine aria-hidden="true" className="size-3.5" />
              {t('home.scanButton')}
            </Button>
          </form>

          <p
            id="home-uid-hint"
            className={cn('hero-hint', showError ? 'home-uid-error' : 'hero-hint-ok')}
            aria-live="polite"
          >
            {showError ? (
              <TriangleAlert size={14} aria-hidden="true" />
            ) : (
              <Check size={14} aria-hidden="true" />
            )}
            <span>{t(showError ? 'home.uidError' : 'home.guestHint')}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
