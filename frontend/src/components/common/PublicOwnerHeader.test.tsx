import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { PublicOwnerHeader } from './PublicOwnerHeader'
import type { PublicOwnerInfo } from '@/types'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { uid?: string }) => {
        const dict: Record<string, string> = {
          'sharing.verifiedOwner': 'VERIFIED OWNER',
          'sharing.viewShowcase': 'Витрина в игре',
          'sharing.viewShowcaseTitle': `Перейти к витрине ${options?.uid ?? ''}`,
          'sharing.copyUid': 'Скопировать UID',
          'sharing.share': 'Поделиться',
          'sharing.copyLink': 'Скопировать ссылку',
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

describe('PublicOwnerHeader', () => {
  const verifiedOwner: PublicOwnerInfo = {
    uid: '1504687050',
    region: 'Europe',
    nickname: 'ProxyMaster',
    avatar_url: 'https://example.com/avatar.png',
    is_verified: true,
    discord_username: 'proxyleader#0001',
    discord_avatar_url: 'https://example.com/discord.png',
  }

  const unverifiedOwner: PublicOwnerInfo = {
    uid: '1500000000',
    region: 'America',
    nickname: null,
    avatar_url: null,
    is_verified: false,
  }

  it('renders owner info and discord tag without verified badge', () => {
    const html = renderToString(<PublicOwnerHeader owner={verifiedOwner} />)

    expect(html).toContain('ProxyMaster')
    expect(html).toContain('EU')
    expect(html).toContain('UID 1504687050')
    expect(html).not.toContain('VERIFIED OWNER')
    expect(html).toContain('proxyleader#0001')
    expect(html).toContain('/showcase?uid=1504687050')
    expect(html).toContain('Витрина в игре')
    expect(html).toContain('Поделиться')
  })

  it('renders fallback for unverified owner without discord', () => {
    const html = renderToString(<PublicOwnerHeader owner={unverifiedOwner} />)

    expect(html).toContain('UID 1500000000')
    expect(html).toContain('NA')
    expect(html).not.toContain('VERIFIED OWNER')
    expect(html).not.toContain('proxyleader')
    expect(html).not.toContain('Discord:')
    expect(html).toContain('/showcase?uid=1500000000')
  })

  it('appends target tab query parameter when targetTab prop is provided', () => {
    const htmlPresets = renderToString(
      <PublicOwnerHeader owner={verifiedOwner} targetTab="presets" />,
    )
    expect(htmlPresets).toContain('/showcase?uid=1504687050&amp;tab=presets')

    const htmlSquads = renderToString(
      <PublicOwnerHeader owner={verifiedOwner} targetTab="squads" />,
    )
    expect(htmlSquads).toContain('/showcase?uid=1504687050&amp;tab=squads')
  })
})
