import { useEffect } from 'react'
import { Copy, Download, LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import type { useImageExport } from '@/hooks/useImageExport'
import { canCopyPng } from '@/lib/image-export'
import type { ImageExportSubject } from '@/lib/render-share-image'

interface ImageExportMenuItemsProps extends ReturnType<typeof useImageExport> {
  subject: ImageExportSubject
  disabled?: boolean
}

export function ImageExportMenuItems({ subject, isExporting, exportImage, disabled = false }: ImageExportMenuItemsProps) {
  const { t } = useTranslation()
  const copySupported = canCopyPng()

  useEffect(() => {
    if (disabled) return
    void import('@/lib/render-share-image')
      .then(({ warmShareImage }) => warmShareImage(subject))
      .catch(() => undefined)
  }, [disabled, subject])

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="gap-2.5 px-2.5 py-1.5 whitespace-nowrap"
        disabled={disabled || isExporting}
        onSelect={() => { void exportImage(subject, 'download') }}
      >
        {isExporting ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
        {t('sharing.downloadPng')}
      </DropdownMenuItem>
      <DropdownMenuItem
        className="gap-2.5 px-2.5 py-1.5 whitespace-nowrap"
        disabled={disabled || isExporting || !copySupported}
        title={!copySupported ? t('sharing.copyImageUnavailable') : undefined}
        onSelect={() => { void exportImage(subject, 'copy') }}
      >
        <Copy className="size-4" />
        {t('sharing.copyImage')}
      </DropdownMenuItem>
    </>
  )
}
