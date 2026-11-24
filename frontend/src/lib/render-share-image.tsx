import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { I18nextProvider } from 'react-i18next'
import { createContext, destroyContext, domToBlob } from 'modern-screenshot'
import type { Context } from 'modern-screenshot'
import i18n from '@/i18n'
import { BuildShareImage } from '@/components/showcase/BuildShareImage'
import { agentRoleCircleUrl, agentRoleIconUrl, agentRoleSelectUrl } from '@/lib/agent-icons'
import { RARITY_ICONS, SPECIALTY_ICONS } from '@/lib/design-tokens'
import { ImageAssetError } from '@/lib/image-export'
import type { Build, Team, TeamMember } from '@/types'

export type ImageExportSubject =
  | { kind: 'build'; build: Build }
  | { kind: 'team'; team: Team; members: TeamMember[] }

const WIDTH = 1200
const MAX_ARTWORK_CACHE_ENTRIES = 128
const CSS_URL_RE = /url\((['"]?)([^'")]+)\1\)/g

const artworkCache = new Map<string, Promise<string>>()
let embeddedFontCssPromise: Promise<string | null> | null = null
let cachedStyleProperties: string[] | null = null

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Failed to read blob'))
    reader.onerror = () => reject(new Error('Failed to read blob'))
    reader.readAsDataURL(blob)
  })
}

async function fetchImageDataUrl(url: string): Promise<string> {
  // Existing <img> requests can leave opaque responses in the HTTP cache.
  // Fetch afresh with CORS before embedding; never export an empty artwork box.
  try {
    const response = await fetch(url, { mode: 'cors', cache: 'reload', credentials: 'omit', signal: AbortSignal.timeout(15_000) })
    if (!response.ok) throw new Error(`Image HTTP ${response.status}`)
    return await blobToDataUrl(await response.blob())
  } catch {
    throw new ImageAssetError()
  }
}

function getArtworkDataUrl(url: string): Promise<string> {
  let normalizedUrl: string
  try {
    normalizedUrl = new URL(url, document.baseURI).href
  } catch {
    return Promise.reject(new ImageAssetError())
  }
  const cached = artworkCache.get(normalizedUrl)
  if (cached) return cached
  if (artworkCache.size >= MAX_ARTWORK_CACHE_ENTRIES) {
    const oldest = artworkCache.keys().next().value
    if (oldest !== undefined) artworkCache.delete(oldest)
  }
  const pending = fetchImageDataUrl(normalizedUrl).catch((error: unknown) => {
    if (artworkCache.get(normalizedUrl) === pending) artworkCache.delete(normalizedUrl)
    throw error
  })
  artworkCache.set(normalizedUrl, pending)
  return pending
}

function hasCssRules(rule: CSSRule): rule is CSSRule & { readonly cssRules: CSSRuleList } {
  return 'cssRules' in rule && rule.cssRules instanceof CSSRuleList
}

function collectFontFaceRules(rules: CSSRuleList, out: CSSFontFaceRule[]): void {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSFontFaceRule) {
      out.push(rule)
    } else if (hasCssRules(rule)) {
      collectFontFaceRules(rule.cssRules, out)
    }
  }
}

function fetchFontDataUrl(url: string, pending: Map<string, Promise<string>>): Promise<string> {
  const existing = pending.get(url)
  if (existing) return existing
  const request = fetch(url, { cache: 'force-cache' }).then(async (response) => {
    if (!response.ok) throw new Error(`Font HTTP ${response.status}`)
    return blobToDataUrl(await response.blob())
  })
  pending.set(url, request)
  return request
}

async function inlineFontFaceRule(rule: CSSFontFaceRule, pending: Map<string, Promise<string>>): Promise<string> {
  const baseHref = rule.parentStyleSheet?.href || document.baseURI
  const replacements = new Map<string, string>()
  const jobs: Promise<void>[] = []

  for (const match of rule.cssText.matchAll(CSS_URL_RE)) {
    const rawUrl = match[2]
    if (!rawUrl || rawUrl.startsWith('data:')) continue
    const resolvedUrl = new URL(rawUrl, baseHref).href
    if (replacements.has(resolvedUrl)) continue
    replacements.set(resolvedUrl, '')
    jobs.push(
      fetchFontDataUrl(resolvedUrl, pending).then((dataUrl) => {
        replacements.set(resolvedUrl, dataUrl)
      }),
    )
  }

  if (jobs.length === 0) return rule.cssText
  await Promise.all(jobs)

  return rule.cssText.replace(CSS_URL_RE, (full, quote: string, rawUrl: string) => {
    if (rawUrl.startsWith('data:')) return full
    const dataUrl = replacements.get(new URL(rawUrl, baseHref).href)
    return dataUrl ? `url(${quote}${dataUrl}${quote})` : full
  })
}

async function buildEmbeddedFontCss(): Promise<string | null> {
  try {
    const fontRules: CSSFontFaceRule[] = []
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        collectFontFaceRules(sheet.cssRules, fontRules)
      } catch {
        continue
      }
    }
    if (fontRules.length === 0) return null
    const fontFetches = new Map<string, Promise<string>>()
    const inlinedRules = await Promise.all(fontRules.map((rule) => inlineFontFaceRule(rule, fontFetches)))
    return inlinedRules.join('\n')
  } catch {
    return null
  }
}

function getEmbeddedFontCss(): Promise<string | null> {
  if (embeddedFontCssPromise) return embeddedFontCssPromise
  const pending = buildEmbeddedFontCss().then((css) => {
    if (css === null && embeddedFontCssPromise === pending) {
      embeddedFontCssPromise = null
    }
    return css
  })
  embeddedFontCssPromise = pending
  return pending
}

function getExportStyleProperties(frameWindow: Window): string[] | undefined {
  if (cachedStyleProperties) return cachedStyleProperties
  const computed = frameWindow.getComputedStyle(frameWindow.document.documentElement)
  // Custom properties inherit onto every node and multiply serialized SVG size without affecting computed output.
  const properties = Array.from(computed).filter((name) => !name.startsWith('--'))
  if (properties.length === 0) return undefined
  cachedStyleProperties = properties
  return properties
}

function collectBuildArtworkUrls(build: Build, urls: Set<string>): void {
  const agent = build.build_data
  const avatarUrl = agentRoleCircleUrl(agent.id) ?? agentRoleSelectUrl(agent.id) ?? agentRoleIconUrl(agent.id) ?? agent.splash_art_url
  const candidates = [
    avatarUrl,
    agent.specialty ? SPECIALTY_ICONS[agent.specialty] : undefined,
    agent.w_engine?.icon_url,
    agent.w_engine?.specialty ? SPECIALTY_ICONS[agent.w_engine.specialty] : undefined,
    agent.w_engine ? RARITY_ICONS[agent.w_engine.rarity] : undefined,
  ]
  for (const disc of agent.drive_discs?.slots ?? []) {
    candidates.push(disc.icon_path, RARITY_ICONS[disc.rarity])
  }
  for (const url of candidates) {
    if (url && !url.startsWith('data:')) {
      urls.add(url)
    }
  }
}

/**
 * Pre-fetches fonts and CORS artwork for a subject while the user views the share menu.
 */
export function warmShareImage(subject: ImageExportSubject): void {
  void getEmbeddedFontCss()
  const urls = new Set<string>()
  if (subject.kind === 'build') {
    collectBuildArtworkUrls(subject.build, urls)
  } else {
    for (const member of subject.members) {
      collectBuildArtworkUrls(member.build, urls)
    }
  }
  for (const url of urls) {
    void getArtworkDataUrl(url).catch(() => undefined)
  }
}

/**
 * Renders a build or team into a 2x desktop-layout PNG blob inside an isolated offscreen iframe.
 */
export async function renderShareImage(subject: ImageExportSubject): Promise<Blob> {
  if (subject.kind === 'team' && subject.members.length === 0) throw new Error('No builds to export')
  const fontCssPromise = getEmbeddedFontCss()
  // A separate desktop viewport keeps all six discs and stats visible on mobile too.
  const frame = document.createElement('iframe')
  // Match the site's standards mode; about:blank otherwise changes inline baselines.
  frame.srcdoc = '<!doctype html><html><head></head><body></body></html>'
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  frame.inert = true
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${WIDTH}px;height:1200px;border:0;pointer-events:none`
  try {
    await new Promise<void>((resolve) => {
      frame.onload = () => resolve()
      document.body.append(frame)
    })
    const frameWindow = frame.contentWindow
    const frameDocument = frame.contentDocument
    if (!frameWindow || !frameDocument) throw new Error('Export document is unavailable')
    for (const attribute of document.documentElement.attributes) {
      frameDocument.documentElement.setAttribute(attribute.name, attribute.value)
    }
    const base = frameDocument.createElement('base')
    base.href = document.baseURI
    frameDocument.head.append(base)
    await Promise.all([...document.querySelectorAll('style, link[rel="stylesheet"]')].map((stylesheet) => {
      const clone = stylesheet.cloneNode(true)
      const loaded = stylesheet.tagName === 'LINK'
        ? new Promise<void>((resolve, reject) => {
            clone.addEventListener('load', () => resolve(), { once: true })
            clone.addEventListener('error', () => reject(new Error('Export stylesheet failed')), { once: true })
          })
        : Promise.resolve()
      frameDocument.head.append(clone)
      return loaded
    }))
    frameDocument.documentElement.style.background = 'transparent'
    frameDocument.body.style.cssText = 'margin:0;overflow:hidden;background:transparent;background-image:none'
    const container = frameDocument.createElement('div')
    frameDocument.body.append(container)
    const root = createRoot(container)
    try {
      flushSync(() => root.render(<I18nextProvider i18n={i18n}><BuildShareImage subject={subject} /></I18nextProvider>))
      await Promise.all([...container.querySelectorAll('img')].map(async (image) => {
        image.loading = 'eager'
        image.decoding = 'sync'
        if (!image.src.startsWith('data:')) {
          image.src = await getArtworkDataUrl(image.src)
          image.removeAttribute('srcset')
        }
        try {
          await image.decode()
        } catch {
          throw new ImageAssetError()
        }
      }))
      const [, fontCss] = await Promise.all([frameDocument.fonts.ready, fontCssPromise])
      const height = Math.ceil(container.getBoundingClientRect().height)
      frame.style.height = `${height}px`
      const exportRoot = container.firstElementChild
      const backgroundColor = exportRoot ? frameWindow.getComputedStyle(exportRoot).backgroundColor : undefined
      let exportContext: Context<HTMLDivElement> | null = null
      exportContext = await createContext(container, {
        width: WIDTH,
        height,
        scale: 2,
        backgroundColor,
        drawImageInterval: 32,
        includeStyleProperties: getExportStyleProperties(frameWindow),
        ...(fontCss ? { font: { cssText: fontCss } } : {}),
        features: { copyScrollbar: false },
        fetch: { placeholderImage: '' },
        onCreateForeignObjectSvg: () => {
          // One short redraw pass is enough once every nested asset is an inline data URL.
          if (exportContext && exportContext.drawImageCount > 2) {
            exportContext.drawImageCount = 2
          }
        },
      })
      try {
        return await domToBlob(exportContext)
      } finally {
        destroyContext(exportContext)
      }
    } finally {
      root.unmount()
    }
  } finally {
    frame.remove()
  }
}
