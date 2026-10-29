// SIGFCO - Cercas geográficas
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const fences = await db.geofence.findMany({ where: { companyId }, orderBy: { name: 'asc' } })
  return jsonOk({ geofences: fences })
}, { perm: 'gps.view' })

export const POST = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, unknown>>(req)
  const fence = await db.geofence.create({
    data: {
      companyId,
      name: String(b.name ?? 'Cerca sem nome'),
      type: (b.type as string) || 'BASE',
      lat: Number(b.lat), lng: Number(b.lng),
      radiusM: b.radiusM ? Number(b.radiusM) : 300,
      polygonJson: b.polygonJson ? JSON.stringify(b.polygonJson) : null,
      active: b.active === undefined ? true : Boolean(b.active),
      notes: (b.notes as string) || null,
    },
  })
  await audit({ req, ctx, companyId, action: 'CREATE', entity: 'Geofence', entityId: fence.id, after: { name: fence.name } })
  return jsonOk({ geofence: fence })
}, { perm: 'gps.manage' })

export const PATCH = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, unknown>>(req)
  const fence = await db.geofence.findUnique({ where: { id: String(b.id) } })
  if (!fence || fence.companyId !== companyId) return jsonError(404, 'Cerca não encontrada.')
  const data: Record<string, unknown> = {}
  for (const k of ['name', 'type', 'notes']) if (b[k] !== undefined) data[k] = b[k]
  if (b.lat !== undefined) data.lat = Number(b.lat)
  if (b.lng !== undefined) data.lng = Number(b.lng)
  if (b.radiusM !== undefined) data.radiusM = Number(b.radiusM)
  if (b.active !== undefined) data.active = Boolean(b.active)
  const updated = await db.geofence.update({ where: { id: fence.id }, data })
  await audit({ req, ctx, companyId, action: 'UPDATE', entity: 'Geofence', entityId: fence.id, before: fence, after: updated })
  return jsonOk({ geofence: updated })
}, { perm: 'gps.manage' })
