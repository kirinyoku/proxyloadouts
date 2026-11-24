import { useRef, useState } from 'react'
import { ArrowRight, Disc3, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { persistLastUid, UID_PATTERN } from '@/lib/uid'
import { HowItWorks } from '@/components/home/HowItWorks'
import { Button } from '@/components/ui/button'
import anbyArtwork from '@/assets/home/anby.webp'
import '@/styles/home.css'

export function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uid, setUid] = useState('')
  const valid = UID_PATTERN.test(uid)
  const showError = uid.length > 0 && !valid

  return (
    <div className="home-page">
      <title>{t('home.pageTitle')}</title>
      <meta name="description" content={t('home.subtitle')} />
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-intro">
          <p className="home-game"><Disc3 aria-hidden="true" />Zenless Zone Zero</p>
          <h1 id="home-title">{t('home.title')}</h1>
          <p className="home-summary">{t('home.subtitle')}</p>
          <form
            className="home-scan"
            onSubmit={(event) => {
              event.preventDefault()
              if (!valid) return
              persistLastUid(uid)
              navigate(`/showcase?uid=${uid}`)
            }}
          >
            <label htmlFor="home-uid">{t('home.uidAria')}</label>
            <div className="home-scan-controls">
              <div className="home-uid-entry">
                <input
                  ref={inputRef}
                  id="home-uid"
                  name="uid"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={t('home.searchPlaceholder')}
                  value={uid}
                  onChange={(event) => setUid(event.target.value.replace(/\D/g, '').slice(0, 10))}
                  aria-describedby="home-uid-hint"
                  aria-invalid={showError}
                />
                {uid && (
                  <button
                    type="button"
                    className="home-clear"
                    aria-label={t('home.clearInput')}
                    onClick={() => {
                      setUid('')
                      inputRef.current?.focus()
                    }}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
              <Button className="h-auto px-4 text-sm" type="submit" disabled={!valid}>
                {t('home.showShowcase')} <ArrowRight size={17} aria-hidden="true" />
              </Button>
            </div>
            <p id="home-uid-hint" className={showError ? 'home-uid-error' : undefined} aria-live="polite">
              {t(showError ? 'home.uidError' : 'home.guestHint')}
            </p>
          </form>
        </div>

        <div className="home-art" aria-hidden="true">
          <div className="home-album">
            <div className="home-disc" />
            <div className="home-jacket">
              <div className="home-insert">
                <span className="home-faction">{t('synergy.factions.cunning_hares')}</span>
                <img src={anbyArtwork} alt="" width="800" height="779" fetchPriority="high" />
                <div className="home-cover-caption">
                  <span>{t('home.coverName')}</span>
                  <small>{t('attributes.Electric')} / {t('specialties.Stun')}</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <HowItWorks />
    </div>
  )
}
