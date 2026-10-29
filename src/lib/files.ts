// =====================================================================
// SIGFCO - Armazenamento privado de ficheiros
// Ficheiros gravados fora de /public (db/uploads), nomes internos
// aleatórios, hash SHA-256, acesso só via endpoint autorizado.
// =====================================================================
import 'server-only'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'

const UPLOAD_DIR = path.join(process.cwd(), 'db', 'uploads')

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'application/pdf',
])

export type StoredFile = { buffer: Buffer; mime: string; originalName: string; hash: string; size: number }

export function validateUpload(buf: Buffer, mime: string, name: string): { ok: boolean; error?: string } {
  if (!buf || buf.length === 0) return { ok: false, error: 'Ficheiro vazio.' }
  if (buf.length > 12 * 1024 * 1024) return { ok: false, error: 'Ficheiro acima do limite (12 MB).' }
  if (!ALLOWED_MIME.has(mime)) return { ok: false, error: `Tipo não permitido: ${mime}. Use JPEG, PNG, WebP, HEIC ou PDF.` }
  const ext = path.extname(name || '').toLowerCase()
  if (ext && !['.jpg', '.jpeg', '.png', '.webp', '.heic', '.pdf'].includes(ext))
    return { ok: false, error: `Extensão não permitida: ${ext}` }
  return { ok: true }
}

export async function saveAttachment(params: {
  companyId: string
  kind: 'RECEIPT' | 'DOC' | 'POD' | 'INCIDENT' | 'OTHER'
  file: StoredFile
  expenseId?: string
  tripId?: string
  incidentId?: string
  documentId?: string
  workOrderId?: string
  uploadedById?: string
  capturedAt?: Date
  width?: number
  height?: number
}) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
  const internal = `${crypto.randomBytes(16).toString('hex')}${path.extname(params.file.originalName || '.bin')}`
  await fs.writeFile(path.join(UPLOAD_DIR, internal), params.file.buffer)
  return db.attachment.create({
    data: {
      companyId: params.companyId,
      kind: params.kind,
      path: internal,
      originalName: (params.file.originalName || 'ficheiro').slice(0, 160),
      mime: params.file.mime,
      size: params.file.size,
      hash: params.file.hash,
      width: params.width,
      height: params.height,
      capturedAt: params.capturedAt,
      uploadedById: params.uploadedById,
      expenseId: params.expenseId,
      tripId: params.tripId,
      incidentId: params.incidentId,
      documentId: params.documentId,
      workOrderId: params.workOrderId,
    },
  })
}

export async function readAttachmentBytes(attachmentId: string, companyId: string) {
  const att = await db.attachment.findUnique({ where: { id: attachmentId } })
  if (!att || att.companyId !== companyId) return null // isolamento por empresa
  try {
    const buf = await fs.readFile(path.join(UPLOAD_DIR, att.path))
    const verified = crypto.createHash('sha256').update(buf).digest('hex') === att.hash
    return { att, buf, verified }
  } catch {
    return null
  }
}
