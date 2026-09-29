import { Layers } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { agentRoleCircleUrl, agentRoleSelectUrl, agentRoleIconUrl } from '@/lib/agent-icons'
import { cn } from '@/lib/utils'
import { MindscapeBadge } from '@/components/ui/MindscapeBadge'
import type { Agent } from '@/types'

export interface AgentAvatarTabProps {
  /** Full Agent object (used in Showcase) */
  agent?: Agent
  /** Agent ID (used in Roster if full Agent object is not provided) */
  agentId?: number
  /** Agent name (used in Roster if full Agent object is not provided) */
  agentName?: string
  /** Primary Agent object for fallback splash art & icon resolution */
  primaryAgent?: Agent
  /** Total builds count for this agent (renders Layers badge when > 1) */
  buildsCount?: number
  /** Mindscape cinema level (fallback if agent.mindscape_cinema is not present) */
  mindscapeCinema?: number
  /** Agent level for tooltip */
  level?: number
  /** Whether the tab is currently selected */
  selected?: boolean
  /** Callback when tab is selected */
  onSelect: () => void
  /** Additional CSS class names */
  className?: string
  /** Optional custom tooltip title */
  title?: string
}

/**
 * Unified circular agent selector tab button for sidebar navigation across Showcase and Roster pages.
 * Supports active glow, hover animations, keyboard accessibility, mindscape rank badge, and build count badge.
 */
export function AgentAvatarTab({
  agent,
  agentId,
  agentName,
  primaryAgent,
  buildsCount,
  mindscapeCinema,
  level,
  selected = false,
  onSelect,
  className,
  title,
}: AgentAvatarTabProps) {
  const { t } = useTranslation()

  const resolvedId = agent?.id ?? agentId ?? 0
  const resolvedName = agent?.name ?? agentName ?? primaryAgent?.name ?? ''
  const resolvedLevel = level ?? agent?.level ?? primaryAgent?.level
  const resolvedMindscape = mindscapeCinema ?? agent?.mindscape_cinema ?? primaryAgent?.mindscape_cinema ?? 0

  const circleUrl = agentRoleCircleUrl(resolvedId)
  const selectUrl = agentRoleSelectUrl(resolvedId)
  const generalUrl = agentRoleIconUrl(resolvedId)
  const iconUrl = circleUrl ?? selectUrl ?? generalUrl ?? agent?.splash_art_url ?? primaryAgent?.splash_art_url

  const defaultTitle =
    buildsCount !== undefined && buildsCount > 0
      ? `${resolvedName} (${t('roster.buildsCount', { count: buildsCount })})`
      : resolvedLevel !== undefined
        ? `${resolvedName} (Lv.${resolvedLevel})`
        : resolvedName

  const tooltipTitle = title ?? defaultTitle

  // Both corner badges render visible text inside the button, so WCAG 2.5.3
  // (Label in Name) requires the accessible name to contain it. Deriving the
  // name from the same conditions that render the badges keeps the two in
  // sync, and it also stops `aria-label={resolvedName}` from hiding the build
  // count and Mindscape rank from screen readers.
  const showBuildsBadge = buildsCount !== undefined && buildsCount > 1
  const showMindscapeBadge =
    resolvedMindscape > 0 && (buildsCount === undefined || buildsCount <= 1)

  const ariaLabel = showBuildsBadge
    ? `${resolvedName} (${t('roster.buildsCount', { count: buildsCount })})`
    : showMindscapeBadge
      ? `${resolvedName} (M${resolvedMindscape})`
      : resolvedName

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-label={ariaLabel}
      title={tooltipTitle}
      onClick={onSelect}
      className={cn(
        'group relative size-12 shrink-0 cursor-pointer rounded-full border-2 transition-all duration-150 select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
        selected
          ? 'z-10 border-primary ring-2 ring-primary/70 shadow-[0_0_16px_rgba(201,242,75,0.55)] scale-105'
          : 'border-black/80 bg-subtle opacity-75 hover:opacity-100 hover:border-white/50 hover:scale-105 active:scale-95',
        className,
      )}
    >
      {/* Circle Image Wrapper */}
      <span className="relative block size-full overflow-hidden rounded-full bg-background">
        {iconUrl ? (
          <img
            src={iconUrl}
            alt={resolvedName}
            width={48}
            height={48}
            loading={selected ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={selected ? 'high' : 'auto'}
            draggable={false}
            className="crisp-img size-full object-cover select-none pointer-events-none transition-transform duration-150 group-hover:scale-105"
          />
        ) : (
          <span className="flex size-full items-center justify-center font-heading text-xs font-bold text-foreground">
            {resolvedName.slice(0, 2)}
          </span>
        )}
      </span>

      {/* Build count badge on top right (Roster mode) */}
      {showBuildsBadge && (
        <span
          data-testid="builds-count-badge"
          className={cn(
            'absolute -top-1 -right-1 z-20 flex h-5 min-w-5 items-center justify-center gap-1 rounded-full px-1.5 font-mono text-[11px] font-black leading-none shadow-md border transition-all duration-150',
            selected
              ? 'bg-primary text-black border-black shadow-[0_2px_8px_rgba(201,242,75,0.45)]'
              : 'bg-card text-foreground border-border/80 shadow-black/80 group-hover:border-primary/60 group-hover:text-primary',
          )}
        >
          <Layers className="size-3 shrink-0 stroke-[2.5]" />
          <span>{buildsCount}</span>
        </span>
      )}

      {/* Mindscape Cinema on bottom right (when single build or Showcase mode) */}
      {showMindscapeBadge && (
        <MindscapeBadge level={resolvedMindscape} size="md" />
      )}
    </button>
  )
}
