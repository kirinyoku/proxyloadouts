import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { preloadRoute } from '@/lib/route-preload'
import showcaseConsole from '@/assets/home/showcase-console.webp'
import discordKey from '@/assets/home/discord-arcade-key.webp'
import anby from '@/assets/home/anby-portrait.webp'
import nicole from '@/assets/home/nicole-portrait.webp'
import billy from '@/assets/home/billy-portrait.webp'
import battery from '@/assets/home/demara-battery.webp'
import shockstar from '@/assets/home/shockstar-disco.webp'
import '@/styles/home-guide.css'

export function HowItWorks() {
  const { t } = useTranslation()
  const steps = [
    {
      id: 'showcase',
      title: t('home.showcaseTitle'),
      description: t('home.showcaseGuide'),
      illustration: (
        <img className="guide-console" src={showcaseConsole} alt="" loading="lazy" />
      ),
    },
    {
      id: 'scan',
      title: t('home.scanTitle'),
      description: t('home.scanGuide'),
      illustration: (
        <div className="guide-id">
          <img src={anby} alt="" loading="lazy" />
          <div className="guide-id-print">
            <strong>{t('home.coverName')}</strong>
            <span>UID ••••••••••</span>
          </div>
        </div>
      ),
    },
    {
      id: 'discord',
      title: t('home.discordTitle'),
      description: t('home.discordGuide'),
      illustration: <img className="guide-key" src={discordKey} alt="" loading="lazy" />,
    },
    {
      id: 'loadout',
      title: t('home.saveTitle'),
      description: t('home.saveGuide'),
      illustration: (
        <div className="guide-equipment">
          <img className="guide-record" src={shockstar} alt="" loading="lazy" />
          <img className="guide-engine" src={battery} alt="" loading="lazy" />
        </div>
      ),
    },
    {
      id: 'squad',
      title: t('home.squadTitle'),
      description: t('home.squadGuide'),
      illustration: (
        <div className="guide-film">
          {[anby, billy, nicole].map((portrait) => (
            <img key={portrait} src={portrait} alt="" loading="lazy" />
          ))}
        </div>
      ),
    },
  ]

  return (
    <section className="home-guide" aria-labelledby="home-steps-title">
      <div className="home-guide-heading">
        <h2 id="home-steps-title">{t('home.stepsAria')}</h2>
        <Link
          to="/about"
          onMouseEnter={() => preloadRoute('/about')}
          onFocus={() => preloadRoute('/about')}
        >
          {t('home.aboutPromptLink')}
        </Link>
      </div>
      <div className="guide-strip">
        <ol className="guide-frames">
          {steps.map((step, index) => (
            <li key={step.id} className="guide-step">
              <div className="guide-frame">
                <div className="guide-illustration" aria-hidden="true">{step.illustration}</div>
                <div className="guide-copy">
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </div>
              <span className="guide-frame-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
