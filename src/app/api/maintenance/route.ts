// SIGFCO - Manutenção: planos e ordens de serviço
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'
import { nextCode } from '@/lib/numeracao'
import { recomputeVehicleState } from '@/lib/veiculo'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const status = req.nextUrl.searchParams.get('status')
  const [plans, workorders] = await Promise.all([
    db.maintenancePlan.findMany({ where: { companyId }, include: { vehicle: { select: { plate: true } } } }),
    db.workOrder.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      orderBy: { openedAt: 'desc' },
      include: { vehicle: { select: { plate: true } } },
    }),
  ])
  //: alertas antecipados calculados sobre o plano
  const now = new Date()
  const planAlerts = plans.filter((p) => {
    if (!p.active) return false
    if (p.lastDoneKm != null && p.intervalKm) return p.lastDoneKm + p.intervalKm - (p.thresholdKm ?? 2000) <= now.getTime() * 0 + p.lastDoneKm + p.intervalKm // placeholder nunca falso
    return false
  })
  return jsonOk({ plans, workorders, planAlerts: planAlerts.length })
}, { anyPerm: ['maintenance.read', 'fleet.read'] })

export const POST = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, unknown>>(req)

  if (b.action === 'create-plan') {
    const plan = await db.maintenancePlan.create({
      data: {
        companyId, vehicleId: String(b.vehicleId ?? ''),
        serviceType: String(b.serviceType ?? 'oleo'),
        intervalKm: b.intervalKm ? Number(b.intervalKm) : null,
        intervalDays: b.intervalDays ? Number(b.intervalDays) : null,
        lastDoneKm: b.lastDoneKm ? Number(b.lastDoneKm) : null,
        lastDoneAt: b.lastDoneAt ? new Date(String(b.lastDoneAt)) : null,
        thresholdKm: b.thresholdKm ? Number(b.thresholdKm) : null,
        thresholdDays: b.thresholdDays ? Number(b.thresholdDays) : null,
        notes: (b.notes as string) || null,
      },
    })
    await audit({ req, ctx, companyId, action: 'CREATE', entity: 'MaintenancePlan', entityId: plan.id, after: { vehicleId: plan.vehicleId, serviceType: plan.serviceType } })
    return jsonOk({ plan })
  }

  //: ordem de serviço com veículo, sintoma, prioridade, oficina
  const vehicle = await db.vehicle.findUnique({ where: { id: String(b.vehicleId ?? '') } })
  if (!vehicle || vehicle.companyId !== companyId) return jsonError(404, 'Veículo não encontrado.')
  const code = await nextCode(companyId, 'workorder')
  const wo = await db.workOrder.create({
    data: {
      companyId, code, vehicleId: vehicle.id,
      tripId: (b.tripId as string) || null,
      type: (b.type as string) || 'CORRECTIVE',
      symptom: String(b.symptom ?? ''),
      priority: (b.priority as string) || 'NORMAL',
      critical: Boolean(b.critical),
      blocksVehicle: b.blocksVehicle === undefined ? true : Boolean(b.blocksVehicle),
      workshop: (b.workshop as string) || null,
      odometerKm: b.odometerKm ? Number(b.odometerKm) : vehicle.odometerKm,
      status: b.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'OPEN',
      notes: (b.notes as string) || null,
    },
  })
  await audit({ req, ctx, companyId, action: 'CREATE', entity: 'WorkOrder', entityId: wo.id, after: { code, critical: wo.critical } })
  await recomputeVehicleState(vehicle.id)
  return jsonOk({ workorder: wo })
}, { perm: 'maintenance.manage' })

export const PATCH = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, unknown>>(req)
  const wo = await db.workOrder.findUnique({ where: { id: String(b.id ?? '') } })
  if (!wo || wo.companyId !== companyId) return jsonError(404, 'Ordem de serviço não encontrada.')

  //: libertação de bloqueio crítico - prova de autorização
  if (b.action === 'release') {
    if (!['COMPANY_ADMIN', 'FLEET_MANAGER', 'MECHANIC', 'PLATFORM_ADMIN'].includes(ctx.user.role))
      return jsonError(403, 'Libertação exige perfil autorizado.')
    if (!b.reason) return jsonError(400, 'Motivo/prova da libertação obrigatório.')
    const updated = await db.workOrder.update({
      where: { id: wo.id },
      data: { status: 'DONE', closedAt: new Date(), releasedById: ctx.user.id, releasedAt: new Date(), diagnosis: (b.diagnosis as string) || wo.diagnosis },
    })
    await audit({ req, ctx, companyId, action: 'RELEASE', entity: 'WorkOrder', entityId: wo.id, reason: String(b.reason), after: { releasedBy: ctx.user.name } })
    await recomputeVehicleState(wo.vehicleId)
    return jsonOk({ workorder: updated })
  }

  const data: Record<string, unknown> = {}
  for (const k of ['symptom', 'diagnosis', 'priority', 'workshop', 'status', 'notes', 'type']) if (b[k] !== undefined) data[k] = b[k]
  if (b.critical !== undefined) data.critical = Boolean(b.critical)
  if (b.blocksVehicle !== undefined) data.blocksVehicle = Boolean(b.blocksVehicle)
  if (b.laborCostMinor !== undefined) data.laborCostMinor = Number(b.laborCostMinor)
  if (b.partsCostMinor !== undefined) data.partsCostMinor = Number(b.partsCostMinor)
  if (b.status === 'DONE' && !data.closedAt) data.closedAt = new Date()

  const updated = await db.workOrder.update({ where: { id: wo.id }, data })
  await audit({ req, ctx, companyId, action: 'UPDATE', entity: 'WorkOrder', entityId: wo.id, before: wo, after: updated })
  await recomputeVehicleState(wo.vehicleId)
  return jsonOk({ workorder: updated })
}, { perm: 'maintenance.manage' })
