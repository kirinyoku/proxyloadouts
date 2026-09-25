import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { UserMenu } from './UserMenu'
import { useAccountStore } from '@/store/useAccountStore'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; uid?: string }) => {
      if (options?.count !== undefined) return `${key}:${options.count}`
      if (options?.uid !== undefined) return `${key}:${options.uid}`
      return key
    },
    i18n: {
      language: 'ru',
      changeLanguage: vi.fn(),
    },
  }),
}))

const mockNavigate = vi.fn()
let currentPathname = '/showcase'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    pathname: currentPathname,
    search: '',
  }),
}))

const mockUser = {
  id: 'usr-1',
  username: 'ProxyPlayer',
  avatar_url: 'https://example.com/avatar.png',
}

const mockAccounts = [
  {
    id: 'acc-1',
    user_id: 'usr-1',
    uid: '1500000001',
    region: 'Europe',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'acc-2',
    user_id: 'usr-1',
    uid: '1500000002',
    region: 'America',
    created_at: '2026-01-02T00:00:00Z',
  },
]

vi.mock('@/api/hooks', () => ({
  useMe: () => ({ data: { user: mockUser } }),
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
  useAccounts: () => ({ data: mockAccounts, isPending: false }),
}))

vi.mock('@/hooks/useActiveAccount', () => ({
  useActiveAccount: () => ({
    activeAccount: mockAccounts[0],
    accounts: mockAccounts,
    isPending: false,
  }),
}))

// Mock dropdown-menu to render content directly during server rendering
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void; asChild?: boolean; variant?: string }) => (
    <button type="button" data-testid="dropdown-item" onClick={onClick}>{children}</button>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuSub: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSubTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSubContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('UserMenu component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAccountStore.getState().clearActiveAccount()
    currentPathname = '/showcase'
  })

  it('renders user details and active account information', () => {
    const html = renderToString(<UserMenu />)

    expect(html).toContain('ProxyPlayer')
    expect(html).toContain('1500000001')
    expect(html).toContain('EU')
    expect(html).toContain('userMenu.accounts')
    expect(html).toContain('2 / 3')
    // Ensure user info snippet is visible on mobile (not hidden sm:flex)
    expect(html).not.toMatch(/class="[^"]*hidden[^"]*flex-col/)
  })

  it('renders both saved accounts in the dropdown', () => {
    const html = renderToString(<UserMenu />)

    expect(html).toContain('1500000001')
    expect(html).toContain('1500000002')
  })

  it('updates active account in account store when selected', () => {
    const account = mockAccounts[1]
    expect(account).toBeDefined()
    if (!account) return

    const setActiveAccount = useAccountStore.getState().setActiveAccount
    setActiveAccount(account.id)
    expect(useAccountStore.getState().activeAccountId).toBe('acc-2')
  })
})

