import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { NoteButton, planNoteSave } from './NoteButton'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const translations: Record<string, string> = {
          'notes.open': 'Заметка',
          'notes.add': 'Добавить заметку',
          'notes.buildTitle': 'Заметка к сборке',
          'notes.teamTitle': 'Заметка к отряду',
          'notes.placeholder': 'Тактика, ротация, что угодно…',
          'notes.save': 'Сохранить',
          'notes.saveHint': 'Ctrl+Enter',
        }
        return translations[key] ?? key
      },
    }),
  }
})

describe('planNoteSave', () => {
  it('returns unchanged when draft matches note exactly', () => {
    expect(planNoteSave('Rotation tip', 'Rotation tip')).toEqual({ kind: 'unchanged' })
  })

  it('returns unchanged when difference is only surrounding whitespace', () => {
    expect(planNoteSave('   Rotation tip   ', 'Rotation tip')).toEqual({ kind: 'unchanged' })
    expect(planNoteSave('Rotation tip', '   Rotation tip   ')).toEqual({ kind: 'unchanged' })
  })

  it('returns unchanged when note is null or undefined and draft is empty or whitespace', () => {
    expect(planNoteSave('', null)).toEqual({ kind: 'unchanged' })
    expect(planNoteSave('   ', null)).toEqual({ kind: 'unchanged' })
    expect(planNoteSave('', undefined)).toEqual({ kind: 'unchanged' })
    expect(planNoteSave('   ', undefined)).toEqual({ kind: 'unchanged' })
  })

  it('returns trimmed value when edited to new text', () => {
    expect(planNoteSave('  Updated tactic  ', 'Old tactic')).toEqual({
      kind: 'save',
      value: 'Updated tactic',
    })
    expect(planNoteSave('New note', null)).toEqual({
      kind: 'save',
      value: 'New note',
    })
  })

  it('returns null when draft is cleared or only whitespace', () => {
    expect(planNoteSave('', 'Old tactic')).toEqual({
      kind: 'save',
      value: null,
    })
    expect(planNoteSave('     ', 'Old tactic')).toEqual({
      kind: 'save',
      value: null,
    })
  })
})

describe('NoteButton renderToString static checks', () => {
  it('renders trigger with aria-label and title', () => {
    const html = renderToString(
      <NoteButton
        note="Tactical note"
        title="Заметка к сборке"
        onSave={vi.fn()}
        isSaving={false}
      />,
    )

    expect(html).toContain('aria-label="Заметка"')
    expect(html).toContain('title="Tactical note"')
    expect(html).toContain('aria-haspopup="dialog"')
  })

  it('renders indicator dot iff note is non-blank', () => {
    const withNoteHtml = renderToString(
      <NoteButton
        note="Non-empty note"
        title="Заметка к сборке"
        onSave={vi.fn()}
        isSaving={false}
      />,
    )
    expect(withNoteHtml).toContain('rounded-full bg-primary')
    expect(withNoteHtml).toContain('title="Non-empty note"')

    const emptyNoteHtml = renderToString(
      <NoteButton
        note=""
        title="Заметка к сборке"
        onSave={vi.fn()}
        isSaving={false}
      />,
    )
    expect(emptyNoteHtml).not.toContain('rounded-full bg-primary')
    expect(emptyNoteHtml).toContain('title="Добавить заметку"')

    const whitespaceNoteHtml = renderToString(
      <NoteButton
        note="    "
        title="Заметка к сборке"
        onSave={vi.fn()}
        isSaving={false}
      />,
    )
    expect(whitespaceNoteHtml).not.toContain('rounded-full bg-primary')
    expect(whitespaceNoteHtml).toContain('title="Добавить заметку"')

    const nullNoteHtml = renderToString(
      <NoteButton
        note={null}
        title="Заметка к сборке"
        onSave={vi.fn()}
        isSaving={false}
      />,
    )
    expect(nullNoteHtml).not.toContain('rounded-full bg-primary')
    expect(nullNoteHtml).toContain('title="Добавить заметку"')
  })

  it('renders empty string in read-only mode when note is blank', () => {
    expect(renderToString(<NoteButton note="" title="Заметка к сборке" readOnly />)).toBe('')
    expect(renderToString(<NoteButton note="   " title="Заметка к сборке" readOnly />)).toBe('')
    expect(renderToString(<NoteButton note={null} title="Заметка к сборке" readOnly />)).toBe('')
    expect(renderToString(<NoteButton note={undefined} title="Заметка к сборке" readOnly />)).toBe('')
  })

  it('renders trigger in read-only mode when note is present', () => {
    const html = renderToString(
      <NoteButton
        note="Read-only tactical tip"
        title="Заметка к сборке"
        subtitle="Agent Build"
        readOnly
      />,
    )

    expect(html).toContain('aria-label="Заметка"')
    expect(html).toContain('title="Read-only tactical tip"')
    expect(html).toContain('rounded-full bg-primary')
  })
})
