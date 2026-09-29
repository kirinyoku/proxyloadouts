import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ShowcaseProfileHeader } from './ShowcaseProfileHeader'
import type { ShowcaseResponse } from '@/types/showcase'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { uid?: string }) => {
        const dict: Record<string, string> = {
          'showcase.liveDataTooltip': 'Свежие данные',
          'showcase.cachedDataTooltip': 'Данные из кэша',
          'showcase.cacheLabel': 'кэш',
          'showcase.cacheReady': 'можно обновить',
          'showcase.refreshNow': 'Обновить сейчас',
          'showcase.refreshAria': 'Обновить данные',
          'showcase.copyUidTitle': 'Скопировать UID',
          'showcase.copyUidAria': 'Скопировать UID',
          'showcase.searchPlaceholder': 'UID Прокси…',
          'showcase.searchTitle': 'Сканировать',
          'showcase.searchAria': 'Показать витрину',
          'showcase.linkUid': 'Привязать UID',
          'common.clear': 'Очистить',
        }
        if (options?.uid) return `Витрина ${options.uid}`
        return dict[key] ?? key
      },
      i18n: { language: 'ru' },
    }),
  }
})

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}))

const mockShowcase: ShowcaseResponse = {
  uid: '1504687050',
  nickname: 'LOWLEVEL',
  region: 'Europe',
  interknot_level: 60,
  avatar_url: 'https://example.com/avatar.png',
  source: 'cached',
  ttl_seconds: 45,
  fetched_at: '2026-09-24T20:00:00Z',
  agent_count: 0,
  agents: [],
}

describe('ShowcaseProfileHeader', () => {
  it('renders player identity correctly with nickname, level, region, and UID', () => {
    const html = renderToString(
      <ShowcaseProfileHeader
        showcase={mockShowcase}
        uidInput="1504687050"
        isUidValid={true}
        isRefetching={false}
        onScan={() => {}}
        onUidInputChange={() => {}}
        onRefresh={() => {}}
      />
    )

    expect(html).toContain('LOWLEVEL')
    expect(html).toMatch(/IL\s*(<!-- -->)?\s*60/)
    expect(html).toContain('EU')
    expect(html).toContain('1504687050')
  })

  it('renders cached status pill with countdown and refresh button', () => {
    const html = renderToString(
      <ShowcaseProfileHeader
        showcase={mockShowcase}
        uidInput="1504687050"
        isUidValid={true}
        isRefetching={false}
        onScan={() => {}}
        onUidInputChange={() => {}}
        onRefresh={() => {}}
      />
    )

    expect(html).toContain('кэш')
    expect(html).toContain('45с')
  })

  it('renders LIVE badge when source is fresh', () => {
    const freshShowcase: ShowcaseResponse = {
      ...mockShowcase,
      source: 'fresh',
      ttl_seconds: 0,
    }

    const html = renderToString(
      <ShowcaseProfileHeader
        showcase={freshShowcase}
        uidInput=""
        isUidValid={false}
        isRefetching={false}
        onScan={() => {}}
        onUidInputChange={() => {}}
        onRefresh={() => {}}
      />
    )

    expect(html).toContain('LIVE')
    expect(html).not.toContain('45с')
  })

  it('renders clear button when uidInput is non-empty', () => {
    const html = renderToString(
      <ShowcaseProfileHeader
        showcase={mockShowcase}
        uidInput="1504687050"
        isUidValid={true}
        isRefetching={false}
        onScan={() => {}}
        onUidInputChange={() => {}}
        onRefresh={() => {}}
      />
    )

    expect(html).toContain('title="Очистить"')
  })

  it('renders separate mobile search row with divider', () => {
    const html = renderToString(
      <ShowcaseProfileHeader
        showcase={mockShowcase}
        uidInput="1504687050"
        isUidValid={true}
        isRefetching={false}
        onScan={() => {}}
        onUidInputChange={() => {}}
        onRefresh={() => {}}
      />
    )

    // Border divider for mobile action row
    expect(html).toContain('border-t border-white/[0.06] sm:border-t-0')
  })
})
