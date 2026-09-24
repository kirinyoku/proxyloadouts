import { useAccounts } from '@/api/hooks'
import type { GameAccount } from '@/types'
import { useAccountStore } from '@/store/useAccountStore'

interface UseActiveAccountOptions {
  enabled?: boolean
}

interface UseActiveAccountResult {
  activeAccount: GameAccount | null
  accounts: GameAccount[]
  isPending: boolean
}

/**
 * Returns the currently active game account, list of user accounts, and loading status.
 * Purely derived state without effect-driven store synchronization.
 */
export function useActiveAccount(options?: UseActiveAccountOptions): UseActiveAccountResult {
  const enabled = options?.enabled ?? true
  const { data: accounts = [], isPending } = useAccounts({ enabled })
  const activeAccountId = useAccountStore((state) => state.activeAccountId)

  const activeAccount =
    accounts.find((account) => account.id === activeAccountId) ?? accounts[0] ?? null

  return { activeAccount, accounts, isPending }
}
