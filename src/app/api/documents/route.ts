// SIGFCO - Documentos e vencimentos
// Bloqueio de viagem quando documento obrigatório expirado
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const ownerType = req.nextUrl.searchParams.get('ownerType')
  const ownerId = req.nextUrl.searchParams.get('ownerId')
  const filter = req.nextUrl.searchParams.get('filter') // expiring | expired

  const now = new Date()
  const in30 = new Date(Date.now() + 30 * 86400_000)
  const docs = await db.documentItem.findMany({
    where: {
      companyId,
      ...(ownerType ? { ownerType } : {}),
      ...(ownerType && ownerId ? { [ownerType === 'VEHICLE' ? 'vehicleId' : ownerType === 'DRIVER' ? 'driverId' : ownerType === 'TRAILER' ? 'trailerId' : 'tripId']: ownerId } : {}),
      ...(filter === 'expiring' ? { expiresAt: { gte: now, lte: in30 } } : {}),
      ...(filter === 'expired' ? { expiresAt: { lt: now } } : {}),
    },
    orderBy: { expiresAt: 'asc' },
  })

  // recalcular estado e criar alertas para expirados bloqueantes
  for (const d of docs) {
    if (!d.expiresAt) continue
    const st = d.expiresAt < now ? 'EXPIRED' : d.expiresAt < in30 ? 'EXPIRING' : 'VALID'
    if (st !== d.status) {
      await db.documentItem.update({ where: { id: d.id }, data: { status: st } })
      if (st === 'EXPIRED' && d.blocking) {
        const existing = await db.alert.findFirst({ where: { companyId, type: 'DOC_EXPIRED', refId: d.id, status: 'OPEN' } })
        if (!existing) {
          await db.alert.create({
            data: { companyId, severity: 'CRITICAL', type: 'DOC_EXPIRED',
              title: `Documento obrigatório expirado: ${d.type}`,
              message: `Documento ${d.number ?? ''} (${d.type}) expirou em ${d.expiresAt.toISOString().slice(0, 10)}. Viagens bloqueadas até actualização.`,
              refType: 'DOCUMENT', refId: d.id },
          })
        }
      }
      d.status = st
    }
  }
  return jsonOk({ documents: docs })
}, { anyPerm: ['fleet.read', 'doc.manage', 'trip.read'] })

export const POST = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, unknown>>(req)
  const doc = await db.documentItem.create({
    data: {
      companyId,
      ownerType: (b.ownerType as string) || 'VEHICLE',
      vehicleId: (b.vehicleId as string) || null,
      driverId: (b.driverId as string) || null,
      trailerId: (b.trailerId as string) || null,
      tripId: (b.tripId as string) || null,
      type: String(b.type ?? 'outro'),
      number: (b.number as string) || null,
      issuerCountry: (b.issuerCountry as string) || null,
      issuedAt: b.issuedAt ? new Date(String(b.issuedAt)) : null,
      expiresAt: b.expiresAt ? new Date(String(b.expiresAt)) : null,
      blocking: Boolean(b.blocking),
      notes: (b.notes as string) || null,
    },
  })
  await audit({ req, ctx, companyId, action: 'CREATE', entity: 'DocumentItem', entityId: doc.id, after: { type: doc.type, number: doc.number, blocking: doc.blocking } })
  return jsonOk({ document: doc })
}, { perm: 'doc.manage' })

export const PATCH = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, unknown>>(req)
  const doc = await db.documentItem.findUnique({ where: { id: String(b.id) } })
  if (!doc || doc.companyId !== companyId) return jsonError(404, 'Documento não encontrado.')
  const data: Record<string, unknown> = {}
  for (const k of ['type', 'number', 'issuerCountry', 'notes']) if (b[k] !== undefined) data[k] = b[k] === '' ? null : b[k]
  if (b.issuedAt !== undefined) data.issuedAt = b.issuedAt ? new Date(String(b.issuedAt)) : null
  if (b.expiresAt !== undefined) data.expiresAt = b.expiresAt ? new Date(String(b.expiresAt)) : null
  if (b.blocking !== undefined) data.blocking = Boolean(b.blocking)
  const updated = await db.documentItem.update({ where: { id: doc.id }, data })
  await audit({ req, ctx, companyId, action: 'UPDATE', entity: 'DocumentItem', entityId: doc.id, before: doc, after: updated })
  return jsonOk({ document: updated })
}, { perm: 'doc.manage' })
