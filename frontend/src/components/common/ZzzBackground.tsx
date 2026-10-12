import React from 'react'
import { useBgAnimation } from '@/hooks/useBgAnimation'
import { useIsMobile } from '@/hooks/useIsMobile'

interface DiagonalRowProps {
  direction: 'left' | 'right'
  duration: number
  startWithStroke?: boolean
  tapeId: string
}

// 3 repetitions per segment ensures full coverage and smooth looping with 40% less memory
const REPEAT_COUNT = 3

function DiagonalMarqueeRow({ direction, duration, startWithStroke = false, tapeId }: DiagonalRowProps) {
  const trackClass = direction === 'left' ? 'zzz-marquee-track-left' : 'zzz-marquee-track-right'

  const renderSegment = (segmentKey: string) => (
    <div
      key={segmentKey}
      className="flex shrink-0 items-center gap-16 sm:gap-24 lg:gap-32 px-8"
      aria-hidden={segmentKey !== 'content-1'}
    >
      {Array.from({ length: REPEAT_COUNT }).map((_, idx) => {
        const isStroke = startWithStroke ? idx % 2 === 0 : idx % 2 === 1
        return (
          <div key={`${segmentKey}-${idx}`} className="flex flex-col gap-1.5 shrink-0">
            {/* Top Film Metadata & Sprocket Bar */}
            <div className="flex items-center justify-between gap-4 px-2 text-[10px] sm:text-xs font-mono tracking-widest text-white/[0.08] select-none uppercase">
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-1.5 rounded-full bg-red-500/30" />
                REC [35mm KODAK SAFETY]
              </span>
              <span>TAPE // {tapeId}</span>
              <span>PLAY ▶ 00:24:{String(idx * 16 + 10).padStart(2, '0')}</span>
              <span className="hidden sm:inline">SP / STEREO</span>
            </div>

            <div className="film-sprockets-border w-full opacity-30" />

            {/* Giant Display Typography */}
            <div className="py-1">
              <span
                className={
                  isStroke
                    ? 'text-stroke-zzz font-display text-[9.5rem] sm:text-[14rem] lg:text-[18.5rem] font-black uppercase tracking-tight select-none leading-none'
                    : 'font-display text-[9.5rem] sm:text-[14rem] lg:text-[18.5rem] font-black uppercase tracking-tight text-white/[0.038] select-none leading-none'
                }
              >
                PROXYLOADOUTS
              </span>
            </div>

            {/* Bottom Film Sprocket Bar */}
            <div className="film-sprockets-border w-full opacity-30" />

            <div className="flex items-center justify-between px-2 text-[9px] sm:text-[10px] font-mono tracking-widest text-white/[0.06] select-none uppercase">
              <span>RANDOM PLAY // HOLLOW ARCHIVE</span>
              <span>FRAME {idx + 1}A</span>
              <span>CH-01/02</span>
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="flex select-none overflow-hidden py-1">
      <div
        className={trackClass}
        style={{
          animationDuration: `${duration}s`,
        }}
      >
        {renderSegment('content-1')}
        {renderSegment('content-2')}
      </div>
    </div>
  )
}

/**
 * Atmospheric diagonal background animation inspired by Zenless Zone Zero UI and VHS lore.
 * Features:
 * - Unbounded Variable (wide futuristic display font)
 * - 35mm film strip borders and sprocket holes
 * - CRT / VHS scanlines and analog film grain noise
 * - Occasional drifting VHS tracking glitch bar
 * - Slow, ambient drift (190s–260s) along a -12deg diagonal
 */
export const ZzzBackground = React.memo(function ZzzBackground() {
  const { isEnabled } = useBgAnimation()
  const isMobile = useIsMobile()

  // On mobile viewports or touch devices, skip rendering completely
  // to avoid allocating 100+ DOM nodes, running marquee animations, and wasting GPU/battery resources.
  if (!isEnabled || isMobile) {
    return null
  }

  return (
    <div
      aria-hidden="true"
      className="zzz-bg-animated-root pointer-events-none fixed inset-0 z-0 select-none overflow-hidden"
    >
      {/* 1. Geometric container rotated -12deg to cover all viewport dimensions without wasteful offscreen area */}
      <div className="absolute -left-[25vw] -top-[35vh] flex h-[170vh] w-[150vw] -rotate-12 flex-col justify-around">
        <DiagonalMarqueeRow direction="left" duration={210} startWithStroke={false} tapeId="RP-01" />
        <DiagonalMarqueeRow direction="right" duration={250} startWithStroke={true} tapeId="RP-02" />
        <DiagonalMarqueeRow direction="left" duration={195} startWithStroke={false} tapeId="RP-03" />
        <DiagonalMarqueeRow direction="right" duration={240} startWithStroke={true} tapeId="RP-04" />
        <DiagonalMarqueeRow direction="left" duration={220} startWithStroke={false} tapeId="RP-05" />
      </div>

      {/* 2. CRT / VHS Scanlines Texture */}
      <div className="vhs-scanlines pointer-events-none absolute inset-0 opacity-30" />

      {/* 3. Analog Film Grain / Static Noise Texture (hardware accelerated without blend mode) */}
      <div className="film-grain pointer-events-none absolute inset-0 opacity-25" />

      {/* 4. VHS Glitch Tracking Line (drifts down slowly) */}
      <div className="vhs-tracking-line pointer-events-none" />

      {/* 5. Subtle radial vignette to soften edges and keep cards clear */}
      <div
        className="pointer-events-none absolute inset-0 bg-radial-[ellipse_80%_80%_at_50%_50%] from-transparent via-transparent to-background/30"
      />
    </div>
  )
})
