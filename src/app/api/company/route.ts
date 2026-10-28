// SIGFCO — Empresa e parâmetros (FR-001/002/003, §4.1)
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'
import { getSettings, setSetting } from '@/lib/numeracao'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const company = await db.company.findUnique({ where: { id: companyId }, include: { branches: true } })
  const settings = await getSettings(companyId)
  return jsonOk({ company, settings })
}, { perm: 'company.read' })

export const PATCH = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const body = await readJson<{ company?: Record<string, unknown>; settings?: Record<string, unknown> }>(req)
  const before = await db.company.findUnique({ where: { id: companyId } })

  if (body.company) {
    const allowed = ['name', 'legalName', 'nuit', 'address', 'phone', 'email', 'logoUrl', 'currencyBase', 'timezone', 'locale', 'active']
    const data: Record<string, unknown> = {}
    for (const k of allowed) if (k in body.company) data[k] = body.company[k]
    await db.company.update({ where: { id: companyId }, data })
    await audit({ req, ctx, companyId, action: 'UPDATE', entity: 'Company', entityId: companyId, before, after: data })
  }
  if (body.settings) {
    for (const [k, v] of Object.entries(body.settings)) await setSetting(companyId, k, v)
    await audit({ req, ctx, companyId, action: 'UPDATE_SETTINGS', entity: 'Setting', after: body.settings })
  }
  return jsonOk({ ok: true })
}, { anyPerm: ['company.manage', 'settings.manage'] })

// ------------------------- Filiais -----------------------------------
export const POST = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const body = await readJson<{ action: string } & Record<string, unknown>>(req)
  if (body.action === 'create-branch') {
    const b = await db.branch.create({
      data: { companyId, name: String(body.name), address: body.address ? String(body.address) : null, lat: body.lat as number ?? null, lng: body.lng as number ?? null },
    })
    await audit({ req, ctx, companyId, action: 'CREATE', entity: 'Branch', entityId: b.id, after: b })
    return jsonOk({ branch: b })
  }
  if (body.action === 'update-branch') {
    const id = String(body.id)
    const existing = await db.branch.findUnique({ where: { id } })
    if (!existing || existing.companyId !== companyId) return jsonError(404, 'Filial não encontrada.')
    const b = await db.branch.update({ where: { id }, data: {
      name: body.name !== undefined ? String(body.name) : undefined,
      address: body.address !== undefined ? String(body.address) : undefined,
      active: body.active !== undefined ? Boolean(body.active) : undefined,
    } })
    await audit({ req, ctx, companyId, action: 'UPDATE', entity: 'Branch', entityId: id, before: existing, after: b })
    return jsonOk({ branch: b })
  }
  return jsonError(400, 'Acção desconhecida.')
}, { perm: 'company.manage' })
