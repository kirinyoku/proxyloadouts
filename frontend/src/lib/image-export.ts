export class ImageAssetError extends Error {
  constructor() {
    super('Image export artwork could not be loaded')
    this.name = 'ImageAssetError'
  }
}

export function canCopyPng(): boolean {
  return typeof navigator !== 'undefined'
    && typeof navigator.clipboard?.write === 'function'
    && typeof ClipboardItem !== 'undefined'
    && (typeof ClipboardItem.supports !== 'function' || ClipboardItem.supports('image/png'))
}

export async function copyPng(image: Promise<Blob>): Promise<void> {
  // Write during the click gesture, before rendering/asset awaits (required by Safari).
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': image })])
}

export function downloadPng(image: Blob, name: string): void {
  const url = URL.createObjectURL(image)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `ProxyLoadouts-${name.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 80) || 'build'}.png`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Give the browser time to start consuming the object URL, including on iOS.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
