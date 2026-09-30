import { create } from 'zustand'

export type SlotNumber = 1 | 2 | 3

type Slots = [string | null, string | null, string | null]

const EMPTY_SLOTS: Slots = [null, null, null]

interface TeamDraftState {
  name: string
  description: string
  slots: Slots
  setSlot: (slot: SlotNumber, buildId: string) => void
  clearSlot: (slot: SlotNumber) => void
  setName: (name: string) => void
  setDescription: (description: string) => void
  reset: () => void
}

function withSlot(slots: Slots, slot: SlotNumber, buildId: string | null): Slots {
  const next = [...slots] as Slots
  next[slot - 1] = buildId
  return next
}

export const useTeamDraftStore = create<TeamDraftState>()((set) => ({
  name: '',
  description: '',
  slots: [...EMPTY_SLOTS],
  setSlot: (slot, buildId) =>
    set((state) => ({ slots: withSlot(state.slots, slot, buildId) })),
  clearSlot: (slot) => set((state) => ({ slots: withSlot(state.slots, slot, null) })),
  setName: (name) => set({ name }),
  setDescription: (description) => set({ description }),
  reset: () => set({ name: '', description: '', slots: [...EMPTY_SLOTS] }),
}))
