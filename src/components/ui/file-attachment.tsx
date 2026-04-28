import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Paperclip, FileText, X, ImageIcon } from 'lucide-react'
import type { Attachment } from '@/lib/file-utils'
import { formatFileSize, isAcceptedFile, MAX_FILE_SIZE, ACCEPTED_EXTENSIONS } from '@/lib/file-utils'
import { processFile } from '@/lib/file-utils'
import { cn } from '@/lib/utils'

interface FileAttachmentAreaProps {
  attachments: Attachment[]
  onRemove: (id: string) => void
  className?: string
}

export function FileAttachmentArea({ attachments, onRemove, className }: FileAttachmentAreaProps) {
  if (attachments.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-2 pb-2', className)}>
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="group relative inline-flex items-center gap-1.5 rounded-lg bg-secondary/30 border border-border/50 px-2 py-1.5 text-xs"
        >
          {attachment.type === 'image' ? (
            <div className="flex items-center gap-1.5">
              {attachment.dataUrl && (
                <img
                  src={attachment.dataUrl}
                  alt={attachment.name}
                  className="w-8 h-8 rounded object-cover"
                />
              )}
              <span className="max-w-[120px] truncate text-foreground/70">
                {attachment.name}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-foreground/50 shrink-0" />
              <span className="max-w-[120px] truncate text-foreground/70">
                {attachment.name}
              </span>
              <span className="text-foreground/40">
                {formatFileSize(attachment.size)}
              </span>
            </div>
          )}
          <button
            onClick={() => onRemove(attachment.id)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

interface FileInputButtonProps {
  onFilesSelected: (attachments: Attachment[]) => void
  onError?: (message: string) => void
  disabled?: boolean
}

export function FileInputButton({ onFilesSelected, onError, disabled }: FileInputButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const results: Attachment[] = []
    const errors: string[] = []

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} 超过 50MB 限制`)
        continue
      }
      if (!isAcceptedFile(file)) {
        errors.push(`${file.name} 格式不支持`)
        continue
      }
      try {
        const attachment = await processFile(file)
        results.push(attachment)
      } catch {
        errors.push(`${file.name} 处理失败`)
      }
    }

    if (errors.length > 0) {
      onError?.(errors.join('; '))
    }
    if (results.length > 0) {
      onFilesSelected(results)
    }

    // Reset input so the same file can be re-selected
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 w-9 h-9"
        onClick={handleClick}
        disabled={disabled}
        title="添加附件"
      >
        <Paperclip className="w-4 h-4" />
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS.join(',')}
        onChange={handleChange}
        className="hidden"
      />
    </>
  )
}

interface AttachmentPreviewProps {
  attachments: AttachmentMeta[]
}

export function AttachmentPreview({ attachments }: AttachmentPreviewProps) {
  if (!attachments || attachments.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 mb-1">
      {attachments.map((att, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary/30 text-[10px] text-foreground/60"
        >
          {att.type === 'image' ? (
            <ImageIcon className="w-2.5 h-2.5" />
          ) : (
            <FileText className="w-2.5 h-2.5" />
          )}
          {att.name}
        </span>
      ))}
    </div>
  )
}
