// =====================================================================
// SIGFCO - Estado do veículo calculado a partir de eventos
// Não marcar como Disponível um veículo com manutenção crítica vencida,
// documento obrigatório expirado, rastreador inoperacional ou checklist
// reprovada. Transições automáticas deixam registo.
// =====================================================================
import 'server-only'
import { db } from '@/lib/db'
import { audit } from './api'
import { TRIP_ACTIVE_STATUSES } from './constantes'

export async function recomputeVehicleState(vehicleId: string, actor?: { name?: string }) {
  const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId } })
  if (!vehicle) return null
  const now = new Date()
  const previous = vehicle.status
  let next = vehicle.status
  let reason = vehicle.stateReason ?? ''

  const activeTrip = await db.trip.findFirst({
    where: {
      vehicleId,
      status: { in: ['IN_TRANSIT', 'PAUSED', 'ARRIVED', 'AWAITING_RECONCILIATION', 'AUTHORIZED_DEPARTURE'] },
    },
    orderBy: { createdAt: 'desc' },
  })

  const criticalWO = await db.workOrder.findFirst({
    where: { vehicleId, companyId: vehicle.companyId, critical: true, blocksVehicle: true, status: { in: ['OPEN', 'IN_PROGRESS'] } },
  })
  const anyOpenWO = await db.workOrder.findFirst({
    where: { vehicleId, companyId: vehicle.companyId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
  })

  const expiredDoc = await db.documentItem.findFirst({
    where: { companyId: vehicle.companyId, vehicleId, blocking: true, expiresAt: { lt: now } },
  })

  const reservedTrip = await db.trip.findFirst({
    where: { vehicleId, status: { in: TRIP_ACTIVE_STATUSES }, id: activeTrip?.id ? { not: activeTrip.id } : undefined },
  })

  if (activeTrip && ['IN_TRANSIT', 'PAUSED'].includes(activeTrip.status)) {
    next = 'IN_TRANSIT'
    reason = `Viagem ${activeTrip.code}`
  } else if (criticalWO) {
    next = 'BLOCKED'
    reason = `Manutenção crítica ${criticalWO.code} em aberto`
  } else if (activeTrip) {
    next = 'RESERVED'
    reason = `Viagem ${activeTrip.code} (${activeTrip.status})`
  } else if (reservedTrip) {
    next = 'RESERVED'
    reason = `Reservado para ${reservedTrip.code}`
  } else if (anyOpenWO) {
    next = 'MAINTENANCE'
    reason = `Ordem de serviço ${anyOpenWO.code} em aberto`
  } else if (expiredDoc) {
    next = 'BLOCKED'
    reason = `Documento obrigatório expirado: ${expiredDoc.type}`
  } else if (vehicle.status !== 'INACTIVE') {
    next = 'AVAILABLE'
    reason = ''
  } else {
    next = 'INACTIVE'
    reason = 'Inactivado manualmente'
  }

  if (next !== previous) {
    await db.vehicle.update({ where: { id: vehicleId }, data: { status: next, stateReason: reason || null } })
    await audit({
      action: 'VEHICLE_STATE_AUTO',
      entity: 'Vehicle',
      entityId: vehicleId,
      companyId: vehicle.companyId,
      before: { status: previous },
      after: { status: next, reason },
    })
  }
  return { previous, next, reason }
}
