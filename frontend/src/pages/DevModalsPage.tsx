import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Layers,
  Save,
  Search,
  Eye,
  Trash2,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Sparkles,
} from 'lucide-react'
import { toast } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SaveBuildDialog } from '@/components/showcase/SaveBuildDialog'
import { BuildPickerDialog } from '@/components/teambuilder/BuildPickerDialog'
import { BuildInspectorDialog } from '@/components/roster/BuildInspectorDialog'
import {
  mockGameAccount,
  mockEllenAgent,
  mockJaneAgent,
  mockEllenBuild,
  mockJaneBuild,
  mockCorinBuild,
  mockMiyabiBuild,
  mockAllBuilds,
} from './dev-mock-data'

export function DevModalsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeModal = searchParams.get('modal')

  // SaveBuildDialog state
  const [saveQuotaLimit, setSaveQuotaLimit] = useState(false)
  const [saveAgentId, setSaveAgentId] = useState<'ellen' | 'jane'>('ellen')

  // BuildPickerDialog state
  const [simulateConflicts, setSimulateConflicts] = useState(true)

  // BuildInspectorDialog state
  const [inspectorWithTeam, setInspectorWithTeam] = useState(true)
  const [inspectorBuildId, setInspectorBuildId] = useState<'ellen' | 'jane' | 'corin' | 'miyabi'>('ellen')

  function openModal(modalId: string) {
    const next = new URLSearchParams(searchParams)
    next.set('modal', modalId)
    setSearchParams(next)
  }

  function closeModal() {
    const next = new URLSearchParams(searchParams)
    next.delete('modal')
    setSearchParams(next)
  }

  const selectedInspectorBuild =
    inspectorBuildId === 'ellen'
      ? mockEllenBuild
      : inspectorBuildId === 'jane'
        ? mockJaneBuild
        : inspectorBuildId === 'corin'
          ? mockCorinBuild
          : mockMiyabiBuild

  const selectedSaveAgent = saveAgentId === 'ellen' ? mockEllenAgent : mockJaneAgent

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-20 pt-4">
      {/* Dev Header */}
      <div className="flex flex-col gap-3 rounded-2xl border-2 border-black bg-card/90 p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-black bg-primary text-black font-bold shadow-md">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-xl tracking-wide uppercase text-foreground">
                  Песочница всплывающих окон
                </h1>
                <Badge variant="outline" className="border-primary/50 text-primary font-mono text-[10px]">
                  DEV ONLY
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Изолированная витрина диалогов и модалок для настройки визуала, отступов, скролла и анимаций.
              </p>
            </div>
          </div>

          {activeModal ? (
            <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs">
              <span className="font-mono text-primary font-semibold">
                Активно: <span className="underline">{activeModal}</span>
              </span>
              <Button size="xs" variant="secondary" onClick={closeModal} className="h-6 px-2 text-[11px]">
                Закрыть
              </Button>
            </div>
          ) : (
            <span className="text-xs font-mono text-muted-foreground">
              Все окна закрыты
            </span>
          )}
        </div>

        {/* Tip banner */}
        <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs leading-relaxed text-muted-foreground">
          <span className="font-bold text-foreground">💡 Синхронизация с URL:</span> Состояние модалки фиксируется в параметре{' '}
          <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-primary">?modal=...</code>. При правках стилей и перезагрузке (F5 / HMR) окно не закрывается, позволяя мгновенно оценивать изменения в CSS.
        </div>
      </div>

      {/* Grid of Modals */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Card 1: SaveBuildDialog */}
        <div className="flex flex-col justify-between rounded-2xl border-2 border-black bg-card/75 p-5 shadow-lg backdrop-blur-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Save className="h-4 w-4" />
                <span>SaveBuildDialog</span>
              </div>
              <Badge variant="secondary" className="text-[10px]">Showcase</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Окно сохранения текущей сборки агента в ростер (ввод названия, описания, отображение квоты 5/5 и аккаунта).
            </p>

            {/* Config toggles */}
            <div className="rounded-xl border border-border/60 bg-subtle/50 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Квота сборок:</span>
                <Button
                  size="xs"
                  variant={saveQuotaLimit ? 'destructive' : 'outline'}
                  onClick={() => setSaveQuotaLimit((prev) => !prev)}
                >
                  {saveQuotaLimit ? 'Исчерпана (5/5)' : 'Есть место (2/5)'}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Тестовый агент:</span>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setSaveAgentId((prev) => (prev === 'ellen' ? 'jane' : 'ellen'))}
                >
                  {saveAgentId === 'ellen' ? 'Эллен (Ice Attack)' : 'Джейн Доу (Phys Anomaly)'}
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/50 flex gap-2">
            <Button
              className="w-full"
              variant={activeModal === 'save-build' ? 'default' : 'secondary'}
              onClick={() => openModal('save-build')}
            >
              Открыть SaveBuildDialog
            </Button>
          </div>
        </div>

        {/* Card 2: BuildPickerDialog */}
        <div className="flex flex-col justify-between rounded-2xl border-2 border-black bg-card/75 p-5 shadow-lg backdrop-blur-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Search className="h-4 w-4" />
                <span>BuildPickerDialog</span>
              </div>
              <Badge variant="secondary" className="text-[10px]">TeamBuilder</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Полноэкранный выбор билда агента в слот отряда с поиском, фильтрами атрибутов/специальностей и детекцией коллизий.
            </p>

            {/* Config toggles */}
            <div className="rounded-xl border border-border/60 bg-subtle/50 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Симуляция конфликтов:</span>
                <Button
                  size="xs"
                  variant={simulateConflicts ? 'default' : 'outline'}
                  onClick={() => setSimulateConflicts((prev) => !prev)}
                >
                  {simulateConflicts ? 'Включены (Оружие / Диск)' : 'Без конфликтов'}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground/80">
                {simulateConflicts
                  ? 'Эллен в слоте 1. У Корин возникнет конфликт оружия и диска 1.'
                  : 'Все слоты свободны, конфликты скрыты.'}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/50 flex gap-2">
            <Button
              className="w-full"
              variant={activeModal === 'build-picker' ? 'default' : 'secondary'}
              onClick={() => openModal('build-picker')}
            >
              Открыть BuildPickerDialog
            </Button>
          </div>
        </div>

        {/* Card 3: BuildInspectorDialog */}
        <div className="flex flex-col justify-between rounded-2xl border-2 border-black bg-card/75 p-5 shadow-lg backdrop-blur-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Eye className="h-4 w-4" />
                <span>BuildInspectorDialog</span>
              </div>
              <Badge variant="secondary" className="text-[10px]">Roster & Teams</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Детальный инспектор билда с полными характеристиками, W-Engine, всеми 6 дисками, бонусами сетов и адаптивными табами.
            </p>

            {/* Config toggles */}
            <div className="rounded-xl border border-border/60 bg-subtle/50 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Агент для инспекции:</span>
                <div className="flex gap-1">
                  {(['ellen', 'jane', 'corin', 'miyabi'] as const).map((agentKey) => (
                    <Button
                      key={agentKey}
                      size="xs"
                      variant={inspectorBuildId === agentKey ? 'default' : 'ghost'}
                      onClick={() => setInspectorBuildId(agentKey)}
                      className="px-2 capitalize"
                    >
                      {agentKey}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Бейдж команды:</span>
                <Button
                  size="xs"
                  variant={inspectorWithTeam ? 'outline' : 'ghost'}
                  onClick={() => setInspectorWithTeam((prev) => !prev)}
                >
                  {inspectorWithTeam ? 'Frostbite Shock Squad' : 'Без команды'}
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/50 flex gap-2">
            <Button
              className="w-full"
              variant={activeModal === 'build-inspector' ? 'default' : 'secondary'}
              onClick={() => openModal('build-inspector')}
            >
              Открыть BuildInspectorDialog
            </Button>
          </div>
        </div>

        {/* Card 4: AlertDialog (Confirmations) */}
        <div className="flex flex-col justify-between rounded-2xl border-2 border-black bg-card/75 p-5 shadow-lg backdrop-blur-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                <Trash2 className="h-4 w-4" />
                <span>AlertDialog (Опасные действия)</span>
              </div>
              <Badge variant="secondary" className="text-[10px]">Common UI</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Всплывающие диалоги подтверждения деструктивных действий (удаление команды, отвязка аккаунта Прокси).
            </p>

            <div className="rounded-xl border border-border/60 bg-subtle/50 p-3 space-y-2 text-xs">
              <p className="text-muted-foreground">
                Проверка пропорций кнопок «Отмена» и «Удалить», асимметричных углов <code className="text-foreground font-mono">rounded-[22px_22px_0_22px]</code> и адаптивной верстки на мобильных.
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/50 flex gap-2">
            <Button
              variant={activeModal === 'alert-team' ? 'destructive' : 'secondary'}
              className="flex-1"
              onClick={() => openModal('alert-team')}
            >
              Удаление команды
            </Button>
            <Button
              variant={activeModal === 'alert-account' ? 'destructive' : 'secondary'}
              className="flex-1"
              onClick={() => openModal('alert-account')}
            >
              Удаление аккаунта
            </Button>
          </div>
        </div>

        {/* Card 5: Standard Base Dialog Playground */}
        <div className="flex flex-col justify-between rounded-2xl border-2 border-black bg-card/75 p-5 shadow-lg backdrop-blur-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Layers className="h-4 w-4" />
                <span>Base Dialog Playground</span>
              </div>
              <Badge variant="secondary" className="text-[10px]">Primitive</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Тестирование базового компонента Dialog (скролл длинного контента, заголовок, футер, позиция кнопки закрытия X).
            </p>
            <div className="rounded-xl border border-border/60 bg-subtle/50 p-3 text-xs text-muted-foreground">
              Позволяет быстро подбирать фоны, тени, бордеры и блюр для любых новых модалок.
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/50">
            <Button
              className="w-full"
              variant={activeModal === 'base-dialog' ? 'default' : 'secondary'}
              onClick={() => openModal('base-dialog')}
            >
              Открыть базовый Dialog
            </Button>
          </div>
        </div>

        {/* Card 6: Toasts / Notifications */}
        <div className="flex flex-col justify-between rounded-2xl border-2 border-black bg-card/75 p-5 shadow-lg backdrop-blur-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Sparkles className="h-4 w-4" />
                <span>Toasts & Notifications</span>
              </div>
              <Badge variant="secondary" className="text-[10px]">Sonner</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Проверка стилизации всплывающих уведомлений, координации очередей при коллизиях и защиты от спама.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Button
                size="sm"
                variant="outline"
                className="text-success border-success/30 hover:bg-success/10"
                onClick={() => toast.success('Сборка «Shark Frostbite» успешно сохранена!')}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Success Toast
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => toast.error('Превышен лимит сборок (максимум 5 на агента).')}
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Error Toast
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-warning border-warning/30 hover:bg-warning/10"
                onClick={() => toast.warning('Обнаружен конфликт: одинаковое оружие в слоте 2.')}
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                Warning Toast
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-info border-info/30 hover:bg-info/10"
                onClick={() => toast.info('Данные ростера синхронизированы с игрой.')}
              >
                <Info className="h-3.5 w-3.5 mr-1" />
                Info Toast
              </Button>
            </div>

            <div className="pt-2 border-t border-border/40 space-y-1.5">
              <div className="text-[11px] font-medium text-muted-foreground">Тестирование коллизий и очередей:</div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <Button
                  size="xs"
                  variant="secondary"
                  className="text-[11px]"
                  onClick={() => {
                    toast.info('Инфо: синхронизация ростера...')
                    toast.warning('Внимание: конфликт дисков в слоте 2!')
                  }}
                >
                  Коллизия (Warn + Info)
                </Button>
                <Button
                  size="xs"
                  variant="secondary"
                  className="text-[11px]"
                  onClick={() => {
                    for (let i = 0; i < 5; i++) {
                      toast.error('Превышен лимит сборок (максимум 5 на агента).')
                    }
                  }}
                >
                  Спам-клик x5 (Дедупликация)
                </Button>
                <Button
                  size="xs"
                  variant="secondary"
                  className="text-[11px]"
                  onClick={() => {
                    toast.info('Инфо: загрузка данных...')
                    toast.success('Успех: кэш обновлен!')
                    toast.warning('Предупреждение: диск не прокачан!')
                    toast.error('Ошибка: сервер временно недоступен!')
                  }}
                >
                  Бёрст 4 типов сразу
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => toast.dismiss()}
                >
                  Очистить все
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- MOUNTED DIALOGS --- */}

      {/* 1. SaveBuildDialog */}
      {activeModal === 'save-build' && (
        <SaveBuildDialog
          agent={selectedSaveAgent}
          targetAccount={mockGameAccount}
          existingBuildsCount={saveQuotaLimit ? 5 : 2}
          onSaved={(savedAgent) => {
            toast.success(`Билд для «${savedAgent.name}» сохранен в ростер!`)
            closeModal()
          }}
          onOpenChange={(open) => {
            if (!open) closeModal()
          }}
        />
      )}

      {/* 2. BuildPickerDialog */}
      <BuildPickerDialog
        open={activeModal === 'build-picker'}
        builds={mockAllBuilds}
        squadBuilds={simulateConflicts ? [mockEllenBuild] : []}
        onSelect={(buildId) => {
          const picked = mockAllBuilds.find((b) => b.id === buildId)
          toast.success(`Выбран билд: ${picked?.name ?? buildId}`)
          closeModal()
        }}
        onOpenChange={(open) => {
          if (!open) closeModal()
        }}
      />

      {/* 3. BuildInspectorDialog */}
      <BuildInspectorDialog
        open={activeModal === 'build-inspector'}
        build={selectedInspectorBuild}
        teamName={inspectorWithTeam ? 'Frostbite Shock Squad' : undefined}
        onOpenChange={(open) => {
          if (!open) closeModal()
        }}
      />

      {/* 4. AlertDialog: Delete Team */}
      <AlertDialog
        open={activeModal === 'alert-team'}
        onOpenChange={(open) => {
          if (!open) closeModal()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить команду «Ice Frostbite»?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие необратимо. Сохраненная конфигурация команды будет удалена, но сборки агентов останутся в вашем ростере.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeModal}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                toast.success('Команда удалена')
                closeModal()
              }}
            >
              Удалить команду
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 5. AlertDialog: Delete Account */}
      <AlertDialog
        open={activeModal === 'alert-account'}
        onOpenChange={(open) => {
          if (!open) closeModal()
        }}
      >
        <AlertDialogContent className="w-[calc(100vw-32px)] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить аккаунт Прокси 1500888999?</AlertDialogTitle>
            <AlertDialogDescription>
              Все сохраненные билды и команды, привязанные к данному UID в регионе Europe, будут безвозвратно стерты с серверов ProxyLoadouts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <AlertDialogCancel className="w-full sm:w-auto" onClick={closeModal}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
              onClick={() => {
                toast.success('Аккаунт удален')
                closeModal()
              }}
            >
              Да, удалить аккаунт
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 6. Standard Base Dialog Demo */}
      <Dialog
        open={activeModal === 'base-dialog'}
        onOpenChange={(open) => {
          if (!open) closeModal()
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Базовый шаблон Dialog</DialogTitle>
            <DialogDescription>
              Используется для проверки базовой стилизации: бордер, скругления ZZZ, тени, заголовок и крестик закрытия.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="sample-name">Название пресета</Label>
              <Input id="sample-name" defaultValue="Hypercarry Shiyu 17" placeholder="Введите название..." />
            </div>

            <div className="rounded-xl border border-white/10 bg-subtle p-3 space-y-1.5 text-xs">
              <span className="font-semibold text-foreground">Проверка длинного скролла:</span>
              <p className="text-muted-foreground leading-relaxed">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>
              Отмена
            </Button>
            <Button onClick={() => {
              toast.success('Сохранено в базовом диалоге!')
              closeModal()
            }}>
              Применить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
