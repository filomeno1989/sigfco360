// SIGFCO — Dispositivos GPS (GPS-001, GPS-006, GPS-008, §4.1)
// Credenciais por dispositivo com rotação; associação com histórico.
import crypto from 'crypto'
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

function newApiKey() {
  return 'gps_' + crypto.randomBytes(24).toString('hex')
}

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const devices = await db.gpsDevice.findMany({ where: { companyId }, orderBy: { serial: 'asc' } })
  const assignments = await db.deviceAssignment.findMany({ where: { companyId }, orderBy: { fromAt: 'desc' }, take: 200 })
  const withVehicle = await Promise.all(devices.map(async (d) => {
    const vehicle = d.vehicleId ? await db.vehicle.findUnique({ where: { id: d.vehicleId } }) : null
    return { ...d, apiKey: undefined as unknown as string, hasApiKey: true, vehicle: vehicle && { id: vehicle.id, plate: vehicle.plate } }
  }))
  return jsonOk({ devices: withVehicle, assignments })
}, { perm: 'gps.view' })

export const POST = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, unknown>>(req)
  const serial = String(b.serial ?? '').trim()
  if (!serial) return jsonError(400, 'Número de série/IMEI obrigatório (GPS-001).')
  if (await db.gpsDevice.findUnique({ where: { companyId_serial: { companyId, serial } } }))
    return jsonError(409, `Dispositivo ${serial} já registado.`)
  const device = await db.gpsDevice.create({
    data: {
      companyId, serial,
      imei: (b.imei as string) || null,
      vendor: (b.vendor as string) || null,
      protocol: (b.protocol as string) || 'generic-json',
      simNumber: (b.simNumber as string) || null,
      model: (b.model as string) || null,
      status: (b.status as string) || 'INACTIVE',
      apiKey: newApiKey(),
      installedAt: b.installedAt ? new Date(String(b.installedAt)) : null,
      installedBy: (b.installedBy as string) || null,
      notes: (b.notes as string) || null,
    },
  })
  await audit({ req, ctx, companyId, action: 'CREATE', entity: 'GpsDevice', entityId: device.id, after: { serial } })
  return jsonOk({ device: { ...device, apiKey: device.apiKey } }) // chave revelada uma vez ao gestor
}, { perm: 'gps.manage' })

export const PATCH = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, unknown>>(req)
  const device = await db.gpsDevice.findUnique({ where: { id: String(b.id) } })
  if (!device || device.companyId !== companyId) return jsonError(404, 'Dispositivo não encontrado.')

  // Acções críticas geram auditoria (§4.1)
  if (b.action === 'rotate-key') {
    const key = newApiKey()
    await db.gpsDevice.update({ where: { id: device.id }, data: { apiKey: key } })
    await audit({ req, ctx, companyId, action: 'ROTATE_KEY', entity: 'GpsDevice', entityId: device.id })
    return jsonOk({ apiKey: key, note: 'Guarde a nova chave com segurança — não será mostrada novamente em listagens.' })
  }

  if (b.action === 'assign') {
    const vehicleId = String(b.vehicleId ?? '')
    const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId } })
    if (!vehicle || vehicle.companyId !== companyId) return jsonError(404, 'Veículo não encontrado.')
    // histórico temporal da associação (§13.1)
    await db.deviceAssignment.updateMany({ where: { deviceId: device.id, toAt: null }, data: { toAt: new Date() } })
    await db.deviceAssignment.create({ data: { companyId, deviceId: device.id, vehicleId, note: (b.note as string) || null } })
    const updated = await db.gpsDevice.update({ where: { id: device.id }, data: { vehicleId } })
    await audit({ req, ctx, companyId, action: 'ASSIGN', entity: 'GpsDevice', entityId: device.id, before: { vehicleId: device.vehicleId }, after: { vehicleId } })
    return jsonOk({ device: updated })
  }

  const data: Record<string, unknown> = {}
  for (const k of ['status', 'statusDetail', 'vendor', 'protocol', 'simNumber', 'model', 'notes'])
    if (b[k] !== undefined) data[k] = b[k] === '' ? null : b[k]
  if (b.configJson !== undefined) data.configJson = b.configJson ? JSON.stringify(b.configJson) : null
  if (b.deactivate) { data.vehicleId = null; data.status = 'INACTIVE' }
  const updated = await db.gpsDevice.update({ where: { id: device.id }, data })
  await audit({ req, ctx, companyId, action: 'UPDATE', entity: 'GpsDevice', entityId: device.id, before: { status: device.status, config: device.configJson }, after: data })
  return jsonOk({ device: { ...updated, apiKey: undefined } })
}, { perm: 'gps.manage' })
