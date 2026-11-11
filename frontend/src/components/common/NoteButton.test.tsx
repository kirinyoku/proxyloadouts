import type React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { NoteButton } from './NoteButton'

let mockOpen = false
const mockSetOpen = vi.fn((v: any) => {
  mockOpen = typeof v === 'function' ? v(mockOpen) : v
})
let mockDraft = ''
const mockSetDraft = vi.fn((v: any) => {
  mockDraft = typeof v === 'function' ? v(mockDraft) : v
})
let useStateCallCount = 0

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useState: <T,>(_initial: T): [T, (v: any) => void] => {
      useStateCallCount++
      if (useStateCallCount % 2 === 1) {
        return [mockOpen as unknown as T, mockSetOpen]
      }
      return [mockDraft as unknown as T, mockSetDraft]
    },
  }
})

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => (
    <div data-slot="dialog" data-open={String(open)}>
      {children}
    </div>
  ),
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-slot="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

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

function getElements(tree: any) {
  const trigger = tree.props.children[0].props.children
  const dialogContent = tree.props.children[1]
  const contentChildren = dialogContent.props.children
  const header = contentChildren[0]
  const body = contentChildren[1]
  return { trigger, header, body }
}

describe('NoteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useStateCallCount = 0
    mockOpen = false
    mockDraft = ''
  })

  it('dot shown only when note exists', () => {
    mockOpen = false
    mockDraft = 'Tactics'
    const withNoteHtml = renderToString(
      <NoteButton
        note="Tactics"
        title="Заметка к сборке"
        readOnly
      />,
    )
    expect(withNoteHtml).toContain('rounded-full bg-primary')
    expect(withNoteHtml).toContain('title="Tactics"')

    mockOpen = false
    mockDraft = ''
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

    mockOpen = false
    mockDraft = ''
    const nullNoteHtml = renderToString(
      <NoteButton
        note={null}
        title="Заметка к сборке"
        onSave={vi.fn()}
        isSaving={false}
      />,
    )
    expect(nullNoteHtml).not.toContain('rounded-full bg-primary')
  })

  it('read-only empty renders nothing', () => {
    const nullNoteHtml = renderToString(
      <NoteButton
        note={null}
        title="Заметка к сборке"
        readOnly
      />,
    )
    expect(nullNoteHtml).toBe('')

    const emptyNoteHtml = renderToString(
      <NoteButton
        note="   "
        title="Заметка к сборке"
        readOnly
      />,
    )
    expect(emptyNoteHtml).toBe('')
  })

  it('read-only shows text and no textarea', () => {
    mockOpen = true
    mockDraft = 'Read only note text'
    const html = renderToString(
      <NoteButton
        note="Read only note text"
        title="Заметка к сборке"
        subtitle="Build #1"
        readOnly
      />,
    )

    expect(html).toContain('Read only note text')
    expect(html).toContain('border-primary/60')
    expect(html).toContain('Build #1')
    expect(html).not.toContain('<textarea')
    expect(html).not.toContain('Сохранить')
  })

  it('click opens dialog showing textarea with current note', () => {
    mockOpen = false
    mockDraft = 'Initial note'
    useStateCallCount = 0
    const tree = NoteButton({
      note: 'Initial note',
      title: 'Заметка к сборке',
      onSave: vi.fn(),
      isSaving: false,
    })

    const { trigger } = getElements(tree)
    trigger.props.onClick()

    expect(mockSetOpen).toHaveBeenCalledWith(true)
    expect(mockSetDraft).toHaveBeenCalledWith('Initial note')
  })

  it('editing + Save calls onSave with trimmed text', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    mockOpen = true
    mockDraft = '   Updated note with whitespace   '
    useStateCallCount = 0
    const tree = NoteButton({
      note: 'Old note',
      title: 'Заметка к сборке',
      onSave,
      isSaving: false,
    })

    const { body } = getElements(tree)
    const saveButton = body.props.children[1].props.children[1]

    await saveButton.props.onClick()

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('Updated note with whitespace')
    expect(mockSetOpen).toHaveBeenCalledWith(false)
  })

  it('clearing calls onSave(null)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    mockOpen = true
    mockDraft = '   '
    useStateCallCount = 0
    const tree = NoteButton({
      note: 'Old note',
      title: 'Заметка к сборке',
      onSave,
      isSaving: false,
    })

    const { body } = getElements(tree)
    const saveButton = body.props.children[1].props.children[1]

    await saveButton.props.onClick()

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith(null)
    expect(mockSetOpen).toHaveBeenCalledWith(false)
  })

  it('unchanged draft does not call onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    mockOpen = true
    mockDraft = 'Old note'
    useStateCallCount = 0
    const tree = NoteButton({
      note: 'Old note',
      title: 'Заметка к сборке',
      onSave,
      isSaving: false,
    })

    const { body } = getElements(tree)
    const saveButton = body.props.children[1].props.children[1]

    await saveButton.props.onClick()

    expect(onSave).not.toHaveBeenCalled()
    expect(mockSetOpen).toHaveBeenCalledWith(false)
  })

  it('Ctrl+Enter saves', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    mockOpen = true
    mockDraft = 'Saved with shortcut'
    useStateCallCount = 0
    const tree = NoteButton({
      note: 'Old note',
      title: 'Заметка к сборке',
      onSave,
      isSaving: false,
    })

    const { body } = getElements(tree)
    const textarea = body.props.children[0]
    const preventDefault = vi.fn()

    await textarea.props.onKeyDown({
      ctrlKey: true,
      key: 'Enter',
      preventDefault,
    })

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('Saved with shortcut')
    expect(mockSetOpen).toHaveBeenCalledWith(false)
  })

  it('Cmd+Enter (metaKey) saves', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    mockOpen = true
    mockDraft = 'Saved with mac shortcut'
    useStateCallCount = 0
    const tree = NoteButton({
      note: 'Old note',
      title: 'Заметка к сборке',
      onSave,
      isSaving: false,
    })

    const { body } = getElements(tree)
    const textarea = body.props.children[0]
    const preventDefault = vi.fn()

    await textarea.props.onKeyDown({
      metaKey: true,
      key: 'Enter',
      preventDefault,
    })

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('Saved with mac shortcut')
    expect(mockSetOpen).toHaveBeenCalledWith(false)
  })

  it('keeps dialog open on save rejection', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Network error'))
    mockOpen = true
    mockDraft = 'Will fail'
    useStateCallCount = 0
    const tree = NoteButton({
      note: 'Old note',
      title: 'Заметка к сборке',
      onSave,
      isSaving: false,
    })

    const { body } = getElements(tree)
    const saveButton = body.props.children[1].props.children[1]

    await saveButton.props.onClick()

    expect(onSave).toHaveBeenCalledWith('Will fail')
    expect(mockSetOpen).not.toHaveBeenCalledWith(false)
  })
})
