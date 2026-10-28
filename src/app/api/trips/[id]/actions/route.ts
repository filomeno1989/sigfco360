// =====================================================================
// SIGFCO — Acções do ciclo de vida da viagem (§5.1, FR-035..038, AT-003/016/017/023)
// Todas as transições validadas NO SERVIDOR; operações críticas auditadas;
// NÃO existe bypass do checklist bloqueante (FR-044 — sem "continuar mesmo assim").
// =====================================================================
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'
import { transitionAllowed, resourceBlockers, conflictCheck, checklistBlockers } from '@/lib/viagem'
import { recomputeVehicleState } from '@/lib/veiculo'
import { reconcileTrip } from '@/lib/financeiro'
import { TRIP_STATUS_LABELS, type TripStatus } from '@/lib/constantes'

export const dynamic = 'force-dynamic'

type Body = {
  action:
    | 'plan' | 'send_to_checklist' | 'authorize' | 'depart' | 'pause' | 'resume'
    | 'arrive' | 'request_close' | 'close' | 'reopen' | 'cancel'
  reason?: string
  note?: string
  lat?: number
  lng?: number
  departureOdometerKm?: number
  arrivalOdometerKm?: number
  podAttachmentId?: string
  force?: boolean // nunca aceite em itens críticos — apenas para pendências não críticas
}

export const POST = withAuth(async ({ ctx, req, params }) => {
  const companyId = scopeCompanyId(ctx, req)
  const trip = await db.trip.findUnique({
    where: { id: params.id },
    include: { checklist: true, vehicle: true, driver: true },
  })
  if (!trip || trip.companyId !== companyId) return jsonError(404, 'Viagem não encontrada.')

  const body = await readJson<Body>(req)
  const auditAct = async (after: object, reason?: string) =>
    audit({ req, ctx, companyId, action: body.action.toUpperCase(), entity: 'Trip', entityId: trip.id, before: { status: trip.status }, after, reason })

  // -------- planeamento (Planeada) --------
  if (body.action === 'plan') {
    const t = transitionAllowed(trip.status, 'PLANNED')
    if (!t.ok) return jsonError(409, t.reason!)
    const [blockers, conflicts] = await Promise.all([
      resourceBlockers(companyId, trip.vehicleId, trip.driverId),
      conflictCheck(companyId, trip.vehicleId, trip.driverId, trip.plannedStart, trip.plannedEnd, trip.id),
    ])
    if (blockers.length) return jsonError(400, 'Bloqueios de elegibilidade impendem o planeamento.', { blockers })
    if (conflicts.length) return jsonError(409, 'Conflitos de recursos (§5.3).', { conflicts })
    const approvedRoute = trip.waypointsJson
    const updated = await db.trip.update({
      where: { id: trip.id },
      data: { status: 'PLANNED', approvedRouteJson: approvedRoute }, // FR-031: guarda versão aprovada
    })
    await auditAct({ status: updated.status })
    await recomputeVehicleState(trip.vehicleId)
    return jsonOk({ trip: updated })
  }

  // -------- envio para checklist --------
  if (body.action === 'send_to_checklist') {
    const t = transitionAllowed(trip.status, 'AWAITING_CHECKLIST')
    if (!t.ok) return jsonError(409, t.reason!)
    // instancia a checklist a partir do template activo (FR-043)
    const template = await db.checklistTemplate.findFirst({ where: { companyId, active: true } })
    if (!template) return jsonError(400, 'Sem template de checklist activo. Configure a checklist da empresa.')
    const items = JSON.parse(template.itemsJson)
    await db.checklistRun.upsert({
      where: { tripId: trip.id },
      create: { companyId, tripId: trip.id, templateId: template.id, itemsJson: JSON.stringify(items), status: 'PENDING' },
      update: { templateId: template.id },
    })
    const updated = await db.trip.update({ where: { id: trip.id }, data: { status: 'AWAITING_CHECKLIST' } })
    await auditAct({ status: updated.status, checklistTemplate: template.name })
    return jsonOk({ trip: updated })
  }

  // -------- autorização de partida (exige checklist aprovada — AT-003) --------
  if (body.action === 'authorize') {
    const t = transitionAllowed(trip.status, 'AUTHORIZED_DEPARTURE')
    if (!t.ok) return jsonError(409, t.reason!)
    if (!trip.checklist || trip.checklist.status !== 'PASSED') {
      const blockers = trip.checklist ? checklistBlockers(trip.checklist.itemsJson).blockers : ['Checklist pré-partida ainda não submetida pelo motorista.']
      return jsonError(400, 'Viagem bloqueada: checklist pré-partida não aprovada (FR-035/FR-044).', { blockers })
    }
    const [blockers] = await Promise.all([resourceBlockers(companyId, trip.vehicleId, trip.driverId)])
    if (blockers.length) return jsonError(400, 'Bloqueios de segurança/documentação activos.', { blockers })
    const updated = await db.trip.update({ where: { id: trip.id }, data: { status: 'AUTHORIZED_DEPARTURE' } })
    await auditAct({ status: updated.status })
    await recomputeVehicleState(trip.vehicleId)
    return jsonOk({ trip: updated })
  }

  // -------- partida (FR-036: hora + localização + quilometragem) --------
  if (body.action === 'depart') {
    const t = transitionAllowed(trip.status, 'IN_TRANSIT')
    if (!t.ok) return jsonError(409, t.reason!)
    if (trip.status !== 'AUTHORIZED_DEPARTURE') return jsonError(409, 'Viagem não autorizada para partida.')
    if (body.departureOdometerKm === undefined) return jsonError(400, 'Registe a quilometragem de partida (FR-015).')
    const odo = Number(body.departureOdometerKm)
    if (odo < trip.vehicle.odometerKm)
      return jsonError(400, `Quilometragem de partida (${odo}) inferior à registada no veículo (${trip.vehicle.odometerKm}) — FR-015.`)

    const updated = await db.$transaction(async (tx) => {
      const u = await tx.trip.update({
        where: { id: trip.id },
        data: { status: 'IN_TRANSIT', departureAt: new Date(), startOdometerKm: odo },
      })
      await tx.tripEvent.create({
        data: {
          companyId, tripId: trip.id, type: 'DEPARTURE',
          lat: body.lat ?? null, lng: body.lng ?? null,
          deviceTime: new Date(),
          authorUserId: ctx.user.id, authorLabel: ctx.user.name,
          clientUuid: `server-depart-${trip.id}`,
          note: body.note || `Partida registada com ${odo} km.`,
        },
      })
      return u
    })
    await db.vehicle.update({ where: { id: trip.vehicleId }, data: { odometerKm: odo } })
    await auditAct({ status: updated.status, departureOdometerKm: odo })
    await recomputeVehicleState(trip.vehicleId)
    return jsonOk({ trip: updated })
  }

  // -------- pausa / retoma --------
  if (body.action === 'pause' || body.action === 'resume') {
    const to = body.action === 'pause' ? 'PAUSED' : 'IN_TRANSIT'
    const t = transitionAllowed(trip.status, to)
    if (!t.ok) return jsonError(409, t.reason!)
    if (body.action === 'pause' && !body.reason) return jsonError(400, 'Motivo da paragem é obrigatório (§5.1: motivo, local, previsão).')
    const updated = await db.$transaction(async (tx) => {
      const u = await tx.trip.update({ where: { id: trip.id }, data: { status: to } })
      await tx.tripEvent.create({
        data: {
          companyId, tripId: trip.id, type: body.action === 'pause' ? 'PAUSE_START' : 'PAUSE_END',
          lat: body.lat ?? null, lng: body.lng ?? null, deviceTime: new Date(),
          authorUserId: ctx.user.id, authorLabel: ctx.user.name, clientUuid: `server-${body.action}-${trip.id}-${Date.now()}`,
          note: body.reason || body.note || null,
        },
      })
      return u
    })
    await auditAct({ status: updated.status }, body.reason)
    return jsonOk({ trip: updated })
  }

  // -------- chegada (valida POD e quilometragem final — FR-038) --------
  if (body.action === 'arrive') {
    const t = transitionAllowed(trip.status, 'ARRIVED')
    if (!t.ok) return jsonError(409, t.reason!)
    const odo = body.arrivalOdometerKm !== undefined ? Number(body.arrivalOdometerKm) : null
    if (odo !== null && trip.startOdometerKm != null && odo < trip.startOdometerKm)
      return jsonError(400, `Quilometragem de chegada (${odo}) inferior à de partida (${trip.startOdometerKm}) — FR-015.`)
    const updated = await db.$transaction(async (tx) => {
      const u = await tx.trip.update({
        where: { id: trip.id },
        data: { status: 'ARRIVED', arrivalAt: new Date(), ...(odo !== null ? { endOdometerKm: odo } : {}) },
      })
      await tx.tripEvent.create({
        data: {
          companyId, tripId: trip.id, type: 'ARRIVAL',
          lat: body.lat ?? null, lng: body.lng ?? null, deviceTime: new Date(),
          authorUserId: ctx.user.id, authorLabel: ctx.user.name, clientUuid: `server-arrive-${trip.id}-${Date.now()}`,
          note: body.note || 'Chegada registada.',
        },
      })
      return u
    })
    if (odo !== null) await db.vehicle.update({ where: { id: trip.vehicleId }, data: { odometerKm: odo } })
    await auditAct({ status: updated.status, arrivalOdometerKm: odo })
    await recomputeVehicleState(trip.vehicleId)
    return jsonOk({ trip: updated })
  }

  // -------- pedido de fecho: lista pendências (FR-038, AT-023) --------
  if (body.action === 'request_close') {
    const t = transitionAllowed(trip.status, 'AWAITING_RECONCILIATION')
    if (!t.ok) return jsonError(409, t.reason!)
    const reconciliation = await reconcileTrip(companyId, trip.id)
    const pendingCritical: string[] = []
    if (trip.endOdometerKm == null) pendingCritical.push('Quilometragem final em falta.')
    if (reconciliation.pendingExpenses > 0) pendingCritical.push(`${reconciliation.pendingExpenses} despesas ainda pendentes de decisão.`)
    if (!trip.podAttachmentId) pendingCritical.push('Prova de entrega (POD) não anexada — se aplicável à operação.')
    const updated = await db.trip.update({
      where: { id: trip.id },
      data: { status: 'AWAITING_RECONCILIATION', closeBlockers: JSON.stringify(pendingCritical) },
    })
    await auditAct({ status: updated.status, pendingCritical })
    return jsonOk({ trip: updated, reconciliation, pendingCritical })
  }

  // -------- fecho (operacional + financeiro, AT-023) --------
  if (body.action === 'close') {
    const t = transitionAllowed(trip.status, 'CLOSED')
    if (!t.ok) return jsonError(409, t.reason!)
    const reconciliation = await reconcileTrip(companyId, trip.id)
    const pending = JSON.parse((trip.closeBlockers ?? '[]') as string) as string[]
    const critical = pending.filter((p) => !p.includes('POD')) // POD é bloqueante apenas quando configurado
    if (critical.length > 0 && !body.force)
      return jsonError(400, 'Existem pendências críticas — fecho bloqueado (AT-023).', { pending: critical })
    if (critical.length > 0 && body.force && ctx.user.role !== 'FINANCE' && ctx.user.role !== 'COMPANY_ADMIN' && ctx.user.role !== 'PLATFORM_ADMIN')
      return jsonError(403, 'Só finanças/administração pode fechar com pendências excepcionadas (regra controlada documentada).')
    const updated = await db.trip.update({
      where: { id: trip.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    })
    // marca despesas aprovadas como reconciliadas
    await db.expense.updateMany({ where: { tripId: trip.id, status: 'APPROVED' }, data: { status: 'RECONCILED' } })
    await auditAct({ status: updated.status, force: Boolean(body.force) }, body.reason)
    await recomputeVehicleState(trip.vehicleId)
    return jsonOk({ trip: updated, reconciliation })
  }

  // -------- reabertura autorizada e auditada (§5.1) --------
  if (body.action === 'reopen') {
    if (!['CLOSED', 'CANCELLED'].includes(trip.status)) return jsonError(409, 'Só viagens fechadas/canceladas podem ser reabertas.')
    if (!['FINANCE', 'COMPANY_ADMIN', 'PLATFORM_ADMIN'].includes(ctx.user.role))
      return jsonError(403, 'Reabertura exige utilizador autorizado (§5.1).')
    if (!body.reason) return jsonError(400, 'Motivo da reabertura é obrigatório e ficará em auditoria.')
    const updated = await db.trip.update({ where: { id: trip.id }, data: { status: 'AWAITING_RECONCILIATION' } })
    await auditAct({ status: updated.status }, body.reason)
    await recomputeVehicleState(trip.vehicleId)
    return jsonOk({ trip: updated })
  }

  // -------- cancelamento --------
  if (body.action === 'cancel') {
    const t = transitionAllowed(trip.status, 'CANCELLED')
    if (!t.ok) return jsonError(409, t.reason!)
    if (!body.reason) return jsonError(400, 'Motivo do cancelamento é obrigatório (§5.1).')
    const updated = await db.trip.update({
      where: { id: trip.id },
      data: { status: 'CANCELLED', cancelReason: body.reason, cancelCostsMinor: body.note ? undefined : 0 },
    })
    await auditAct({ status: updated.status, reason: body.reason }, body.reason)
    await recomputeVehicleState(trip.vehicleId)
    return jsonOk({ trip: updated })
  }

  return jsonError(400, `Acção desconhecida: ${body.action}`)
}, { anyPerm: ['trip.manage', 'trip.close'] })
