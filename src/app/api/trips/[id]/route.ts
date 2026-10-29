// SIGFCO - Detalhe da viagem: dados completos para o ecrã de operação
import { withAuth, jsonOk, jsonError, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'
import { computeTripBudget } from '@/lib/financeiro'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req, params }) => {
  const companyId = scopeCompanyId(ctx, req)
  const id = params.id
  const trip = await db.trip.findUnique({
    where: { id },
    include: {
      driver: true,
      vehicle: true,
      trailer: true,
      secondDriver: true,
      events: { orderBy: { deviceTime: 'desc' }, take: 100 },
      checklist: true,
      budgetLines: true,
      advances: true,
    },
  })
  if (!trip || trip.companyId !== companyId) return jsonError(404, 'Viagem não encontrada.')

  // Motorista: apenas a sua viagem e sem orçamento global
  const isOwn = ctx.user.role === 'DRIVER' && ctx.user.driverId === trip.driverId
  if (ctx.user.role === 'DRIVER' && !isOwn) return jsonError(403, 'Só pode consultar a sua própria viagem.')

  const [expenses, incidents, budget, device, podAttachment] = await Promise.all([
    db.expense.findMany({ where: { tripId: id }, orderBy: { expenseDate: 'desc' }, include: { attachments: { select: { id: true, hash: true, mime: true } } } }),
    db.incident.findMany({ where: { tripId: id }, orderBy: { deviceTime: 'desc' } }),
    ctx.user.role === 'DRIVER' ? null : computeTripBudget(companyId, id),
    db.gpsDevice.findFirst({ where: { companyId, vehicleId: trip.vehicleId } }),
    trip.podAttachmentId ? db.attachment.findUnique({ where: { id: trip.podAttachmentId } }) : null,
  ])

  const lastPoint = device ? await db.gpsPoint.findFirst({ where: { deviceId: device.id }, orderBy: { gnssTime: 'desc' } }) : null

  return jsonOk({
    trip,
    expenses,
    incidents,
    budget,
    device: device && { id: device.id, serial: device.serial, status: device.status, lastPointAt: device.lastPointAt },
    lastPoint: lastPoint && { lat: lastPoint.lat, lng: lastPoint.lng, gnssTime: lastPoint.gnssTime, source: lastPoint.source },
    podAttachment: podAttachment && { id: podAttachment.id, originalName: podAttachment.originalName },
  })
}, { anyPerm: ['trip.read', 'trip.own'] })
