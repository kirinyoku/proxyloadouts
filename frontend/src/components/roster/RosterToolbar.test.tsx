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

  it('omits visible text labels "Attribute" and "Specialty" to preserve compact toolbar layout', () => {
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

    // No visible label text taking up horizontal space
    expect(html).not.toContain('Атрибут:')
    expect(html).not.toContain('Специальность:')
    expect(html).not.toContain('Attribute:')
    expect(html).not.toContain('Specialty:')
    // Accessibility labels on groups remain intact
    expect(html).toContain('aria-label="Фильтр по атрибуту"')
    expect(html).toContain('aria-label="Фильтр по специальности"')
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

  it('applies calm, neutral and uniform active styling to selected attribute without neon colored glow', () => {
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

    // Neutral active style present on the active button
    expect(html).toContain('border-white/40 bg-white/20')
    // No element-specific colored border or glow
    expect(html).not.toContain('border-[#98eff0]')
    expect(html).not.toContain('shadow-[0_0_10px')
    expect(html).not.toContain('ring-[#98eff0]')
  })

  it('applies the exact same calm neutral active styling to selected specialty as attribute', () => {
    const html = renderToString(
      <RosterToolbar
        search=""
        onSearchChange={vi.fn()}
        selectedAttribute={null}
        onAttributeChange={vi.fn()}
        selectedSpecialty="Attack"
        onSpecialtyChange={vi.fn()}
        totalAgents={6}
      />,
    )

    // Identical neutral styling on active specialty button
    expect(html).toContain('border-white/40 bg-white/20')
    // No neon green colored glow on specialty button
    expect(html).not.toContain('shadow-[0_0_10px_rgba(201,242,75')
    expect(html).not.toContain('ring-primary/60')
  })

  it('disables filter buttons and sets cursor-not-allowed for attributes not in the roster', () => {
    // Only Electric is available in roster
    const availableAttributes = new Set<any>(['Electric'])

    const html = renderToString(
      <RosterToolbar
        search=""
        onSearchChange={vi.fn()}
        selectedAttribute={null}
        onAttributeChange={vi.fn()}
        selectedSpecialty={null}
        onSpecialtyChange={vi.fn()}
        totalAgents={1}
        availableAttributes={availableAttributes}
      />,
    )

    // Unavailable buttons have disabled attribute, aria-disabled and cursor-not-allowed
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain('cursor-not-allowed')
  })

  it('disables filter buttons for specialties not in the roster', () => {
    // Only Attack is available in roster
    const availableSpecialties = new Set<any>(['Attack'])

    const html = renderToString(
      <RosterToolbar
        search=""
        onSearchChange={vi.fn()}
        selectedAttribute={null}
        onAttributeChange={vi.fn()}
        selectedSpecialty={null}
        onSpecialtyChange={vi.fn()}
        totalAgents={1}
        availableSpecialties={availableSpecialties}
      />,
    )

    // Unavailable specialty buttons (e.g. Armorer) have disabled and cursor-not-allowed
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain('cursor-not-allowed')
  })

  it('omits h1 heading and title when hideTitle is true', () => {
    const html = renderToString(
      <RosterToolbar
        search=""
        onSearchChange={vi.fn()}
        selectedAttribute={null}
        onAttributeChange={vi.fn()}
        selectedSpecialty={null}
        onSpecialtyChange={vi.fn()}
        totalAgents={6}
        hideTitle
      />,
    )

    // Heading and title should not be rendered
    expect(html).not.toContain('<h1')
    expect(html).not.toContain('РОСТЕР')
    expect(html).not.toContain('font-heading')

    // Filter controls and search are still present
    expect(html).toContain('aria-label="Фильтр по атрибуту"')
    expect(html).toContain('aria-label="Фильтр по специальности"')
    expect(html).toContain('placeholder="Поиск агента..."')
  })

  it('renders desktop filters with full-width justification when hideTitle is true', () => {
    const html = renderToString(
      <RosterToolbar
        search=""
        onSearchChange={vi.fn()}
        selectedAttribute={null}
        onAttributeChange={vi.fn()}
        selectedSpecialty={null}
        onSpecialtyChange={vi.fn()}
        totalAgents={6}
        hideTitle
      />,
    )

    expect(html).toContain('hidden md:flex items-center gap-2 w-full justify-between')
  })
})
