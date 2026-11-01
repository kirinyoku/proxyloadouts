import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { TeamFilterBar } from './TeamFilterBar'
import type { GameAccount } from '@/types'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const dict: Record<string, string> = {
          'teams.searchPlaceholder': 'Поиск отрядов…',
          'teams.statusPublic': 'Отряды: Публичные',
          'teams.statusPrivate': 'Отряды: Скрытые',
          'teams.copyPublicLink': 'Скопировать ссылку на публичные отряды',
          'sharing.linkCopied': 'Ссылка скопирована',
          'sharing.linkStatus_loading': 'Проверка ссылок…',
          'sharing.linkStatus_active': 'Ссылки активны',
          'sharing.linkStatus_inactive': 'Активных ссылок нет',
          'sharing.linkStatus_error': 'Ошибка',
          'sharing.revokeLink': 'Отозвать доступ по ссылке',
          'sharing.revokeConfirm': 'Отозвать все ранее созданные ссылки? Публичный доступ не изменится.',
          'common.cancel': 'Отмена',
          'teams.sortLabel': 'Сортировка',
          'teams.sortNewest': 'Сначала новые',
          'teams.sortOldest': 'Сначала старые',
          'teams.sortName': 'По имени',
          'teams.createSquad': 'Новый отряд',
        }
        return dict[key] ?? key
      },
    }),
  }
})

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}))

const mockAccount: GameAccount = {
  id: 'acc-1',
  uid: '10001',
  nickname: 'Proxy',
  region: 'Europe',
  is_public_teams: true,
  created_at: '2026-03-01T12:00:00Z',
}

describe('TeamFilterBar', () => {
  it('renders search input, sort trigger, and create squad button', () => {
    const html = renderToString(
      <TeamFilterBar
        search=""
        onSearchChange={vi.fn()}
        sortBy="newest"
        onSortChange={vi.fn()}
        totalCount={3}
      />,
    )

    expect(html).toContain('placeholder="Поиск отрядов…"')
    expect(html).toContain('Новый отряд')
    expect(html).toContain('lucide-arrow-up-down')
  })

  it('does not render share button when activeAccount is null', () => {
    const html = renderToString(
      <TeamFilterBar
        search=""
        onSearchChange={vi.fn()}
        sortBy="newest"
        onSortChange={vi.fn()}
        activeAccount={null}
      />,
    )

    expect(html).not.toContain('aria-haspopup="menu"')
    expect(html).not.toContain('Отряды: Публичные')
  })

  it('renders share button with green dot to the left of the time filter select when isPublicTeams is true', () => {
    const html = renderToString(
      <TeamFilterBar
        search=""
        onSearchChange={vi.fn()}
        sortBy="newest"
        onSortChange={vi.fn()}
        activeAccount={mockAccount}
        isPublicTeams={true}
      />,
    )

    expect(html).toContain('aria-haspopup="menu"')
    expect(html).toContain('aria-label="Отряды: Публичные"')
    expect(html).toContain('title="Отряды: Публичные"')
    expect(html).toContain('rounded-full bg-primary')
    expect(html).toContain('lucide-share-2')

    // Verify order in HTML: share button appears before sort trigger (role="combobox")
    const shareIndex = html.indexOf('lucide-share-2')
    const sortComboboxIndex = html.indexOf('role="combobox"')
    expect(shareIndex).toBeGreaterThan(-1)
    expect(sortComboboxIndex).toBeGreaterThan(-1)
    expect(shareIndex).toBeLessThan(sortComboboxIndex)
  })

  it('renders share button without green dot when isPublicTeams is false', () => {
    const html = renderToString(
      <TeamFilterBar
        search=""
        onSearchChange={vi.fn()}
        sortBy="newest"
        onSortChange={vi.fn()}
        activeAccount={mockAccount}
        isPublicTeams={false}
      />,
    )

    expect(html).toContain('aria-haspopup="menu"')
    expect(html).toContain('aria-label="Отряды: Скрытые"')
    expect(html).toContain('title="Отряды: Скрытые"')
    expect(html).not.toContain('rounded-full bg-primary')
    expect(html).toContain('lucide-share-2')
  })
})
