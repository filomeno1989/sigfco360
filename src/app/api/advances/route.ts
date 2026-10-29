// SIGFCO - Adiantamentos e reconciliação
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'
import { reconcileTrip } from '@/lib/financeiro'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const tripId = req.nextUrl.searchParams.get('tripId')
  const reconciliation = tripId ? await reconcileTrip(companyId, tripId) : null
  const advances = await db.advance.findMany({
    where: { companyId, ...(tripId ? { tripId } : {}) },
    orderBy: { grantedAt: 'desc' },
    include: { driver: { select: { name: true } }, trip: { select: { code: true } } },
  })
  return jsonOk({ advances, reconciliation })
}, { perm: 'finance.read' })

export const POST = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, unknown>>(req)
  const trip = await db.trip.findUnique({ where: { id: String(b.tripId ?? '') } })
  if (!trip || trip.companyId !== companyId) return jsonError(404, 'Viagem não encontrada.')
  const amountMinor = Number(b.amountMinor)
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) return jsonError(400, 'Montante inválido.')

  const advance = await db.advance.create({
    data: {
      companyId, tripId: trip.id,
      driverId: String(b.driverId ?? trip.driverId),
      amountMinor, currency: String(b.currency ?? 'MZN'),
      method: (b.method as string) || null,
      authorizedById: ctx.user.id,
      docRef: (b.docRef as string) || null,
      notes: (b.notes as string) || null,
    },
  })
  await audit({ req, ctx, companyId, action: 'CREATE', entity: 'Advance', entityId: advance.id, after: { trip: trip.code, amountMinor, currency: advance.currency } })
  return jsonOk({ advance })
}, { perm: 'finance.manage' })

export const PATCH = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<{ id: string; settledMinor?: number }>(req)
  const advance = await db.advance.findUnique({ where: { id: b.id } })
  if (!advance || advance.companyId !== companyId) return jsonError(404, 'Adiantamento não encontrado.')
  const updated = await db.advance.update({
    where: { id: advance.id },
    data: { settledMinor: b.settledMinor !== undefined ? Number(b.settledMinor) : undefined },
  })
  await audit({ req, ctx, companyId, action: 'UPDATE', entity: 'Advance', entityId: advance.id, before: { settled: advance.settledMinor }, after: { settled: updated.settledMinor } })
  return jsonOk({ advance: updated })
}, { perm: 'finance.manage' })
