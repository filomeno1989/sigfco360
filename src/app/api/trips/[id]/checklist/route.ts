// =====================================================================
// SIGFCO — Checklist pré-partida (§6.5 — REQUISITO CRÍTICO do carregador)
// O item "carregador de telemóvel funcional" é bloqueante e sistémico:
// não pode ser removido pelo cliente e falha → partida bloqueada (AT-003).
// Motorista submete; despacho/gestor autorizam (FR-035, sem bypass FR-044).
// =====================================================================
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'
import { checklistBlockers, ensureSystemChecklistItems } from '@/lib/viagem'
import { CHARGER_ITEM_KEY } from '@/lib/constantes'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req, params }) => {
  const companyId = scopeCompanyId(ctx, req)
  const trip = await db.trip.findUnique({ where: { id: params.id }, include: { checklist: true } })
  if (!trip || trip.companyId !== companyId) return jsonError(404, 'Viagem não encontrada.')
  if (ctx.user.role === 'DRIVER' && ctx.user.driverId !== trip.driverId) return jsonError(403, 'Só a checklist da sua viagem.')
  return jsonOk({ checklist: trip.checklist })
}, { anyPerm: ['trip.read', 'trip.own', 'checklist.submit'] })

export const POST = withAuth(async ({ ctx, req, params }) => {
  const companyId = scopeCompanyId(ctx, req)
  const trip = await db.trip.findUnique({ where: { id: params.id }, include: { checklist: true } })
  if (!trip || trip.companyId !== companyId) return jsonError(404, 'Viagem não encontrada.')

  const body = await readJson<{ items: Array<{ key: string; ok: boolean; note?: string }> }>(req)
  if (!trip.checklist) return jsonError(400, 'Checklist ainda não instanciada para esta viagem.')

  // Motorista só submete a checklist da PRÓPRIA viagem (AT-002)
  if (ctx.user.role === 'DRIVER' && ctx.user.driverId !== trip.driverId)
    return jsonError(403, 'Só pode submeter a checklist da sua própria viagem.')

  const templateItems = JSON.parse(trip.checklist.itemsJson) as Array<{ key: string; label: string; blocking: boolean; category?: string }>
  const answers = new Map(body.items.map((i) => [i.key, i]))

  // REQUISITO CRÍTICO: o item do carregador tem de ser respondido
  const chargerAnswer = answers.get(CHARGER_ITEM_KEY)
  if (!chargerAnswer) return jsonError(400, 'O item "carregador de telemóvel" tem de ser confirmado (requisito crítico §6.5).')

  const merged = templateItems.map((item) => {
    const a = answers.get(item.key)
    return { ...item, ok: a ? a.ok : undefined, note: a?.note ?? undefined }
  })

  const { blockers, passed } = checklistBlockers(JSON.stringify(merged))
  const status = passed ? 'PASSED' : 'FAILED'

  const updated = await db.checklistRun.update({
    where: { id: trip.checklist.id },
    data: { itemsJson: JSON.stringify(merged), status, blockedReason: passed ? null : blockers.join(' | '), completedById: ctx.user.id, completedAt: new Date() },
  })

  // FR-044: bloqueio registado; sem botão "continuar mesmo assim"
  await db.trip.update({
    where: { id: trip.id },
    data: status === 'FAILED' ? { status: 'AWAITING_CHECKLIST' } : {},
  })

  await audit({
    req, ctx, companyId,
    action: status === 'PASSED' ? 'CHECKLIST_PASSED' : 'CHECKLIST_BLOCKED',
    entity: 'ChecklistRun', entityId: updated.id,
    after: { status, blockers }, reason: blockers.join('; ') || undefined,
  })

  return jsonOk({ checklist: updated, blockers, passed, message: passed
    ? 'Checklist aprovada — viagem pronta para autorização de partida.'
    : `Viagem bloqueada até correcção: ${blockers.join('; ')}. Não existe continuação forçada (FR-044).` })
}, { anyPerm: ['checklist.submit', 'trip.manage'] })
