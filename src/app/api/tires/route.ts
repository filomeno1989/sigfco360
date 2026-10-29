// SIGFCO - Pneus: cadastro, instalação, histórico de rotação
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const tires = await db.tire.findMany({
    where: { companyId },
    include: { },
    orderBy: { createdAt: 'desc' },
  })
  const events = await db.tireEvent.findMany({ where: { companyId }, orderBy: { date: 'desc' }, take: 200 })
  return jsonOk({ tires, events })
}, { anyPerm: ['maintenance.read', 'fleet.read'] })

export const POST = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, unknown>>(req)

  if (b.action === 'event') {
    const tire = await db.tire.findUnique({ where: { id: String(b.tireId ?? '') } })
    if (!tire || tire.companyId !== companyId) return jsonError(404, 'Pneu não encontrado.')
    const type = String(b.type ?? 'INSTALL')
    const event = await db.tireEvent.create({
      data: {
        companyId, tireId: tire.id, type,
        vehicleId: (b.vehicleId as string) || null,
        position: (b.position as string) || null,
        odoKm: b.odoKm ? Number(b.odoKm) : null,
        note: (b.note as string) || null,
        byUserId: ctx.user.id,
      },
    })
    // actualiza posição/estado do pneu
    const data: Record<string, unknown> = {}
    if (type === 'INSTALL') { data.status = 'INSTALLED'; data.vehicleId = b.vehicleId; data.position = b.position; data.installedAt = new Date(); data.installedOdoKm = b.odoKm ? Number(b.odoKm) : null }
    if (type === 'REMOVE') { data.status = 'IN_STOCK'; data.vehicleId = null; data.position = null }
    if (type === 'REPAIR') data.status = 'REPAIR'
    if (type === 'REPLACE') { data.status = 'RETIRED'; data.vehicleId = null; data.position = null }
    await db.tire.update({ where: { id: tire.id }, data })
    await audit({ req, ctx, companyId, action: 'TIRE_EVENT', entity: 'Tire', entityId: tire.id, after: { type, position: b.position } })
    return jsonOk({ event })
  }

  const serial = String(b.serial ?? '').trim()
  if (!serial) return jsonError(400, 'Número de série do pneu obrigatório.')
  if (await db.tire.findUnique({ where: { companyId_serial: { companyId, serial } } })) return jsonError(409, 'Pneu já registado.')
  const tire = await db.tire.create({
    data: {
      companyId, serial,
      brand: (b.brand as string) || null, model: (b.model as string) || null, size: (b.size as string) || null,
      status: (b.status as string) || 'IN_STOCK',
      notes: (b.notes as string) || null,
    },
  })
  await audit({ req, ctx, companyId, action: 'CREATE', entity: 'Tire', entityId: tire.id, after: { serial } })
  return jsonOk({ tire })
}, { perm: 'maintenance.manage' })
