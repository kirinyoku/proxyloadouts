import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { NoteButton } from './NoteButton'
import type { NoteSubject } from './note-model'

const mockSubject: NoteSubject = {
  kind: 'build',
  name: 'Ellen Build',
  agentId: 1011,
  agentName: 'Ellen Joe',
  avatarUrl: '',
}

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
        }
        return translations[key] ?? key
      },
    }),
  }
})

describe('NoteButton renderToString static checks', () => {
  it('renders trigger with aria-label and title', () => {
    const html = renderToString(
      <NoteButton
        subject={mockSubject}
        note="Tactical note"
        isNotePublic={false}
        onSave={vi.fn()}
        isSaving={false}
      />,
    )

    expect(html).toContain('aria-label="Заметка"')
    expect(html).toContain('title="Tactical note"')
    expect(html).toContain('aria-haspopup="dialog"')
  })

  it('passes custom className to trigger button', () => {
    const html = renderToString(
      <NoteButton
        subject={mockSubject}
        note="Tactical note"
        isNotePublic={false}
        onSave={vi.fn()}
        className="custom-trigger-class"
      />,
    )

    expect(html).toContain('custom-trigger-class')
  })

  it('shows the notebook icon and adds a status dot only when there is note text', () => {
    const withNoteHtml = renderToString(
      <NoteButton
        subject={mockSubject}
        note="Non-empty note"
        isNotePublic={false}
        onSave={vi.fn()}
        isSaving={false}
      />,
    )
    expect(withNoteHtml).toContain('lucide-notebook-text')
    expect(withNoteHtml).toContain('data-slot="status-indicator"')
    expect(withNoteHtml).not.toContain('>Заметка</span>')
    expect(withNoteHtml).toContain('title="Non-empty note"')

    const emptyNoteHtml = renderToString(
      <NoteButton
        subject={mockSubject}
        note=""
        isNotePublic={false}
        onSave={vi.fn()}
        isSaving={false}
      />,
    )
    expect(emptyNoteHtml).toContain('lucide-notebook-text')
    expect(emptyNoteHtml).not.toContain('data-slot="status-indicator"')
    expect(emptyNoteHtml).toContain('title="Добавить заметку"')

    const whitespaceNoteHtml = renderToString(
      <NoteButton
        subject={mockSubject}
        note="    "
        isNotePublic={false}
        onSave={vi.fn()}
        isSaving={false}
      />,
    )
    expect(whitespaceNoteHtml).not.toContain('data-slot="status-indicator"')
    expect(whitespaceNoteHtml).toContain('title="Добавить заметку"')

    const nullNoteHtml = renderToString(
      <NoteButton
        subject={mockSubject}
        note={null}
        isNotePublic={false}
        onSave={vi.fn()}
        isSaving={false}
      />,
    )
    expect(nullNoteHtml).not.toContain('data-slot="status-indicator"')
    expect(nullNoteHtml).toContain('title="Добавить заметку"')
  })

  it('renders empty string in read-only mode when note is blank', () => {
    expect(renderToString(<NoteButton subject={mockSubject} note="" readOnly />)).toBe('')
    expect(renderToString(<NoteButton subject={mockSubject} note="   " readOnly />)).toBe('')
    expect(renderToString(<NoteButton subject={mockSubject} note={null} readOnly />)).toBe('')
    expect(renderToString(<NoteButton subject={mockSubject} note={undefined} readOnly />)).toBe('')
  })

  it('renders trigger in read-only mode when note is present', () => {
    const html = renderToString(
      <NoteButton
        subject={mockSubject}
        note="Read-only tactical tip"
        readOnly
      />,
    )

    expect(html).toContain('aria-label="Заметка"')
    expect(html).toContain('title="Read-only tactical tip"')
    expect(html).toContain('data-slot="status-indicator"')
  })
})
