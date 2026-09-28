import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { RosterToolbar } from './RosterToolbar'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { count?: number; label?: string }) => {
        const translations: Record<string, string> = {
          'nav.roster': 'РОСТЕР',
          'roster.buildsCount': `${options?.count ?? 0} агентов`,
          'roster.searchPlaceholder': 'Поиск агента...',
          'roster.attributeFilterLabel': 'Атрибут',
          'roster.specialtyFilterLabel': 'Специальность',
          'roster.filterAttributes': 'Фильтр по атрибуту',
          'roster.filterSpecialties': 'Фильтр по специальности',
          'roster.toTeams': 'К командам',
          'roster.toTeamsTitle': 'Вернуться к командам',
          'roster.attrTooltip': options?.label ?? '',
          'roster.specTooltip': options?.label ?? '',
          'roster.attrTooltipActive': ' (активно)',
          'roster.attrTooltipEmpty': ' (нет в ростере)',
          'roster.clearSearch': 'Очистить поиск',
          'roster.resetFiltersTitle': 'Сбросить фильтры',
        }
        return translations[key] ?? key
      },
    }),
  }
})

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}))

describe('RosterToolbar', () => {
  it('renders title and saved agents count with lime double-slash and Russo One font', () => {
    const html = renderToString(
      <RosterToolbar
        search=""
        onSearchChange={vi.fn()}
        selectedAttribute={null}
        onAttributeChange={vi.fn()}
        selectedSpecialty={null}
        onSpecialtyChange={vi.fn()}
        totalAgents={6}
      />,
    )

    // Heading has Russo One class (font-heading)
    expect(html).toContain('font-heading')
    // Contains lime double-slash
    expect(html).toContain('<span class="text-primary select-none">//</span>')
    // Contains padded count "06"
    expect(html).toContain('06')
  })

  it('renders updated filter labels "Атрибут" and "Специальность"', () => {
    const html = renderToString(
      <RosterToolbar
        search=""
        onSearchChange={vi.fn()}
        selectedAttribute={null}
        onAttributeChange={vi.fn()}
        selectedSpecialty={null}
        onSpecialtyChange={vi.fn()}
        totalAgents={6}
      />,
    )

    expect(html).toContain('Атрибут')
    expect(html).toContain('Специальность')
    // Ensure old labels "Стихия" and "Роль" are not rendered
    expect(html).not.toContain('Стихия')
    expect(html).not.toContain('Роль')
  })

  it('renders desktop filters before the search input in the desktop section', () => {
    const html = renderToString(
      <RosterToolbar
        search=""
        onSearchChange={vi.fn()}
        selectedAttribute={null}
        onAttributeChange={vi.fn()}
        selectedSpecialty={null}
        onSpecialtyChange={vi.fn()}
        totalAgents={6}
      />,
    )

    // Slice the desktop controls section
    const desktopIndex = html.indexOf('hidden md:flex items-center gap-2')
    expect(desktopIndex).toBeGreaterThan(-1)
    const desktopHtml = html.slice(desktopIndex)

    const attrPos = desktopHtml.indexOf('aria-label="Фильтр по атрибуту"')
    const specPos = desktopHtml.indexOf('aria-label="Фильтр по специальности"')
    const searchPos = desktopHtml.indexOf('placeholder="Поиск агента..."')

    expect(attrPos).toBeGreaterThan(-1)
    expect(specPos).toBeGreaterThan(attrPos)
    // Desktop search input should be placed after both filters
    expect(searchPos).toBeGreaterThan(specPos)
  })

  it('renders reset filters button when specialty filter is active', () => {
    const html = renderToString(
      <RosterToolbar
        search=""
        onSearchChange={vi.fn()}
        selectedAttribute={null}
        onAttributeChange={vi.fn()}
        selectedSpecialty="Stun"
        onSpecialtyChange={vi.fn()}
        totalAgents={6}
      />,
    )

    expect(html).toContain('title="Сбросить фильтры"')
  })

  it('renders reset filters button when attribute filter is active', () => {
    const html = renderToString(
      <RosterToolbar
        search=""
        onSearchChange={vi.fn()}
        selectedAttribute="Ice"
        onAttributeChange={vi.fn()}
        selectedSpecialty={null}
        onSpecialtyChange={vi.fn()}
        totalAgents={6}
      />,
    )

    expect(html).toContain('title="Сбросить фильтры"')
  })
})
