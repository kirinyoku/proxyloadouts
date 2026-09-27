import type { HTMLAttributes } from 'react'
import {
  Gamepad2,
  Layers,
  ScanLine,
  UsersRound,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DiscordIcon } from '@/components/common/DiscordIcon'
import { cn } from '@/lib/utils'

export interface HowItWorksProps extends HTMLAttributes<HTMLElement> {}

/**
 * 5-step "How It Works" walkthrough in a horizontal connected pipeline.
 *
 * Single accessible DOM tree (<ol> and <li>) across all breakpoints.
 * Connected layout: large prominent icons connected by a continuous horizontal bar,
 * with step titles and descriptions aligned cleanly underneath each icon node.
 */
export function HowItWorks({ className, ...props }: HowItWorksProps) {
  const { t } = useTranslation()

  const steps = [
    {
      number: '01',
      icon: <Gamepad2 className="size-6 sm:size-7 md:size-8 stroke-[1.8]" />,
      title: t('home.step1Title'),
      description: t('home.step1DescShort'),
    },
    {
      number: '02',
      icon: <ScanLine className="size-6 sm:size-7 md:size-8 stroke-[1.8]" />,
      title: t('home.step2Title'),
      description: t('home.step2DescShort'),
    },
    {
      number: '03',
      icon: <DiscordIcon className="size-6 sm:size-7 md:size-8" />,
      title: t('home.step3Title'),
      description: t('home.step3DescShort'),
    },
    {
      number: '04',
      icon: <Layers className="size-6 sm:size-7 md:size-8 stroke-[1.8]" />,
      title: t('home.step4Title'),
      description: t('home.step4DescShort'),
    },
    {
      number: '05',
      icon: <UsersRound className="size-6 sm:size-7 md:size-8 stroke-[1.8]" />,
      title: t('home.step5Title'),
      description: t('home.step5DescShort'),
    },
  ]

  return (
    <section
      aria-labelledby="home-steps-title"
      className={cn('space-y-6 pt-2 sm:pt-6', className)}
      {...props}
    >
      {/* Clean Section Header (without confusing 01 / 05 counter) */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3 sm:pb-4">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="size-2 rounded-xs bg-primary rotate-45 shrink-0"
          />
          <h2
            id="home-steps-title"
            className="font-heading text-xs font-bold uppercase tracking-wider text-foreground sm:text-sm"
          >
            {t('home.stepsAria')}
          </h2>
        </div>
      </div>

      {/* 5-Step Pipeline: Vertical timeline on mobile, Horizontal connected track on desktop */}
      <ol className="flex flex-col sm:grid sm:grid-cols-5 gap-y-1 sm:gap-y-0 sm:gap-x-0 pt-4 sm:pt-5">
        {steps.map((step, idx) => {
          const isFirst = idx === 0
          const isLast = idx === steps.length - 1

          return (
            <li
              key={step.number}
              tabIndex={0}
              className={cn(
                'relative flex flex-row items-start gap-4 sm:flex-col sm:items-center sm:gap-0',
                'rounded-xl px-2 py-1.5 sm:px-3 sm:py-0 text-left sm:text-center',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80',
              )}
            >
              {/* Node Column / Header: Icon + Connecting Lines */}
              <div className="relative flex flex-col items-center shrink-0 self-stretch sm:self-auto sm:w-full">
                {/* Desktop: Horizontal Connecting Row */}
                <div className="relative flex w-full items-center justify-center">
                  {/* Left horizontal line segment (desktop only) */}
                  <div
                    aria-hidden="true"
                    className={cn(
                      'hidden sm:block h-[2px] flex-1 bg-white/[0.14]',
                      isFirst ? 'invisible' : 'visible',
                    )}
                  />

                  {/* Large Icon Node */}
                  <div className="relative z-10 shrink-0">
                    <div
                      aria-hidden="true"
                      className="flex size-12 sm:size-16 items-center justify-center rounded-xl sm:rounded-2xl border-2 border-border/80 bg-surface-elevated/90 text-foreground/90 shadow-md shadow-black/30 backdrop-blur-xs"
                    >
                      {step.icon}
                    </div>

                    {/* Step Number Badge (headroom guaranteed by container pt-4) */}
                    <span
                      aria-hidden="true"
                      className="absolute -top-1.5 -right-1.5 flex size-5 sm:size-5.5 items-center justify-center rounded-full border border-primary/50 bg-[#0c0f13] font-mono text-[10px] font-bold text-primary shadow-xs"
                    >
                      {step.number}
                    </span>
                  </div>

                  {/* Right horizontal line segment (desktop only) */}
                  <div
                    aria-hidden="true"
                    className={cn(
                      'hidden sm:block h-[2px] flex-1 bg-white/[0.14]',
                      isLast ? 'invisible' : 'visible',
                    )}
                  />
                </div>

                {/* Mobile: Vertical Connecting Line to the next step */}
                {!isLast && (
                  <div
                    aria-hidden="true"
                    className="w-[2px] flex-1 min-h-[32px] my-2 bg-white/[0.14] sm:hidden"
                  />
                )}
              </div>

              {/* Step Content: Title & Description */}
              <div className="flex flex-1 flex-col pt-0.5 sm:mt-4 sm:pt-0 sm:items-center sm:text-center">
                <h3 className="font-heading text-xs sm:text-[12px] lg:text-[13px] font-bold uppercase leading-tight tracking-wide text-foreground sm:flex sm:min-h-[1.75rem] sm:items-center sm:justify-center">
                  {step.title}
                </h3>
                <p className="mt-1 sm:mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-[12px] sm:max-w-[200px]">
                  {step.description}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
