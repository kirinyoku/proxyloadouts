import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AccountState {
  activeAccountId: string | null
  setActiveAccount: (accountId: string) => void
  clearActiveAccount: () => void
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set) => ({
      activeAccountId: null,
      setActiveAccount: (activeAccountId) => set({ activeAccountId }),
      clearActiveAccount: () => set({ activeAccountId: null }),
    }),
    { name: 'pl-active-account' },
  ),
)
