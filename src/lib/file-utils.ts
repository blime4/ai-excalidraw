import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

export interface Attachment {
  id: string
  file: File
  name: string
  type: 'image' | 'document'
  mimeType: string
  size: number
  dataUrl?: string
  textContent?: string
  width?: number
  height?: number
}

export interface AttachmentMeta {
  name: string
  type: 'image' | 'document'
  mimeType: string
  size: number
}

export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_TEXT_CONTENT = 200_000 // ~200K chars, safe for LLM context
const MAX_PDF_PAGES = 100

export const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  // SVG is rendered via <img> only (not dangerouslySetInnerHTML), safe from XSS
  'image/svg+xml',
]

export const ACCEPTED_DOCUMENT_EXTENSIONS = [
  '.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml',
  '.log', '.js', '.ts', '.tsx', '.jsx', '.py', '.java',
  '.c', '.cpp', '.h', '.css', '.html', '.htm', '.sh',
  '.sql', '.ini', '.toml', '.conf', '.pdf',
]

export const ACCEPTED_EXTENSIONS = [
  ...ACCEPTED_DOCUMENT_EXTENSIONS,
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp',
]

function truncateText(text: string): string {
  if (text.length <= MAX_TEXT_CONTENT) return text
  return text.slice(0, MAX_TEXT_CONTENT) + '\n[... 内容已截断]'
}

export function isImageFile(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(file.type)
}

export function isDocumentFile(file: File): boolean {
  if (file.type === 'application/pdf') return true
  const parts = file.name.split('.')
  if (parts.length < 2) return false
  const ext = '.' + parts.pop()!.toLowerCase()
  const basename = parts.join('.')
  if (!basename) return false
  return ACCEPTED_DOCUMENT_EXTENSIONS.includes(ext)
}

export function isAcceptedFile(file: File): boolean {
  return isImageFile(file) || isDocumentFile(file)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
    reader.readAsDataURL(file)
  })
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 0, height: 0 })
    img.src = dataUrl
  })
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(truncateText(reader.result as string))
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
    reader.readAsText(file)
  })
}

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages: string[] = []
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES)
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const text = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    if (text.trim()) pages.push(text.trim())
  }
  if (pdf.numPages > MAX_PDF_PAGES) {
    pages.push(`[... 仅显示前 ${MAX_PDF_PAGES} 页，共 ${pdf.numPages} 页]`)
  }
  return truncateText(pages.join('\n\n'))
}

export async function processFile(file: File): Promise<Attachment> {
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const isImage = isImageFile(file)

  const attachment: Attachment = {
    id,
    file,
    name: file.name,
    type: isImage ? 'image' : 'document',
    mimeType: file.type,
    size: file.size,
  }

  if (isImage) {
    attachment.dataUrl = await readFileAsDataUrl(file)
    const dims = await getImageDimensions(attachment.dataUrl)
    attachment.width = dims.width
    attachment.height = dims.height
  } else if (file.type === 'application/pdf') {
    attachment.textContent = await extractPdfText(file)
  } else {
    attachment.textContent = await readFileAsText(file)
  }

  return attachment
}

export function toAttachmentMeta(attachment: Attachment): AttachmentMeta {
  return {
    name: attachment.name,
    type: attachment.type,
    mimeType: attachment.mimeType,
    size: attachment.size,
  }
}
