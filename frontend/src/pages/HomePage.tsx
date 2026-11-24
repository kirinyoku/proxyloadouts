import { useState } from 'react'
import { Disc3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { persistLastUid, UID_PATTERN } from '@/lib/uid'
import { HowItWorks } from '@/components/home/HowItWorks'
import { UidSearchForm } from '@/components/common/UidSearchForm'
import { Label } from '@/components/ui/label'
import anbyArtwork from '@/assets/home/anby.webp'
import '@/styles/home.css'

export function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
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
          <div className="home-scan">
            <Label htmlFor="home-uid" className="mb-2 text-xs font-semibold">{t('home.uidAria')}</Label>
            <UidSearchForm
              inputId="home-uid"
              uidInput={uid}
              isUidValid={valid}
              onUidInputChange={setUid}
              onScan={(value) => {
                persistLastUid(value)
                navigate(`/showcase?uid=${value}`)
              }}
              placeholder={t('home.searchPlaceholder')}
              buttonLabel={t('home.showShowcase')}
              describedBy="home-uid-hint"
            />
            <p id="home-uid-hint" className={showError ? 'home-uid-error' : undefined} aria-live="polite">
              {t(showError ? 'home.uidError' : 'home.guestHint')}
            </p>
          </div>
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
