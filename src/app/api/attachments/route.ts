// SIGFCO - Upload de anexos
// Imagens já comprimidas no dispositivo; o servidor valida tipo real,
// tamanho e guarda com nome interno aleatório + hash de integridade.
import { withAuth, jsonOk, jsonError, audit, scopeCompanyId } from '@/lib/api'
import { readJson } from '@/lib/api'
import { saveAttachment, validateUpload } from '@/lib/files'

export const dynamic = 'force-dynamic'

export const POST = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<{
    kind?: 'RECEIPT' | 'DOC' | 'POD' | 'INCIDENT' | 'OTHER'
    dataUrl: string
    originalName?: string
    capturedAt?: string
    tripId?: string
    width?: number
    height?: number
  }>(req)

  const m = /^data:([^;]+);base64,(.+)$/.exec(b.dataUrl)
  if (!m) return jsonError(400, 'dataUrl inválido.')
  const mime = m[1]
  const buffer = Buffer.from(m[2], 'base64')

  const check = validateUpload(buffer, mime, b.originalName ?? 'foto.jpg')
  if (!check.ok) return jsonError(400, check.error!)
  const crypto = await import('crypto')
  const hash = crypto.createHash('sha256').update(buffer).digest('hex')

  const att = await saveAttachment({
    companyId,
    kind: b.kind ?? 'RECEIPT',
    file: { buffer, mime, originalName: b.originalName ?? 'foto.jpg', hash, size: buffer.length },
    tripId: b.tripId,
    uploadedById: ctx.user.id,
    capturedAt: b.capturedAt ? new Date(b.capturedAt) : new Date(),
    width: b.width, height: b.height,
  })
  await audit({ req, ctx, companyId, action: 'UPLOAD', entity: 'Attachment', entityId: att.id, after: { kind: att.kind, size: att.size, hash: att.hash.slice(0, 12) } })
  return jsonOk({ attachment: { id: att.id, hash: att.hash, size: att.size, mime: att.mime } })
}, { anyPerm: ['expense.submit', 'expense.own', 'trip.own', 'doc.manage', 'fleet.manage', 'trip.manage'] })
