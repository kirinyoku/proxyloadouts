import { useTranslation } from 'react-i18next'
import { HomeHeroIntro } from '@/components/home/HomeHeroIntro'
import { HowItWorks } from '@/components/home/HowItWorks'
import anbyArtwork from '@/assets/home/anby.webp'
import '@/styles/home.css'

export function HomePage() {
  const { t } = useTranslation()

  return (
    <div className="home-page">
      <title>{t('home.pageTitle')}</title>
      <meta name="description" content={t('home.subtitle')} />
      <section className="home-hero" aria-labelledby="home-title">
        <HomeHeroIntro />

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
