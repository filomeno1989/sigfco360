// SIGFCO - Viagens: listagem e criação
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'
import { nextCode } from '@/lib/numeracao'
import { conflictCheck, resourceBlockers } from '@/lib/viagem'
import { TRIP_STATUS_LABELS } from '@/lib/constantes'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const sp = req.nextUrl.searchParams
  const status = sp.get('status')
  const q = sp.get('q')
  const driverId = sp.get('driverId')

  // Motorista vê apenas as suas viagens
  const driverScope = ctx.user.role === 'DRIVER'
    ? { driverId: ctx.user.driverId ?? '___none___' }
    : { ...(driverId ? { driverId } : {}) }

  const trips = await db.trip.findMany({
    where: {
      companyId,
      ...(status ? { status } : {}),
      ...(driverScope as object),
      ...(q ? { OR: [{ code: { contains: q } }, { client: { contains: q } }, { origin: { contains: q } }, { destination: { contains: q } }] } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      driver: { select: { id: true, name: true } },
      vehicle: { select: { id: true, plate: true, brand: true, model: true } },
      trailer: { select: { id: true, plate: true } },
    },
  })

  // Motorista não vê orçamento global/custos confidenciais
  const visible = trips.map((t) => ctx.user.role === 'DRIVER'
    ? { ...t, budgetMinorTotal: undefined, closeBlockers: undefined }
    : t)
  return jsonOk({ trips: visible })
}, { anyPerm: ['trip.read', 'trip.own'] })

export const POST = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, unknown>>(req)

  const driverId = String(b.driverId ?? '')
  const vehicleId = String(b.vehicleId ?? '')
  if (!driverId || !vehicleId) return jsonError(400, 'Motorista e veículo são obrigatórios.')

  const plannedStart = b.plannedStart ? new Date(String(b.plannedStart)) : new Date()
  const plannedEnd = b.plannedEnd ? new Date(String(b.plannedEnd)) : null

  //: verificação automática ANTES da confirmação
  const [blockers, conflicts] = await Promise.all([
    resourceBlockers(companyId, vehicleId, driverId),
    conflictCheck(companyId, vehicleId, driverId, plannedStart, plannedEnd),
  ])

  const status = (b.status as string) === 'PLANNED' ? 'PLANNED' : 'DRAFT'
  if (status === 'PLANNED' && blockers.length > 0)
    return jsonError(400, 'Não é possível planear: existem bloqueios de elegibilidade.', { blockers })
  if (status === 'PLANNED' && conflicts.length > 0)
    return jsonError(409, 'Conflitos de disponibilidade detectados.', { conflicts })

  const code = await nextCode(companyId, 'trip')
  const trip = await db.trip.create({
    data: {
      companyId, code,
      client: (b.client as string) || null,
      origin: String(b.origin ?? 'Porto da Beira'),
      destination: String(b.destination ?? ''),
      waypointsJson: b.waypoints ? JSON.stringify(b.waypoints) : null,
      cargoDesc: (b.cargoDesc as string) || null,
      cargoRef: (b.cargoRef as string) || null,
      driverId, vehicleId,
      trailerId: (b.trailerId as string) || null,
      secondDriverId: (b.secondDriverId as string) || null,
      plannedStart, plannedEnd,
      plannedDistanceKm: b.plannedDistanceKm ? Number(b.plannedDistanceKm) : null,
      status,
      notes: (b.notes as string) || null,
      createdById: ctx.user.id,
      isDemo: Boolean(b.isDemo),
    },
  })

  ///034: linhas de orçamento por rubrica e moeda
  if (Array.isArray(b.budgetLines)) {
    for (const line of b.budgetLines as Array<{ category: string; currency: string; limitMinor: number; note?: string }>) {
      if (!line.category || !line.limitMinor) continue
      await db.tripBudgetLine.create({
        data: { tripId: trip.id, companyId, category: line.category, currency: line.currency || 'MZN', limitMinor: Number(line.limitMinor), note: line.note },
      })
    }
  }

  await audit({ req, ctx, companyId, action: 'CREATE', entity: 'Trip', entityId: trip.id, after: { code, status, vehicleId, driverId } })
  return jsonOk({ trip, blockers: status === 'DRAFT' ? blockers : [], conflicts })
}, { anyPerm: ['trip.manage'] })
