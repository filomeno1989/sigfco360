// SIGFCO - Ocorrências/incidentes - idempotentes via clientUuid
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'
import { INCIDENT_TYPES } from '@/lib/constantes'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const tripId = req.nextUrl.searchParams.get('tripId')
  const incidents = await db.incident.findMany({
    where: { companyId, ...(tripId ? { tripId } : {}) },
    orderBy: { deviceTime: 'desc' },
    take: 200,
    include: { vehicle: { select: { plate: true } }, trip: { select: { code: true } } },
  })
  return jsonOk({ incidents })
}, { anyPerm: ['trip.read', 'trip.own'] })

export const POST = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, unknown>>(req)
  const clientUuid = String(b.clientUuid ?? crypto.randomUUID())
  const existing = await db.incident.findUnique({ where: { clientUuid } })
  if (existing) return jsonOk({ incident: existing, idempotent: true })

  const type = String(b.type ?? 'OUTRO')
  if (!INCIDENT_TYPES.includes(type as never)) return jsonError(400, 'Tipo de ocorrência inválido.')
  const incident = await db.incident.create({
    data: {
      clientUuid, companyId,
      tripId: (b.tripId as string) || null,
      vehicleId: (b.vehicleId as string) || null,
      driverId: (b.driverId as string) || ctx.user.driverId || null,
      type,
      severity: (b.severity as string) || 'MEDIUM',
      description: String(b.description ?? ''),
      lat: (b.lat as number) ?? null,
      lng: (b.lng as number) ?? null,
      deviceTime: b.deviceTime ? new Date(String(b.deviceTime)) : new Date(),
      authorUserId: ctx.user.id,
      authorLabel: ctx.user.name,
    },
  })
  await db.alert.create({
    data: {
      companyId,
      severity: incident.severity === 'CRITICAL' ? 'CRITICAL' : incident.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
      type: 'OTHER',
      title: `Ocorrência: ${type}`,
      message: incident.description.slice(0, 280),
      refType: 'INCIDENT', refId: incident.id, tripId: incident.tripId, vehicleId: incident.vehicleId,
    },
  })
  await audit({ req, ctx, companyId, action: 'CREATE', entity: 'Incident', entityId: incident.id, after: { type, severity: incident.severity } })
  return jsonOk({ incident })
}, { anyPerm: ['trip.own', 'trip.manage', 'fleet.manage'] })
