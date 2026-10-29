// SIGFCO - Motoristas: ficha, elegibilidade, histórico restrito
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'
import { recomputeVehicleState } from '@/lib/veiculo'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const q = req.nextUrl.searchParams.get('q')
  const status = req.nextUrl.searchParams.get('status')
  const drivers = await db.driver.findMany({
    where: {
      companyId,
      ...(status ? { status } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }, { phone: { contains: q } }] } : {}),
    },
    orderBy: { name: 'asc' },
  })
  const now = new Date()
  const withEligibility = drivers.map((d) => ({
    ...d,
    licenseExpired: d.licenseExpiry ? d.licenseExpiry < now : null,
    eligible: d.status === 'ACTIVE' && (!d.licenseExpiry || d.licenseExpiry >= now),
  }))
  return jsonOk({ drivers: withEligibility })
}, { anyPerm: ['fleet.read', 'trip.read'] })

export const POST = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, string>>(req)
  if (!b.name?.trim()) return jsonError(400, 'O nome é obrigatório.')
  const code = (b.code?.trim() || `MTR-${Date.now().toString(36).toUpperCase()}`).toUpperCase()
  if (await db.driver.findUnique({ where: { companyId_code: { companyId, code } } }))
    return jsonError(409, `Código interno ${code} já existe.`)
  const driver = await db.driver.create({
    data: {
      companyId, code, name: b.name.trim(),
      phone: b.phone || null,
      emergencyContact: b.emergencyContact || null, //: apenas quando autorizado
      licenseNumber: b.licenseNumber || null,
      licenseCategory: b.licenseCategory || null,
      licenseExpiry: b.licenseExpiry ? new Date(b.licenseExpiry) : null,
      licenseCountry: b.licenseCountry || null,
      status: b.status || 'ACTIVE',
      notes: b.notes || null,
    },
  })
  await audit({ req, ctx, companyId, action: 'CREATE', entity: 'Driver', entityId: driver.id, after: { code, name: driver.name } })
  return jsonOk({ driver })
}, { perm: 'fleet.manage' })

export const PATCH = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, unknown>>(req)
  const driver = await db.driver.findUnique({ where: { id: String(b.id) } })
  if (!driver || driver.companyId !== companyId) return jsonError(404, 'Motorista não encontrado.')
  const data: Record<string, unknown> = {}
  for (const k of ['name', 'phone', 'emergencyContact', 'licenseNumber', 'licenseCategory', 'licenseCountry', 'status', 'notes'])
    if (b[k] !== undefined) data[k] = b[k] === '' ? null : b[k]
  if (b.licenseExpiry !== undefined) data.licenseExpiry = b.licenseExpiry ? new Date(String(b.licenseExpiry)) : null
  const updated = await db.driver.update({ where: { id: driver.id }, data })
  await audit({ req, ctx, companyId, action: 'UPDATE', entity: 'Driver', entityId: driver.id, before: driver, after: updated })

  // alteração de estado laboral pode afectar veículos em viagem? apenas registo
  return jsonOk({ driver: updated })
}, { perm: 'fleet.manage' })
