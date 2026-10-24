import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { SaveBuildDialog } from './SaveBuildDialog'
import type { Agent, GameAccount } from '@/types'

const mockGameAccount: GameAccount = {
  id: 'acc-1',
  uid: '1500888999',
  region: 'Europe',
  created_at: '2026-09-01T12:00:00Z',
}

const mockEllenAgent: Agent = {
  id: 1191,
  name: 'Эллен',
  level: 60,
  promotion: 6,
  mindscape_cinema: 2,
  core_skill_enhancement: 6,
  rarity: 'S',
  attribute: 'Ice',
  attribute_name: 'Лед',
  specialty: 'Attack',
  specialty_name: 'Нападение',
  skin: null,
  splash_art_url: 'https://static.nanoka.cc/assets/zzz/IconRoleCircle21.webp',
  skills: [],
  w_engine: null,
}

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string | Record<string, unknown>) => {
        if (typeof fallback === 'string') return fallback
        return key
      },
      i18n: { language: 'ru' },
    }),
  }
})

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open = true }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div data-slot="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock('@/api/hooks', () => ({
  useSaveBuild: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  }),
  useMe: () => ({
    data: undefined,
    isLoading: false,
  }),
}))

describe('SaveBuildDialog', () => {
  it('renders agent name, UID and quota in normal state', () => {
    const html = renderToString(
      <SaveBuildDialog
        agent={mockEllenAgent}
        targetAccount={mockGameAccount}
        existingBuildsCount={2}
        open={true}
        onOpenChange={() => {}}
      />,
    )

    expect(html).toContain('Эллен')
    expect(html).toContain(mockGameAccount.uid)
    expect(html).toContain(mockGameAccount.region)
    expect(html).toContain('2 / 10')
    expect(html).toContain('saveBuild.namePlaceholder')
    expect(html).toContain('saveBuild.descPlaceholder')
    expect(html).toContain('saveBuild.nameRequiredHint')
    expect(html).toMatch(/<button[^>]*disabled[^>]*>saveBuild\.submit<\/button>/)
  })

  it('renders limit reached alert when quota is full (10 of 10)', () => {
    const html = renderToString(
      <SaveBuildDialog
        agent={mockEllenAgent}
        targetAccount={mockGameAccount}
        existingBuildsCount={10}
        open={true}
        onOpenChange={() => {}}
      />,
    )

    expect(html).toContain('10 / 10')
    expect(html).toContain('saveBuild.limitReachedTitle')
    expect(html).toContain('href="/roster"')
  })

  it('returns null if agent is not provided', () => {
    const html = renderToString(
      <SaveBuildDialog
        agent={null}
        targetAccount={mockGameAccount}
        existingBuildsCount={0}
        open={true}
        onOpenChange={() => {}}
      />,
    )

    expect(html).toBe('')
  })
})
