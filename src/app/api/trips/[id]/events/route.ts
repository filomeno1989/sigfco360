// SIGFCO - Eventos de viagem: partidas, checkpoints, fronteiras,
// pausas, SOS - idempotentes via clientUuid
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'
import { TRIP_EVENT_TYPES } from '@/lib/constantes'
import { createAlert } from '@/lib/gps'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req, params }) => {
  const companyId = scopeCompanyId(ctx, req)
  const trip = await db.trip.findUnique({ where: { id: params.id } })
  if (!trip || trip.companyId !== companyId) return jsonError(404, 'Viagem não encontrada.')
  if (ctx.user.role === 'DRIVER' && ctx.user.driverId !== trip.driverId) return jsonError(403, 'Só eventos da sua viagem.')
  const events = await db.tripEvent.findMany({ where: { tripId: params.id }, orderBy: { deviceTime: 'desc' } })
  return jsonOk({ events })
}, { anyPerm: ['trip.read', 'trip.own'] })

export const POST = withAuth(async ({ ctx, req, params }) => {
  const companyId = scopeCompanyId(ctx, req)
  const trip = await db.trip.findUnique({ where: { id: params.id } })
  if (!trip || trip.companyId !== companyId) return jsonError(404, 'Viagem não encontrada.')
  const isOwn = ctx.user.role === 'DRIVER' && ctx.user.driverId === trip.driverId
  if (!isOwn && !['DISPATCHER', 'FLEET_MANAGER', 'COMPANY_ADMIN', 'PLATFORM_ADMIN', 'BRANCH_MANAGER'].includes(ctx.user.role))
    return jsonError(403, 'Sem permissão para registar eventos nesta viagem.')
  if (['CLOSED', 'CANCELLED'].includes(trip.status) && bodyIsNotSystem(req))
    return jsonError(409, 'Viagem fechada - despesas/eventos exigem reabertura autorizada.')

  const body = await readJson<{ type: string; note?: string; lat?: number; lng?: number; deviceTime?: string; clientUuid?: string }>(req)
  if (!TRIP_EVENT_TYPES.includes(body.type as never)) return jsonError(400, 'Tipo de evento inválido.')

  const clientUuid = body.clientUuid || `srv-${crypto.randomUUID()}`
  const existing = await db.tripEvent.findUnique({ where: { clientUuid } })
  if (existing) return jsonOk({ event: existing, idempotent: true }) //: ACK de repetição

  const event = await db.tripEvent.create({
    data: {
      companyId, tripId: trip.id, type: body.type,
      lat: body.lat ?? null, lng: body.lng ?? null,
      deviceTime: body.deviceTime ? new Date(body.deviceTime) : new Date(),
      authorUserId: ctx.user.id, authorLabel: ctx.user.name,
      note: body.note || null, clientUuid,
    },
  })

  if (body.type === 'SOS') {
    //: SOS → alerta crítico + notificação in-app, com escalonamento
    await createAlert(companyId, {
      severity: 'CRITICAL', type: 'SOS',
      title: `SOS na viagem ${trip.code}`,
      message: `Motorista ${trip.driverId} pediu ajuda. ${body.note ?? ''} ${body.lat ? `Coordenadas: ${body.lat.toFixed(5)}, ${body.lng?.toFixed(5)}` : ''}`,
      refType: 'TRIP', refId: trip.id, vehicleId: trip.vehicleId, tripId: trip.id,
    })
  }
  await audit({ req, ctx, companyId, action: 'TRIP_EVENT', entity: 'TripEvent', entityId: event.id, after: { type: body.type, trip: trip.code } })
  return jsonOk({ event })
}, { anyPerm: ['trip.own', 'trip.manage'] })

function bodyIsNotSystem(_req: Request) {
  return true
}
