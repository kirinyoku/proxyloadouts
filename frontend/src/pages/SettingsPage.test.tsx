import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { SettingsPage } from './SettingsPage'
import type { GameAccount } from '@/types'

// Mock react-i18next
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { count?: number; uid?: string; date?: string }) => {
        const translations: Record<string, string> = {
          'settings.title': 'Настройки',
          'settings.eyebrow': '// SYSTEM',
          'settings.subtitle': 'Внешний вид и UID',
          'settings.interfaceTitle': 'Интерфейс',
          'settings.interfaceDesc': 'Язык, геометрия углов и анимация фона.',
          'settings.languageTitle': 'Язык интерфейса',
          'settings.languageDesc': 'Выберите язык отображения меню.',
          'settings.cornerStyleTitle': 'Геометрия углов',
          'settings.cornerStyleDesc': 'Форма углов панелей и кнопок.',
          'settings.cornerStyleRounded': 'Скруглённые',
          'settings.cornerStyleSharp': 'Острые',
          'settings.bgAnimationTitle': 'Фоновая анимация',
          'settings.bgAnimationDesc': 'Анимированный фон в стиле ZZZ.',
          'settings.bgAnimationEnabled': 'Вкл',
          'settings.bgAnimationDisabled': 'Выкл',
          'settings.bgAnimationMobileNotice': 'Отключена на мобильных устройствах для экономии ресурсов',
          'settings.accountsTitle': 'Аккаунты',
          'settings.accountsDesc': 'Активный UID используется для сохранения билдов и сборки боевых команд.',
          'settings.noAccounts': 'Привязанных UID пока нет. Первый добавляется ниже.',
          'settings.activeBadge': 'Активный',
          'settings.addedAt': `Добавлен ${options?.date ?? ''}`,
          'settings.makeActive': 'Сделать активным',
          'settings.delete': 'Удалить',
          'settings.deleteDialogTitle': `Удалить аккаунт ${options?.uid ?? ''}?`,
          'settings.addAccountTitle': 'Привязать UID',
          'settings.addAccountDesc': 'UID в игре: отображается внизу экрана или в Профиле Интернота.',
          'settings.addAccountButton': 'Привязать UID',
          'settings.uidPlaceholder': '1504687050',
          'settings.limitReachedAlert': 'Достигнут лимит аккаунтов (3 из 3).',
          'settings.guestAccountsNote': 'Войдите через Discord, чтобы привязать свои игровые аккаунты UID.',
          'settings.guestLoginButton': 'Войти через Discord',
          'settings.dangerZoneTitle': 'Опасная зона',
          'settings.dangerZoneDesc': 'Безвозвратные действия с вашей учетной записью.',
          'settings.deleteAccountTitle': 'Удалить аккаунт',
          'settings.deleteAccountDesc': 'Безвозвратно удаляет профиль, привязанные UID, сборки и отряды. Действие необратимо — восстановить данные невозможно.',
          'settings.deleteAccountButton': 'Удалить аккаунт',
        }
        return translations[key] ?? key
      },
      i18n: {
        language: 'ru',
        changeLanguage: vi.fn(),
      },
    }),
  }
})

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useNavigate: () => mockNavigate,
}))

const mockUseMe = vi.fn()
const mockUseActiveAccount = vi.fn()
const mockUseCornerStyle = vi.fn()
const mockUseBgAnimation = vi.fn()
const mockCreateAccountMutation = { mutate: vi.fn(), isPending: false }
const mockDeleteAccountMutation = { mutate: vi.fn(), isPending: false }
const mockDeleteMeMutation = { mutate: vi.fn(), isPending: false }

vi.mock('@/api/hooks', () => ({
  useMe: () => mockUseMe(),
  useCreateAccount: () => mockCreateAccountMutation,
  useDeleteAccount: () => mockDeleteAccountMutation,
  useDeleteMe: () => mockDeleteMeMutation,
}))

vi.mock('@/hooks/useActiveAccount', () => ({
  useActiveAccount: (options?: { enabled?: boolean }) => mockUseActiveAccount(options),
}))

vi.mock('@/hooks/useCornerStyle', () => ({
  useCornerStyle: () => mockUseCornerStyle(),
}))

vi.mock('@/hooks/useBgAnimation', () => ({
  useBgAnimation: () => mockUseBgAnimation(),
}))

const mockAccount1: GameAccount = {
  id: 'acc-1',
  uid: '1504687050',
  region: 'Europe',
  created_at: '2026-08-22T00:00:00Z',
}

const mockAccount2: GameAccount = {
  id: 'acc-2',
  uid: '1500210768',
  region: 'Europe',
  created_at: '2026-09-22T00:00:00Z',
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCornerStyle.mockReturnValue({
      cornerStyle: 'rounded',
      isSharp: false,
      setCornerStyle: vi.fn(),
    })
    mockUseBgAnimation.mockReturnValue({
      bgAnimation: 'enabled',
      isEnabled: true,
      setBgAnimationMode: vi.fn(),
    })
  })

  it('renders guest state when user is not authenticated', () => {
    mockUseMe.mockReturnValue({ data: null })
    mockUseActiveAccount.mockReturnValue({
      activeAccount: null,
      accounts: [],
      isPending: false,
    })

    const html = renderToString(<SettingsPage />)

    expect(html).toContain('Настройки')
    expect(html).toContain('Войдите через Discord')
    expect(html).not.toContain('Удалить аккаунт')
    expect(html).not.toContain('Опасная зона')
  })

  it('renders accounts list and active account state when authenticated', () => {
    mockUseMe.mockReturnValue({ data: { id: 'usr-1', username: 'ProxyPlayer' } })
    mockUseActiveAccount.mockReturnValue({
      activeAccount: mockAccount1,
      accounts: [mockAccount1, mockAccount2],
      isPending: false,
    })

    const html = renderToString(<SettingsPage />)

    // Check UIDs
    expect(html).toContain('1504687050')
    expect(html).toContain('1500210768')
    // Check Active status
    expect(html).toContain('Активный')
    // Check Inactive account action
    expect(html).toContain('Сделать активным')
    // Check delete buttons
    expect(html).toContain('Удалить')
    // Check add account section
    expect(html).toContain('Привязать UID')
    // Check delete account panel without danger zone title
    expect(html).toContain('Удалить аккаунт')
    expect(html).not.toContain('Опасная зона')
  })

  it('renders account limit notice when 3 accounts are linked', () => {
    const threeAccounts: GameAccount[] = Array.from({ length: 3 }, (_, i) => ({
      id: `acc-${i}`,
      uid: `150000000${i}`,
      region: 'Europe',
      created_at: '2026-09-01T00:00:00Z',
    }))

    mockUseMe.mockReturnValue({ data: { id: 'usr-1', username: 'ProxyPlayer' } })
    mockUseActiveAccount.mockReturnValue({
      activeAccount: threeAccounts[0],
      accounts: threeAccounts,
      isPending: false,
    })

    const html = renderToString(<SettingsPage />)

    expect(html).toContain('Достигнут лимит аккаунтов (3 из 3).')
    expect(html).toContain('3 / 3')
  })

  it('groups the interface preferences into a labelled section without verbose descriptions', () => {
    mockUseMe.mockReturnValue({ data: null })
    mockUseActiveAccount.mockReturnValue({ activeAccount: null, accounts: [], isPending: false })

    const html = renderToString(<SettingsPage />)

    // Numbered section with an accessible name and clean layout
    expect(html).toContain('aria-labelledby="settings-section-01"')
    expect(html).toContain('Интерфейс')
    expect(html).not.toContain('Язык, геометрия углов и анимация фона.')
    expect(html).not.toContain('Выберите язык отображения меню.')
    expect(html).not.toContain('Форма углов панелей и кнопок.')
    expect(html).not.toContain('Анимированный фон в стиле ZZZ.')
    // Corner geometry is a radiogroup with a preview glyph per option
    expect(html).toContain('role="radiogroup"')
    expect(html.match(/role="radio"/g)).toHaveLength(2)
    expect(html).toContain('data-keep-rounded="true"')
    // Background animation is a switch reflecting the enabled mode
    expect(html).toContain('role="switch"')
    expect(html).toContain('aria-checked="true"')
    expect(html).toContain('Вкл')
  })

  it('reflects disabled background animation in the switch state', () => {
    mockUseBgAnimation.mockReturnValue({
      bgAnimation: 'disabled',
      isEnabled: false,
      setBgAnimationMode: vi.fn(),
    })
    mockUseMe.mockReturnValue({ data: null })
    mockUseActiveAccount.mockReturnValue({ activeAccount: null, accounts: [], isPending: false })

    const html = renderToString(<SettingsPage />)

    expect(html).toContain('aria-checked="false"')
    expect(html).toContain('Выкл')
  })

  it('marks the sharp corner style as the selected option', () => {
    mockUseCornerStyle.mockReturnValue({
      cornerStyle: 'sharp',
      isSharp: true,
      setCornerStyle: vi.fn(),
    })
    mockUseMe.mockReturnValue({ data: null })
    mockUseActiveAccount.mockReturnValue({ activeAccount: null, accounts: [], isPending: false })

    const html = renderToString(<SettingsPage />)

    expect(html).toContain('Острые')
    const group = html.slice(html.indexOf('role="radiogroup"'), html.indexOf('role="switch"'))
    expect(group.match(/aria-checked="true"/g)).toHaveLength(1)
    expect(group).toContain('Острые')
  })

  it('renders an empty state when the account list is empty', () => {
    mockUseMe.mockReturnValue({ data: { id: 'usr-1', username: 'ProxyPlayer' } })
    mockUseActiveAccount.mockReturnValue({ activeAccount: null, accounts: [], isPending: false })

    const html = renderToString(<SettingsPage />)

    expect(html).toContain('Привязанных UID пока нет. Первый добавляется ниже.')
    expect(html).toContain('0 / 3')
    // The inline form stays available
    expect(html).toContain('id="uid"')
  })

  it('renders skeleton rows while the accounts query is pending', () => {
    mockUseMe.mockReturnValue({ data: { id: 'usr-1', username: 'ProxyPlayer' } })
    mockUseActiveAccount.mockReturnValue({ activeAccount: null, accounts: [], isPending: true })

    const html = renderToString(<SettingsPage />)

    expect(html).toContain('aria-busy="true"')
    expect(html).not.toContain('Привязанных UID пока нет. Первый добавляется ниже.')
  })

  it('renders delete account section with destructive button and styling when authenticated', () => {
    mockUseMe.mockReturnValue({ data: { id: 'usr-1', username: 'ProxyPlayer' } })
    mockUseActiveAccount.mockReturnValue({ activeAccount: null, accounts: [], isPending: false })

    const html = renderToString(<SettingsPage />)

    expect(html).toContain('Удалить аккаунт')
    expect(html).toContain('Действие необратимо')
    expect(html).toContain('border-destructive/40')
    expect(html).toContain('bg-destructive/10')
    expect(html).toContain('data-variant="destructive"')
  })
})
