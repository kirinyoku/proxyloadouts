import { describe, expect, it } from 'vitest'
import { agentRoleCircleUrl } from '@/lib/agent-icons'
import {
  countNoteRunes,
  isNoteDirty,
  normalizeNoteText,
  noteModalReducer,
  parseNoteBlocks,
  planNoteCommit,
  toBuildNoteSubject,
  toTeamNoteSubject,
} from './note-model'
import type { NoteModalState } from './note-model'

describe('countNoteRunes', () => {
  it('counts ASCII characters identically to string length', () => {
    expect(countNoteRunes('')).toBe(0)
    expect(countNoteRunes('a')).toBe(1)
    expect(countNoteRunes('Rotation combo 123')).toBe(18)
  })

  it('counts Cyrillic characters correctly as single code points', () => {
    expect(countNoteRunes('Привет')).toBe(6)
    expect(countNoteRunes('Ротация для Мияби')).toBe(17)
  })

  it('counts 4-byte emojis as single runes unlike UTF-16 code units', () => {
    expect('🔥'.length).toBe(2)
    expect(countNoteRunes('🔥')).toBe(1)

    expect('🦊'.length).toBe(2)
    expect(countNoteRunes('🦊')).toBe(1)

    const mixed = 'Miyabi 🔥 + Yanagi 🦊'
    expect(mixed.length).toBe(21)
    expect(countNoteRunes(mixed)).toBe(19)
  })

  it('evaluates exact 500 rune boundary with surrogate pairs', () => {
    const exactly500Emojis = '🔥'.repeat(500)
    expect(exactly500Emojis.length).toBe(1000)
    expect(countNoteRunes(exactly500Emojis)).toBe(500)

    const over500Emojis = '🔥'.repeat(501)
    expect(countNoteRunes(over500Emojis)).toBe(501)
  })
})

describe('normalizeNoteText', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeNoteText('  tactics  ')).toBe('tactics')
    expect(normalizeNoteText('\n\nnotes\n')).toBe('notes')
  })

  it('coerces null and undefined to empty string', () => {
    expect(normalizeNoteText(null)).toBe('')
    expect(normalizeNoteText(undefined)).toBe('')
    expect(normalizeNoteText('')).toBe('')
    expect(normalizeNoteText('   ')).toBe('')
  })
})

describe('toBuildNoteSubject', () => {
  it('maps full build object cleanly into NoteSubject', () => {
    const build = {
      id: 'b-1',
      game_account_id: 'acc-1',
      agent_id: 1011,
      agent_name: 'Ellen Joe',
      name: 'Main DPS',
      description: 'Ice tactics',
      weapon_uid: null,
      weapon_id: null,
      disc_uids: [],
      is_public: true,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      build_data: {
        id: 1011,
        name: 'Ellen Joe',
        attribute: 'Ice' as const,
        specialty: 'Attack' as const,
        rarity: 'S' as const,
        mindscape_cinema: 2,
        w_engine: { name: 'Deep Sea Visitor' },
      },
    }

    const subject = toBuildNoteSubject(build as any)
    expect(subject).toEqual({
      kind: 'build',
      name: 'Main DPS',
      agentId: 1011,
      agentName: 'Ellen Joe',
      avatarUrl: agentRoleCircleUrl(1011) ?? '',
      attribute: 'Ice',
      specialty: 'Attack',
      rarity: 'S',
      mindscape: 2,
      wEngineName: 'Deep Sea Visitor',
    })
  })

  it('tolerates sparse mock build objects without throwing', () => {
    const sparse = {
      id: 'b-2',
      game_account_id: 'acc-1',
      name: '',
      agent_id: 0,
      agent_name: '',
      description: null,
      weapon_uid: null,
      weapon_id: null,
      disc_uids: [],
      is_public: false,
      created_at: '',
      updated_at: '',
      build_data: undefined as any,
    }
    const subject = toBuildNoteSubject(sparse as any, 'custom.png')
    expect(subject).toMatchObject({
      kind: 'build',
      avatarUrl: 'custom.png',
    })
  })
})

describe('toTeamNoteSubject', () => {
  it('sorts members by slot_number ascending and maps metadata', () => {
    const members = [
      {
        slot_number: 3,
        build: {
          id: 'b-3',
          agent_id: 1131,
          agent_name: 'Soukaku',
          build_data: { attribute: 'Ice' as const },
        },
      },
      {
        slot_number: 1,
        build: {
          id: 'b-1',
          agent_id: 1011,
          agent_name: 'Ellen Joe',
          build_data: { attribute: 'Ice' as const },
        },
      },
      {
        slot_number: 2,
        build: {
          id: 'b-2',
          agent_id: 1141,
          agent_name: 'Lycaon',
          build_data: { attribute: 'Ice' as const },
        },
      },
    ]

    const subject = toTeamNoteSubject('Victoria Ice', members as any)
    expect(subject.kind).toBe('team')
    if (subject.kind === 'team') {
      expect(subject.name).toBe('Victoria Ice')
      expect(subject.members.map((m) => m.agentName)).toEqual(['Ellen Joe', 'Lycaon', 'Soukaku'])
      expect(subject.members[0]?.avatarUrl).toBe(agentRoleCircleUrl(1011))
    }
  })
})

describe('isNoteDirty', () => {
  it('returns false when text and visibility are equivalent', () => {
    expect(
      isNoteDirty({
        draft: 'Combo plan',
        baselineNote: 'Combo plan',
        draftIsPublic: false,
        baselineIsPublic: false,
      }),
    ).toBe(false)

    expect(
      isNoteDirty({
        draft: '  Combo plan  ',
        baselineNote: 'Combo plan',
        draftIsPublic: true,
        baselineIsPublic: true,
      }),
    ).toBe(false)

    expect(
      isNoteDirty({
        draft: '   ',
        baselineNote: null,
        draftIsPublic: false,
        baselineIsPublic: false,
      }),
    ).toBe(false)
  })

  it('returns true when draft text is edited', () => {
    expect(
      isNoteDirty({
        draft: 'New tactic',
        baselineNote: 'Old tactic',
        draftIsPublic: false,
        baselineIsPublic: false,
      }),
    ).toBe(true)
  })

  it('returns true when visibility is toggled', () => {
    expect(
      isNoteDirty({
        draft: 'Unchanged note',
        baselineNote: 'Unchanged note',
        draftIsPublic: true,
        baselineIsPublic: false,
      }),
    ).toBe(true)
  })
})

describe('planNoteCommit', () => {
  it('returns noop when draft matches baseline exactly', () => {
    expect(
      planNoteCommit({
        draft: 'Existing plan',
        baselineNote: 'Existing plan',
        draftIsPublic: false,
        baselineIsPublic: false,
      }),
    ).toEqual({ kind: 'noop' })
  })

  it('returns noop when difference is only surrounding whitespace', () => {
    expect(
      planNoteCommit({
        draft: '   Existing plan   ',
        baselineNote: 'Existing plan',
        draftIsPublic: true,
        baselineIsPublic: true,
      }),
    ).toEqual({ kind: 'noop' })

    expect(
      planNoteCommit({
        draft: '   ',
        baselineNote: null,
        draftIsPublic: false,
        baselineIsPublic: false,
      }),
    ).toEqual({ kind: 'noop' })
  })

  it('returns patch with description when new note is added', () => {
    expect(
      planNoteCommit({
        draft: 'Fresh guide',
        baselineNote: null,
        draftIsPublic: false,
        baselineIsPublic: false,
      }),
    ).toEqual({
      kind: 'patch',
      patch: { description: 'Fresh guide' },
    })
  })

  it('returns patch with null description when note is cleared', () => {
    expect(
      planNoteCommit({
        draft: '   ',
        baselineNote: 'Old guide',
        draftIsPublic: false,
        baselineIsPublic: false,
      }),
    ).toEqual({
      kind: 'patch',
      patch: { description: null },
    })
  })

  it('returns patch with visibility only when draft text is unchanged', () => {
    expect(
      planNoteCommit({
        draft: 'Unchanged guide',
        baselineNote: 'Unchanged guide',
        draftIsPublic: true,
        baselineIsPublic: false,
      }),
    ).toEqual({
      kind: 'patch',
      patch: { is_note_public: true },
    })
  })

  it('returns compound patch when both text and visibility changed', () => {
    expect(
      planNoteCommit({
        draft: 'Updated guide',
        baselineNote: 'Old guide',
        draftIsPublic: true,
        baselineIsPublic: false,
      }),
    ).toEqual({
      kind: 'patch',
      patch: {
        description: 'Updated guide',
        is_note_public: true,
      },
    })
  })

  it('allows exactly 500 runes of text or emojis', () => {
    const exactly500 = '🔥'.repeat(500)
    const result = planNoteCommit({
      draft: exactly500,
      baselineNote: null,
      draftIsPublic: false,
      baselineIsPublic: false,
    })
    expect(result).toEqual({
      kind: 'patch',
      patch: { description: exactly500 },
    })
  })

  it('returns over_limit when text exceeds 500 runes', () => {
    const over500 = '🔥'.repeat(501)
    const result = planNoteCommit({
      draft: over500,
      baselineNote: null,
      draftIsPublic: false,
      baselineIsPublic: false,
    })
    expect(result).toEqual({
      kind: 'over_limit',
      runes: 501,
      excess: 1,
    })
  })
})

describe('parseNoteBlocks', () => {
  it('returns empty array for empty or whitespace-only text', () => {
    expect(parseNoteBlocks('')).toEqual([])
    expect(parseNoteBlocks('   \n  \n\t')).toEqual([])
  })

  it('parses standalone rotation chains with unicode or ascii arrows', () => {
    const text = 'Miyabi → Soukaku → Nicole\n\nEllen -> Lycaon -> Rina'
    expect(parseNoteBlocks(text)).toEqual([
      {
        kind: 'rotation_chain',
        steps: ['Miyabi', 'Soukaku', 'Nicole'],
      },
      {
        kind: 'rotation_chain',
        steps: ['Ellen', 'Lycaon', 'Rina'],
      },
    ])
  })

  it('does not classify lines with lone arrow as rotation chain', () => {
    const text = 'Lone arrow ->'
    expect(parseNoteBlocks(text)).toEqual([
      { kind: 'paragraph', text: 'Lone arrow ->' },
    ])
  })

  it('parses advisory tags with Latin and Cyrillic contents', () => {
    const text = '[BURST] Save ultimate for stun window\n[ОГЛУШЕНИЕ] Держать стаки'
    expect(parseNoteBlocks(text)).toEqual([
      {
        kind: 'advisory',
        tag: 'BURST',
        text: 'Save ultimate for stun window',
      },
      {
        kind: 'advisory',
        tag: 'ОГЛУШЕНИЕ',
        text: 'Держать стаки',
      },
    ])
  })

  it('does not classify tags without body as advisory', () => {
    expect(parseNoteBlocks('[TAG]')).toEqual([{ kind: 'paragraph', text: '[TAG]' }])
    expect(parseNoteBlocks('[TAG]   ')).toEqual([{ kind: 'paragraph', text: '[TAG]' }])
  })

  it('groups consecutive ordered list items', () => {
    const text = '1. First opener\n2) Second stun\n3. Third finisher'
    expect(parseNoteBlocks(text)).toEqual([
      {
        kind: 'ordered_list',
        items: ['First opener', 'Second stun', 'Third finisher'],
      },
    ])
  })

  it('groups consecutive bullet list items with dashes, asterisks, and bullets', () => {
    const text = '- First tip\n* Second tip\n• Third tip'
    expect(parseNoteBlocks(text)).toEqual([
      {
        kind: 'bullet_list',
        items: ['First tip', 'Second tip', 'Third tip'],
      },
    ])
  })

  it('preserves single newlines inside paragraphs and splits across blank lines', () => {
    const text = 'Paragraph one line one\nParagraph one line two\n\nParagraph two single line'
    expect(parseNoteBlocks(text)).toEqual([
      {
        kind: 'paragraph',
        text: 'Paragraph one line one\nParagraph one line two',
      },
      {
        kind: 'paragraph',
        text: 'Paragraph two single line',
      },
    ])
  })

  it('parses rich mixed notes in correct sequential order', () => {
    const note = `[BURST] Wait for stun phase

Opener rotation:
Miyabi -> Soukaku -> Nicole

Key mechanics:
- Build ice anomaly
- Swap on EX special

1. Charge attack
2) Support assist`

    const parsed = parseNoteBlocks(note)
    expect(parsed).toEqual([
      {
        kind: 'advisory',
        tag: 'BURST',
        text: 'Wait for stun phase',
      },
      {
        kind: 'paragraph',
        text: 'Opener rotation:',
      },
      {
        kind: 'rotation_chain',
        steps: ['Miyabi', 'Soukaku', 'Nicole'],
      },
      {
        kind: 'paragraph',
        text: 'Key mechanics:',
      },
      {
        kind: 'bullet_list',
        items: ['Build ice anomaly', 'Swap on EX special'],
      },
      {
        kind: 'ordered_list',
        items: ['Charge attack', 'Support assist'],
      },
    ])
  })
})

describe('noteModalReducer', () => {
  const initialClosed: NoteModalState = { kind: 'closed' }

  it('opens view and edit modes', () => {
    const viewing = noteModalReducer(initialClosed, { type: 'open_view' })
    expect(viewing).toEqual({ kind: 'viewing' })

    const editing = noteModalReducer(initialClosed, {
      type: 'open_edit',
      baselineNote: 'Initial note',
      baselineIsPublic: true,
    })
    expect(editing).toEqual({
      kind: 'editing',
      draft: 'Initial note',
      draftIsPublic: true,
      savePhase: 'idle',
      saveFailed: false,
    })
  })

  it('updates draft and visibility in edit mode', () => {
    let state = noteModalReducer(initialClosed, {
      type: 'open_edit',
      baselineNote: 'Baseline',
      baselineIsPublic: false,
    })

    state = noteModalReducer(state, { type: 'set_draft', draft: 'Draft 1' })
    expect(state).toMatchObject({ kind: 'editing', draft: 'Draft 1' })

    state = noteModalReducer(state, { type: 'set_visibility', isPublic: true })
    expect(state).toMatchObject({ kind: 'editing', draftIsPublic: true })
  })

  it('handles clean close vs dirty confirmation flow', () => {
    let state = noteModalReducer(initialClosed, {
      type: 'open_edit',
      baselineNote: 'Clean note',
      baselineIsPublic: false,
    })

    const closed = noteModalReducer(state, { type: 'request_close', dirty: false })
    expect(closed).toEqual({ kind: 'closed' })

    state = noteModalReducer(state, { type: 'request_close', dirty: true })
    expect(state).toMatchObject({ kind: 'editing', savePhase: 'confirm_discard' })

    state = noteModalReducer(state, { type: 'cancel_discard' })
    expect(state).toMatchObject({ kind: 'editing', savePhase: 'idle' })

    state = noteModalReducer(state, { type: 'confirm_discard' })
    expect(state).toEqual({ kind: 'closed' })
  })

  it('handles submission lifecycle states', () => {
    let state = noteModalReducer(initialClosed, {
      type: 'open_edit',
      baselineNote: '',
      baselineIsPublic: false,
    })

    state = noteModalReducer(state, { type: 'submit_start' })
    expect(state).toMatchObject({ kind: 'editing', savePhase: 'saving', saveFailed: false })

    state = noteModalReducer(state, { type: 'submit_failed' })
    expect(state).toMatchObject({
      kind: 'editing',
      savePhase: 'idle',
      saveFailed: true,
    })

    state = noteModalReducer(state, { type: 'submit_start' })
    state = noteModalReducer(state, { type: 'submit_succeeded' })
    expect(state).toEqual({ kind: 'closed' })
  })

  it('resets an open editor to closed', () => {
    const state = noteModalReducer(initialClosed, {
      type: 'open_edit',
      baselineNote: 'Existing',
      baselineIsPublic: false,
    })

    expect(noteModalReducer(state, { type: 'reset_closed' })).toEqual({ kind: 'closed' })
  })

  it('ignores request_close while save is in flight', () => {
    let state = noteModalReducer(initialClosed, {
      type: 'open_edit',
      baselineNote: 'Draft',
      baselineIsPublic: false,
    })
    state = noteModalReducer(state, { type: 'submit_start' })
    expect(state).toMatchObject({ kind: 'editing', savePhase: 'saving' })

    const unchanged = noteModalReducer(state, { type: 'request_close', dirty: true })
    expect(unchanged).toEqual(state)
  })

  it('resets confirm_discard back to idle on resumed typing or editing', () => {
    let state = noteModalReducer(initialClosed, {
      type: 'open_edit',
      baselineNote: 'Initial',
      baselineIsPublic: false,
    })
    state = noteModalReducer(state, { type: 'request_close', dirty: true })
    expect(state).toMatchObject({ kind: 'editing', savePhase: 'confirm_discard' })

    state = noteModalReducer(state, { type: 'set_draft', draft: 'Initial edited' })
    expect(state).toMatchObject({ kind: 'editing', savePhase: 'idle' })

    state = noteModalReducer(state, { type: 'request_close', dirty: true })
    expect(state).toMatchObject({ kind: 'editing', savePhase: 'confirm_discard' })

    state = noteModalReducer(state, { type: 'set_visibility', isPublic: true })
    expect(state).toMatchObject({ kind: 'editing', savePhase: 'idle' })
  })

  it('clears a save error when the draft changes', () => {
    let state = noteModalReducer(initialClosed, {
      type: 'open_edit',
      baselineNote: '',
      baselineIsPublic: false,
    })
    state = noteModalReducer(state, { type: 'submit_failed' })
    expect(state).toMatchObject({ saveFailed: true })

    state = noteModalReducer(state, { type: 'set_draft', draft: 'Recovered' })
    expect(state).toMatchObject({ saveFailed: false })
  })
})
