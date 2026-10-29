// SIGFCO - Reboques e combinações
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'
import { normalizePlate } from '@/lib/plate'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const trailers = await db.trailer.findMany({ where: { companyId }, orderBy: { plate: 'asc' } })
  return jsonOk({ trailers })
}, { anyPerm: ['fleet.read', 'trip.read'] })

export const POST = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, unknown>>(req)
  const plate = normalizePlate(String(b.plate ?? ''))
  if (!plate) return jsonError(400, 'Matrícula/identificação do reboque obrigatória.')
  if (await db.trailer.findUnique({ where: { companyId_plate: { companyId, plate } } }))
    return jsonError(409, `Reboque ${plate} já registado.`)
  const trailer = await db.trailer.create({
    data: {
      companyId, plate,
      type: (b.type as string) || 'TRAILER',
      brand: (b.brand as string) || null, model: (b.model as string) || null,
      capacityKg: b.capacityKg ? Number(b.capacityKg) : null,
      status: (b.status as string) || 'AVAILABLE',
      notes: (b.notes as string) || null,
    },
  })
  await audit({ req, ctx, companyId, action: 'CREATE', entity: 'Trailer', entityId: trailer.id, after: { plate } })
  return jsonOk({ trailer })
}, { perm: 'fleet.manage' })

export const PATCH = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, unknown>>(req)
  const trailer = await db.trailer.findUnique({ where: { id: String(b.id) } })
  if (!trailer || trailer.companyId !== companyId) return jsonError(404, 'Reboque não encontrado.')
  const data: Record<string, unknown> = {}
  for (const k of ['brand', 'model', 'status', 'notes', 'type']) if (b[k] !== undefined) data[k] = b[k] === '' ? null : b[k]
  if (b.capacityKg !== undefined) data.capacityKg = Number(b.capacityKg)
  if (b.plate !== undefined) data.plate = normalizePlate(String(b.plate))
  const updated = await db.trailer.update({ where: { id: trailer.id }, data })
  await audit({ req, ctx, companyId, action: 'UPDATE', entity: 'Trailer', entityId: trailer.id, before: trailer, after: updated })
  return jsonOk({ trailer: updated })
}, { perm: 'fleet.manage' })
