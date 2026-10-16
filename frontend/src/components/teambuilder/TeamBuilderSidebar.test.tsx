import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { TeamBuilderSidebar } from './TeamBuilderSidebar'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'teamBuilder.teamNameLabel': 'Название отряда',
        'teamBuilder.teamNamePlaceholder': 'Моно Айс',
        'teamBuilder.nameAutoHint': 'Оставьте пустым — название соберётся по именам агентов',
        'teamBuilder.teamDescLabel': 'Заметки',
        'teamBuilder.saveTeam': 'Сохранить отряд',
        'teamBuilder.saveChanges': 'Сохранить изменения',
        'teamBuilder.clearDraft': 'Очистить черновик',
      }
      return dict[key] ?? key
    },
  }),
}))

const baseProps = {
  isEditing: false,
  name: '',
  defaultName: '',
  description: '',
  selectedBuilds: [null, null, null] as const,
  isSaving: false,
  canSave: false,
  saveHint: null,
  onSetName: vi.fn(),
  onSetDescription: vi.fn(),
  onSave: vi.fn(),
  onReset: vi.fn(),
}

describe('TeamBuilderSidebar', () => {
  it('renders default placeholder when name and defaultName are empty', () => {
    const html = renderToString(<TeamBuilderSidebar {...baseProps} />)
    expect(html).toContain('placeholder="Моно Айс"')
    expect(html).toContain('Оставьте пустым — название соберётся по именам агентов')
  })

  it('renders generated team name in placeholder when defaultName is provided and name is empty', () => {
    const html = renderToString(
      <TeamBuilderSidebar
        {...baseProps}
        defaultName="Ария/Наньгун Юй/Санна"
      />,
    )
    expect(html).toContain('placeholder="Ария/Наньгун Юй/Санна"')
  })

  it('renders custom name when explicitly typed', () => {
    const html = renderToString(
      <TeamBuilderSidebar
        {...baseProps}
        name="Мой крутой отряд"
        defaultName="Ария/Наньгун Юй/Санна"
      />,
    )
    expect(html).toContain('value="Мой крутой отряд"')
  })

  it('enables save button when canSave is true', () => {
    const html = renderToString(
      <TeamBuilderSidebar
        {...baseProps}
        canSave={true}
        defaultName="Ария"
      />,
    )
    expect(html).not.toContain('disabled=""')
  })
})
