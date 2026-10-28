// SIGFCO — Templates de checklist (FR-043): configuráveis por empresa;
// itens sistémicos do carregador/suporte/GPS não removíveis (§6.5)
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'
import { ensureSystemChecklistItems } from '@/lib/viagem'

export const dynamic = 'force-dynamic'

type Item = { key: string; label: string; blocking: boolean; category?: string }

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const templates = await db.checklistTemplate.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } })
  return jsonOk({ templates })
}, { anyPerm: ['fleet.read', 'trip.read'] })

export const POST = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<{ name: string; items: Item[] }>(req)
  const items = ensureSystemChecklistItems(b.items || []) // carregador + suporte + GPS garantidos
  const template = await db.checklistTemplate.create({
    data: { companyId, name: b.name || 'Checklist padrão', itemsJson: JSON.stringify(items), active: true },
  })
  await audit({ req, ctx, companyId, action: 'CREATE', entity: 'ChecklistTemplate', entityId: template.id, after: { name: template.name, itemCount: items.length } })
  return jsonOk({ template })
}, { perm: 'fleet.manage' })

export const PATCH = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<{ id: string; name?: string; active?: boolean; items?: Item[] }>(req)
  const template = await db.checklistTemplate.findUnique({ where: { id: b.id } })
  if (!template || template.companyId !== companyId) return jsonError(404, 'Template não encontrado.')
  const data: Record<string, unknown> = {}
  if (b.name) data.name = b.name
  if (b.active !== undefined) data.active = b.active
  if (b.items) data.itemsJson = JSON.stringify(ensureSystemChecklistItems(b.items))
  const updated = await db.checklistTemplate.update({ where: { id: template.id }, data })
  await audit({ req, ctx, companyId, action: 'UPDATE', entity: 'ChecklistTemplate', entityId: template.id, before: template, after: updated })
  return jsonOk({ template: updated })
}, { perm: 'fleet.manage' })
