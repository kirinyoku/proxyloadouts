import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { TeamsHeader } from './TeamsHeader'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => {
        const dict: Record<string, string> = {
          'teams.title': 'ОТРЯДЫ',
        }
        if (key === 'teams.totalAria') return `Всего отрядов: ${options?.count ?? 0}`
        return dict[key] ?? key
      },
    }),
  }
})

describe('TeamsHeader', () => {
  it('renders title and formatted count with double slash and heading font', () => {
    const html = renderToString(
      <TeamsHeader totalCount={5} />,
    )

    expect(html).toContain('ОТРЯДЫ')
    expect(html).toContain('font-heading')
    expect(html).toContain('<span class="text-primary select-none">//</span>')
    expect(html).toContain('05')
  })

  it('does not render total count badge when totalCount is 0', () => {
    const html = renderToString(
      <TeamsHeader totalCount={0} />,
    )

    expect(html).toContain('ОТРЯДЫ')
    expect(html).not.toContain('select-none">//</span>')
  })
})
