import type { Attribute, Specialty, Rarity } from '@/types/agent'
import type { Build } from '@/types/build'
import type { TeamMember } from '@/types/team'
import { agentRoleCircleUrl } from '@/lib/agent-icons'

/** Maximum allowed runes in a note. Matches backend limit. */
export const NOTE_MAX_RUNES = 500

/** Subject member representation for team notes. */
export type NoteTeamMember = {
  agentId: number | null
  agentName: string
  avatarUrl: string
  attribute?: Attribute
}

/** Subject target of the note editor. */
export type NoteSubject =
  | {
      kind: 'build'
      name: string
      agentId: number | null
      agentName: string
      avatarUrl: string
      attribute?: Attribute
      specialty?: Specialty
      rarity?: Rarity
      mindscape?: number
      wEngineName?: string
    }
  | {
      kind: 'team'
      name: string
      members: NoteTeamMember[]
    }

/** Non-empty patch payload for updating build or team notes. */
export type NotePatch =
  | { description: string | null; is_note_public?: boolean }
  | { description?: string | null; is_note_public: boolean }

/** Evaluated save intent for a note modal draft. */
export type NoteCommitPlan =
  | { kind: 'noop' }
  | { kind: 'over_limit'; runes: number; excess: number }
  | { kind: 'patch'; patch: NotePatch }

/** Parsed structural element of a formatted note. */
export type NoteBlock =
  | { kind: 'rotation_chain'; steps: string[] }
  | { kind: 'advisory'; tag: string; text: string }
  | { kind: 'ordered_list'; items: string[] }
  | { kind: 'bullet_list'; items: string[] }
  | { kind: 'paragraph'; text: string }

/** Save transaction lifecycle phase. */
export type NoteSavePhase = 'idle' | 'confirm_discard' | 'saving'

/** State tree for the note modal dialog. */
export type NoteModalState =
  | { kind: 'closed' }
  | { kind: 'viewing' }
  | {
      kind: 'editing'
      draft: string
      draftIsPublic: boolean
      savePhase: NoteSavePhase
      saveFailed: boolean
    }

/** State transition action for the note modal reducer. */
export type NoteModalAction =
  | { type: 'open_view' }
  | {
      type: 'open_edit'
      baselineNote: string | null | undefined
      baselineIsPublic: boolean
    }
  | { type: 'set_draft'; draft: string }
  | { type: 'set_visibility'; isPublic: boolean }
  | { type: 'request_close'; dirty: boolean }
  | { type: 'cancel_discard' }
  | { type: 'confirm_discard' }
  | { type: 'submit_start' }
  | { type: 'submit_failed' }
  | { type: 'submit_succeeded' }
  | { type: 'reset_closed' }

/** Counts Unicode code points in text, matching Go utf8.RuneCountInString. */
export function countNoteRunes(text: string): number {
  return [...text].length
}

/** Normalizes note text by trimming whitespace and converting nil values to empty string. */
export function normalizeNoteText(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

/** Determines whether note contents or visibility diverge from baseline. */
export function isNoteDirty(args: {
  draft: string
  baselineNote: string | null | undefined
  draftIsPublic: boolean
  baselineIsPublic: boolean
}): boolean {
  const trimmedDraft = args.draft.trim()
  const normalizedBaseline = normalizeNoteText(args.baselineNote)
  return trimmedDraft !== normalizedBaseline || args.draftIsPublic !== args.baselineIsPublic
}

/** Calculates the minimal patch payload or over-limit condition for saving a note. */
export function planNoteCommit(args: {
  draft: string
  baselineNote: string | null | undefined
  draftIsPublic: boolean
  baselineIsPublic: boolean
}): NoteCommitPlan {
  const trimmed = args.draft.trim()
  const normalizedBaseline = normalizeNoteText(args.baselineNote)
  const textChanged = trimmed !== normalizedBaseline
  const visibilityChanged = args.draftIsPublic !== args.baselineIsPublic

  if (!textChanged && !visibilityChanged) {
    return { kind: 'noop' }
  }

  const runes = countNoteRunes(trimmed)
  if (textChanged && runes > NOTE_MAX_RUNES) {
    return { kind: 'over_limit', runes, excess: runes - NOTE_MAX_RUNES }
  }

  if (textChanged && visibilityChanged) {
    return {
      kind: 'patch',
      patch: {
        description: trimmed === '' ? null : trimmed,
        is_note_public: args.draftIsPublic,
      },
    }
  }

  if (textChanged) {
    return {
      kind: 'patch',
      patch: {
        description: trimmed === '' ? null : trimmed,
      },
    }
  }

  return {
    kind: 'patch',
    patch: {
      is_note_public: args.draftIsPublic,
    },
  }
}

const ADVISORY_PATTERN = /^\[([^\]]{1,24})\]\s+(\S.*)$/
const BULLET_PATTERN = /^[-*•]\s+(\S.*)$/
const ORDERED_PATTERN = /^\d+[.)]\s+(\S.*)$/

type BlockAccumulator =
  | { kind: 'ordered_list'; items: string[] }
  | { kind: 'bullet_list'; items: string[] }
  | { kind: 'paragraph'; text: string }

/** Parses unstructured note text into semantic structural blocks. */
export function parseNoteBlocks(note: string): NoteBlock[] {
  if (note.trim() === '') {
    return []
  }

  const lines = note.split(/\r?\n/)
  const blocks: NoteBlock[] = []
  let current: BlockAccumulator | null = null

  const flush = () => {
    if (current !== null) {
      blocks.push(current)
      current = null
    }
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (trimmed === '') {
      flush()
      continue
    }

    const advisoryMatch = ADVISORY_PATTERN.exec(trimmed)
    if (advisoryMatch !== null) {
      const tag = advisoryMatch[1]?.trim() ?? ''
      const text = advisoryMatch[2]?.trim() ?? ''
      if (tag.length > 0 && text.length > 0) {
        flush()
        blocks.push({ kind: 'advisory', tag, text })
        continue
      }
    }

    const bulletMatch = BULLET_PATTERN.exec(trimmed)
    if (bulletMatch !== null) {
      const item = bulletMatch[1]?.trim() ?? ''
      if (current?.kind === 'bullet_list') {
        current.items.push(item)
      } else {
        flush()
        current = { kind: 'bullet_list', items: [item] }
      }
      continue
    }

    const orderedMatch = ORDERED_PATTERN.exec(trimmed)
    if (orderedMatch !== null) {
      const item = orderedMatch[1]?.trim() ?? ''
      if (current?.kind === 'ordered_list') {
        current.items.push(item)
      } else {
        flush()
        current = { kind: 'ordered_list', items: [item] }
      }
      continue
    }

    if (trimmed.includes('→') || trimmed.includes('->')) {
      const steps = trimmed
        .split(/→|->/)
        .map((step) => step.trim())
        .filter((step) => step.length > 0)
      if (steps.length >= 2) {
        flush()
        blocks.push({ kind: 'rotation_chain', steps })
        continue
      }
    }

    if (current?.kind === 'paragraph') {
      current.text += `\n${trimmed}`
    } else {
      flush()
      current = { kind: 'paragraph', text: trimmed }
    }
  }

  flush()
  return blocks
}

/** Constructs a NoteSubject for a build, null-safe for partial mocks. */
export function toBuildNoteSubject(build: Build, avatarUrl?: string): NoteSubject {
  const agentId = build.agent_id ?? build.build_data?.id ?? null
  const fallbackAvatar = agentId !== null ? (agentRoleCircleUrl(agentId) ?? '') : ''
  return {
    kind: 'build',
    name: build.name || build.agent_name || build.build_data?.name || '',
    agentId,
    agentName: build.agent_name || build.build_data?.name || '',
    avatarUrl: avatarUrl ?? fallbackAvatar,
    attribute: build.build_data?.attribute,
    specialty: build.build_data?.specialty,
    rarity: build.build_data?.rarity,
    mindscape: build.build_data?.mindscape_cinema,
    wEngineName: build.build_data?.w_engine?.name,
  }
}

/** Constructs a NoteSubject for a squad, ordering members by slot number. */
export function toTeamNoteSubject(
  name: string,
  members: readonly TeamMember[],
  getAvatarUrl?: (agentId: number) => string | undefined,
): NoteSubject {
  const sorted = [...members].sort((a, b) => a.slot_number - b.slot_number)
  return {
    kind: 'team',
    name,
    members: sorted.map((m) => {
      const agentId = m.build.agent_id ?? m.build.build_data?.id ?? null
      const url =
        (agentId !== null && getAvatarUrl ? getAvatarUrl(agentId) : undefined) ??
        (agentId !== null ? (agentRoleCircleUrl(agentId) ?? '') : '')
      return {
        agentId,
        agentName: m.build.agent_name || m.build.build_data?.name || '',
        avatarUrl: url,
        attribute: m.build.build_data?.attribute,
      }
    }),
  }
}

/** State machine reducer for the note modal dialog. */
export function noteModalReducer(
  state: NoteModalState,
  action: NoteModalAction,
): NoteModalState {
  switch (action.type) {
    case 'open_view':
      return { kind: 'viewing' }

    case 'open_edit':
      return {
        kind: 'editing',
        draft: action.baselineNote ?? '',
        draftIsPublic: action.baselineIsPublic,
        savePhase: 'idle',
        saveFailed: false,
      }

    case 'reset_closed':
      return { kind: 'closed' }

    case 'set_draft': {
      if (state.kind !== 'editing') return state
      return {
        ...state,
        draft: action.draft,
        savePhase: state.savePhase === 'confirm_discard' ? 'idle' : state.savePhase,
        saveFailed: false,
      }
    }

    case 'set_visibility': {
      if (state.kind !== 'editing') return state
      return {
        ...state,
        draftIsPublic: action.isPublic,
        savePhase: state.savePhase === 'confirm_discard' ? 'idle' : state.savePhase,
        saveFailed: false,
      }
    }

    case 'request_close': {
      if (state.kind === 'closed') return state
      if (state.kind === 'viewing') return { kind: 'closed' }
      if (state.savePhase === 'saving') return state
      if (action.dirty) {
        return {
          ...state,
          savePhase: 'confirm_discard',
        }
      }
      return { kind: 'closed' }
    }

    case 'cancel_discard': {
      if (state.kind !== 'editing') return state
      return {
        ...state,
        savePhase: 'idle',
      }
    }

    case 'confirm_discard': {
      if (state.kind !== 'editing') return state
      return { kind: 'closed' }
    }

    case 'submit_start': {
      if (state.kind !== 'editing') return state
      return {
        ...state,
        savePhase: 'saving',
        saveFailed: false,
      }
    }

    case 'submit_failed': {
      if (state.kind !== 'editing') return state
      return {
        ...state,
        savePhase: 'idle',
        saveFailed: true,
      }
    }

    case 'submit_succeeded': {
      if (state.kind !== 'editing') return state
      return { kind: 'closed' }
    }
  }
}
