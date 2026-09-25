import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { PageLoader } from './PageLoader'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ru' },
  }),
}))

describe('PageLoader component', () => {
  it('renders default full-screen centered loader with role="status" and size-8 (lg) spinner', () => {
    const html = renderToString(<PageLoader />)

    expect(html).toContain('role="status"')
    expect(html).toContain('fixed inset-0')
    expect(html).toContain('min-h-dvh')
    expect(html).toContain('items-center justify-center')
    expect(html).toContain('size-8') // size="lg" spinner
    expect(html).toContain('common.loading')
  })

  it('renders with custom label and sublabel', () => {
    const html = renderToString(
      <PageLoader label="ЗАГРУЗКА ДАННЫХ" sublabel="INTERKNOT // SYNC" />
    )

    expect(html).toContain('ЗАГРУЗКА ДАННЫХ')
    expect(html).toContain('INTERKNOT // SYNC')
  })

  it('supports non-fixed container mode', () => {
    const html = renderToString(<PageLoader fixed={false} spinnerSize="md" />)

    expect(html).not.toContain('fixed inset-0')
    expect(html).toContain('min-h-[50vh]')
    expect(html).toContain('size-6') // size="md" spinner
  })
})
