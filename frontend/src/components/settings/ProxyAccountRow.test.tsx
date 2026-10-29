import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ProxyAccountRow } from './ProxyAccountRow'
import type { GameAccount } from '@/types'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { uid?: string; date?: string }) => {
        const translations: Record<string, string> = {
          'settings.activeBadge': 'Active',
          'settings.verifiedBadge': 'VERIFIED',
          'settings.verifyUidButton': 'Verify UID',
          'settings.publicRoster': 'Public Roster',
          'settings.publicTeams': 'Public Squads',
          'settings.showDiscord': 'Show Discord',
          'settings.copyUid': 'Copy UID',
          'settings.makeActive': 'Set as active',
          'settings.delete': 'Delete',
          'settings.addedAt': `Added ${options?.date ?? ''}`,
        }
        return translations[key] ?? key
      },
      i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
  }
})

vi.mock('@/api/hooks', () => ({
  useDeleteAccount: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateAccount: () => ({ mutate: vi.fn(), isPending: false }),
  useStartVerification: () => ({ mutate: vi.fn(), isPending: false }),
  useConfirmVerification: () => ({ mutate: vi.fn(), isPending: false }),
}))

const unverifiedAccount: GameAccount = {
  id: 'acc-1',
  uid: '1504687050',
  region: 'Europe',
  verified_at: null,
  is_public_roster: false,
  is_public_teams: false,
  show_discord: false,
  created_at: '2026-01-01T00:00:00Z',
}

const verifiedAccount: GameAccount = {
  id: 'acc-2',
  uid: '1504687051',
  region: 'Europe',
  verified_at: '2026-01-02T00:00:00Z',
  is_public_roster: true,
  is_public_teams: true,
  show_discord: true,
  created_at: '2026-01-02T00:00:00Z',
}

describe('ProxyAccountRow', () => {
  it('renders verify button and no verified badge for unverified account', () => {
    const html = renderToString(
      <ProxyAccountRow account={unverifiedAccount} isActive={false} />,
    )
    expect(html).toContain('Verify UID')
    expect(html).not.toContain('VERIFIED')
    expect(html).not.toContain('Public Roster')
    expect(html).not.toContain('Public Squads')
    expect(html).not.toContain('Show Discord')
  })

  it('renders verified badge and privacy toggles for verified account', () => {
    const html = renderToString(
      <ProxyAccountRow account={verifiedAccount} isActive={true} />,
    )
    expect(html).toContain('VERIFIED')
    expect(html).toContain('Public Roster')
    expect(html).toContain('Public Squads')
    expect(html).toContain('Show Discord')
    expect(html).not.toContain('Verify UID')
  })
})
