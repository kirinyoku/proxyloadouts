import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { VerifyUidDialog } from './VerifyUidDialog'
import type { GameAccount } from '@/types'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { seconds?: number }) => {
        const translations: Record<string, string> = {
          'settings.verifyDialogTitle': 'Verify UID Ownership',
          'settings.verifyDialogDesc': 'Confirm ownership via in-game profile signature',
          'settings.verifyCodeLabel': 'Verification Code',
          'settings.copyCode': 'Copy code',
          'settings.verifyStep1': 'Paste code into signature',
          'settings.verifyStep2': 'Exit to game menu to sync',
          'settings.verifyStep3': 'Click check button below',
          'settings.verifyCheckButton': 'Check',
          'settings.verifyCooldown': `Retry in ${options?.seconds ?? 30}s`,
          'common.cancel': 'Cancel',
        }
        return translations[key] ?? key
      },
      i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
  }
})

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

const mockStartMutate = vi.fn()
const mockConfirmMutate = vi.fn()

const mockUseStartVerification = vi.fn().mockReturnValue({
  mutate: mockStartMutate,
  isPending: false,
  isError: false,
  error: null,
})

vi.mock('@/api/hooks', () => ({
  useStartVerification: () => mockUseStartVerification(),
  useConfirmVerification: () => ({
    mutate: mockConfirmMutate,
    isPending: false,
  }),
}))

const account: GameAccount = {
  id: 'acc-1',
  uid: '1504687050',
  region: 'Europe',
  verified_at: null,
  is_public_showcase: false,
  show_discord: false,
  created_at: '2026-01-01T00:00:00Z',
}

describe('VerifyUidDialog', () => {
  it('renders instructions and verify action', () => {
    const html = renderToString(
      <VerifyUidDialog
        account={account}
        open={true}
        onOpenChange={vi.fn()}
      />,
    )

    expect(html).toContain('Verify UID Ownership')
    expect(html).toContain('Paste code into signature')
    expect(html).toContain('Exit to game menu to sync')
    expect(html).toContain('Click check button below')
    expect(html).toContain('Check')
  })

  it('renders error state and retry action when challenge request fails', () => {
    mockUseStartVerification.mockReturnValueOnce({
      mutate: mockStartMutate,
      isPending: false,
      isError: true,
      error: new Error('Rate limit exceeded'),
    })

    const html = renderToString(
      <VerifyUidDialog
        account={account}
        open={true}
        onOpenChange={vi.fn()}
      />,
    )

    expect(html).toContain('common.retry')
    expect(html).not.toContain('Verification Code')
  })
})
