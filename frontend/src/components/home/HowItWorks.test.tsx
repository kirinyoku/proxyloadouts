import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { HowItWorks } from './HowItWorks'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'home.stepsAria': 'Как это работает',
        'home.step1Title': 'Игровая витрина',
        'home.step1DescShort': 'Выставьте агентов на игровую витрину',
        'home.step2Title': 'Скан по UID',
        'home.step2DescShort': 'Импортируйте экипировку агентов по UID',
        'home.step3Title': 'Авторизация через Discord',
        'home.step3DescShort': 'Авторизуйтесь через Discord для сохранения сборок',
        'home.step4Title': 'Менеджмент сборок',
        'home.step4DescShort': 'Создавайте сборки под разные отряды',
        'home.step5Title': 'Менеджмент отрядов',
        'home.step5DescShort': 'Собирайте отряды из своих сборок без коллизий',
      }
      return translations[key] ?? key
    },
  }),
}))

describe('HowItWorks', () => {
  it('renders section title and accessibility attributes', () => {
    const html = renderToString(<HowItWorks />)

    expect(html).toContain('id="home-steps-title"')
    expect(html).toContain('aria-labelledby="home-steps-title"')
    expect(html).toContain('Как это работает')
  })

  it('renders a single responsive list instead of duplicated mobile/desktop trees', () => {
    const html = renderToString(<HowItWorks />)

    expect(html.match(/<ol[\s>]/g)).toHaveLength(1)
    expect(html.match(/<li[\s>]/g)).toHaveLength(5)
    expect(html).not.toContain('md:hidden')
    expect(html).not.toContain('hidden md:block')
  })

  it('renders all 5 steps with numbers, titles, and concise descriptions', () => {
    const html = renderToString(<HowItWorks />)

    expect(html).toContain('01')
    expect(html).toContain('Игровая витрина')
    expect(html).toContain('Выставьте агентов на игровую витрину')

    expect(html).toContain('02')
    expect(html).toContain('Скан по UID')
    expect(html).toContain('Импортируйте экипировку агентов по UID')

    expect(html).toContain('03')
    expect(html).toContain('Авторизация через Discord')
    expect(html).toContain('Авторизуйтесь через Discord для сохранения сборок')

    expect(html).toContain('04')
    expect(html).toContain('Менеджмент сборок')
    expect(html).toContain('Создавайте сборки под разные отряды')

    expect(html).toContain('05')
    expect(html).toContain('Менеджмент отрядов')
    expect(html).toContain('Собирайте отряды из своих сборок без коллизий')
  })
})
