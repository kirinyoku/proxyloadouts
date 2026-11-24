import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/sonner'
import { canCopyPng, copyPng, downloadPng, ImageAssetError } from '@/lib/image-export'
import type { ImageExportSubject } from '@/lib/render-share-image'

export function useImageExport() {
  const { t } = useTranslation()
  const busy = useRef(false)
  const [isExporting, setIsExporting] = useState(false)

  async function exportImage(subject: ImageExportSubject, action: 'download' | 'copy') {
    if (busy.current) return
    if (action === 'copy' && !canCopyPng()) {
      toast.error(t('sharing.copyImageUnavailable'))
      return
    }
    busy.current = true
    setIsExporting(true)
    const toastId = toast.loading(t('sharing.preparingImage'))
    try {
      const image = import('@/lib/render-share-image').then(({ renderShareImage }) => renderShareImage(subject))
      // Observe both promises even when clipboard permissions are rejected immediately.
      const delivery = action === 'copy'
        ? copyPng(image)
        : image.then((blob) => downloadPng(blob, subject.kind === 'build' ? subject.build.name : subject.team.name))
      await Promise.all([image, delivery])
      toast.success(t(action === 'copy' ? 'sharing.imageCopied' : 'sharing.imageDownloaded'))
    } catch (error) {
      toast.error(t(error instanceof ImageAssetError ? 'sharing.imageAssetError' : action === 'copy' ? 'sharing.copyImageError' : 'sharing.imageExportError'))
    } finally {
      toast.dismiss(toastId)
      busy.current = false
      setIsExporting(false)
    }
  }

  return { isExporting, exportImage }
}
