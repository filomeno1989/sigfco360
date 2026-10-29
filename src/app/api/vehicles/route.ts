// SIGFCO - Veículos: ficha, documentação, estados automáticos,
// quilometragem confiável, histórico e rastreador associado
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'
import { recomputeVehicleState } from '@/lib/veiculo'
import { expiredBlockingDocs, resourceBlockers } from '@/lib/viagem'
import { normalizePlate } from '@/lib/plate'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const id = req.nextUrl.searchParams.get('id')
  const now = new Date()

  if (id) {
    const vehicle = await db.vehicle.findUnique({ where: { id } })
    if (!vehicle || vehicle.companyId !== companyId) return jsonError(404, 'Veículo não encontrado.')
    const [docs, device, history, fuel, workorders, tires, blockers] = await Promise.all([
      db.documentItem.findMany({ where: { companyId, vehicleId: id }, orderBy: { expiresAt: 'asc' } }),
      db.gpsDevice.findFirst({ where: { companyId, vehicleId: id } }),
      db.trip.findMany({ where: { companyId, vehicleId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      db.fuelLog.findMany({ where: { companyId, vehicleId: id }, orderBy: { deviceTime: 'desc' }, take: 20 }),
      db.workOrder.findMany({ where: { companyId, vehicleId: id }, orderBy: { openedAt: 'desc' }, take: 20 }),
      db.tire.findMany({ where: { companyId, vehicleId: id } }),
      resourceBlockers(companyId, id, '___none___').catch(() => []),
    ])
    const lastPoint = device ? await db.gpsPoint.findFirst({ where: { deviceId: device.id }, orderBy: { gnssTime: 'desc' } }) : null
    return jsonOk({ vehicle, docs, device, history, fuel, workorders, tires, lastPoint, blockers })
  }

  const q = req.nextUrl.searchParams.get('q')
  const status = req.nextUrl.searchParams.get('status')
  const vehicles = await db.vehicle.findMany({
    where: { companyId, ...(status ? { status } : {}), ...(q ? { OR: [{ plate: { contains: q } }, { brand: { contains: q } }, { model: { contains: q } }, { vin: { contains: q } }] } : {}) },
    orderBy: { plate: 'asc' },
  })
  const enriched = await Promise.all(vehicles.map(async (v) => {
    const [device, docs] = await Promise.all([
      db.gpsDevice.findFirst({ where: { companyId, vehicleId: v.id } }),
      db.documentItem.findMany({ where: { companyId, vehicleId: v.id, blocking: true } }),
    ])
    const expiredDoc = docs.some((d) => d.expiresAt && d.expiresAt < now)
    return { ...v, device: device && { id: device.id, serial: device.serial, status: device.status, lastPointAt: device.lastPointAt }, expiredBlockingDoc: expiredDoc }
  }))
  return jsonOk({ vehicles: enriched })
}, { anyPerm: ['fleet.read', 'trip.read'] })

export const POST = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, unknown>>(req)
  const plate = normalizePlate(String(b.plate ?? ''))
  if (!plate) return jsonError(400, 'Matrícula obrigatória.')
  if (await db.vehicle.findUnique({ where: { companyId_plate: { companyId, plate } } }))
    return jsonError(409, `Matrícula ${plate} já registada nesta empresa.`)

  const vehicle = await db.vehicle.create({
    data: {
      companyId, plate,
      foreignPlate: (b.foreignPlate as string) || null,
      brand: (b.brand as string) || null,
      model: (b.model as string) || null,
      year: b.year ? Number(b.year) : null,
      vin: (b.vin as string) || null,
      type: (b.type as string) || 'TRUCK',
      axleConfig: (b.axleConfig as string) || null,
      cargoCapacityKg: b.cargoCapacityKg ? Number(b.cargoCapacityKg) : null,
      tankCapacityL: b.tankCapacityL ? Number(b.tankCapacityL) : null,
      fuelType: (b.fuelType as string) || 'DIESEL',
      odometerKm: b.odometerKm ? Number(b.odometerKm) : 0,
      refConsumption: b.refConsumption ? Number(b.refConsumption) : null,
      tareKg: b.tareKg ? Number(b.tareKg) : null,
      status: (b.status as string) || 'AVAILABLE',
    },
  })
  await audit({ req, ctx, companyId, action: 'CREATE', entity: 'Vehicle', entityId: vehicle.id, after: { plate } })
  return jsonOk({ vehicle })
}, { perm: 'fleet.manage' })

export const PATCH = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, unknown>>(req)
  const vehicle = await db.vehicle.findUnique({ where: { id: String(b.id) } })
  if (!vehicle || vehicle.companyId !== companyId) return jsonError(404, 'Veículo não encontrado.')

  const data: Record<string, unknown> = {}
  const fields = ['brand', 'model', 'vin', 'type', 'axleConfig', 'fuelType', 'foreignPlate']
  for (const k of fields) if (b[k] !== undefined) data[k] = b[k] === '' ? null : b[k]
  if (b.plate !== undefined) {
    const plate = normalizePlate(String(b.plate))
    if (!plate) return jsonError(400, 'Matrícula inválida.')
    const dup = await db.vehicle.findUnique({ where: { companyId_plate: { companyId, plate } } })
    if (dup && dup.id !== vehicle.id) return jsonError(409, `Matrícula ${plate} já usada por outro veículo.`)
    data.plate = plate
  }
  for (const k of ['year', 'cargoCapacityKg', 'tankCapacityL', 'odometerKm', 'refConsumption', 'tareKg'])
    if (b[k] !== undefined && b[k] !== '') data[k] = Number(b[k])

  //: quilometragem implausível → exigir justificação, não aceitar em silêncio
  if (b.odometerKm !== undefined) {
    const newOdo = Number(b.odometerKm)
    if (newOdo < vehicle.odometerKm && !b.odoReason) {
      return jsonError(400, `Quilometragem inferior à registada (${vehicle.odometerKm} km). Indique a justificação da regressão.`)
    }
    if (vehicle.odometerKm > 0 && newOdo > vehicle.odometerKm + 5000 && !b.odoReason) {
      return jsonError(400, `Salto de quilometragem invulgar (+${Math.round(newOdo - vehicle.odometerKm)} km). Indique justificação.`)
    }
    if (b.odoReason) data.stateReason = `Ajuste de odómetro justificado: ${String(b.odoReason).slice(0, 200)}`
  }

  const updated = await db.vehicle.update({ where: { id: vehicle.id }, data })
  await audit({ req, ctx, companyId, action: 'UPDATE', entity: 'Vehicle', entityId: vehicle.id, before: vehicle, after: updated, reason: b.odoReason as string })
  const state = await recomputeVehicleState(vehicle.id)
  return jsonOk({ vehicle: updated, recomputedState: state })
}, { perm: 'fleet.manage' })
