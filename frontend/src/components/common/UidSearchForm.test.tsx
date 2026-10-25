import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { UidSearchForm } from './UidSearchForm'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'showcase.searchPlaceholder': 'Игровой UID…',
        'showcase.searchTitle': 'Сканировать',
        'showcase.searchAria': 'Показать витрину',
        'home.uidAria': 'Игровой UID',
        'common.clear': 'Очистить',
      }
      return dict[key] ?? key
    },
    i18n: { language: 'ru' },
  }),
}))

describe('UidSearchForm', () => {
  it('renders UID input with value and placeholder', () => {
    const html = renderToString(
      <UidSearchForm
        uidInput="1504687050"
        isUidValid={true}
        onUidInputChange={() => {}}
        onScan={() => {}}
      />
    )

    expect(html).toContain('value="1504687050"')
    expect(html).toContain('placeholder="Игровой UID…"')
    expect(html).toContain('title="Очистить"')
  })

  it('renders custom placeholder when provided', () => {
    const html = renderToString(
      <UidSearchForm
        uidInput=""
        isUidValid={false}
        placeholder="Верный UID…"
        onUidInputChange={() => {}}
        onScan={() => {}}
      />
    )

    expect(html).toContain('placeholder="Верный UID…"')
    expect(html).not.toContain('title="Очистить"')
  })

  it('renders search button with magnifying glass and disabled state when invalid', () => {
    const html = renderToString(
      <UidSearchForm
        uidInput="123"
        isUidValid={false}
        onUidInputChange={() => {}}
        onScan={() => {}}
      />
    )

    expect(html).toContain('disabled=""')
    expect(html).toContain('title="Сканировать"')
  })

  it('renders search button enabled when valid', () => {
    const html = renderToString(
      <UidSearchForm
        uidInput="1504687050"
        isUidValid={true}
        onUidInputChange={() => {}}
        onScan={() => {}}
      />
    )

    expect(html).not.toContain('disabled=""')
  })
})
