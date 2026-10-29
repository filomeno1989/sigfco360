// SIGFCO - Acções de despesa: aprovar/rejeitar/devolver/rever/anular
// Rejeição exige motivo + categoria; aprovada não se altera
// em silêncio - correcção por estorno/reclassificação
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export const POST = withAuth(async ({ ctx, req, params }) => {
  const companyId = scopeCompanyId(ctx, req)
  const expense = await db.expense.findUnique({ where: { id: params.id }, include: { trip: true } })
  if (!expense || expense.companyId !== companyId) return jsonError(404, 'Despesa não encontrada.')

  const body = await readJson<{ action: string; reason?: string; rejectCategory?: string }>(req)
  const actorIsAuthor = expense.authorUserId === ctx.user.id

  //: ninguém aprova as próprias despesas (segregação de funções)
  const approving = ['approve', 'reject', 'return']
  if (approving.includes(body.action) && actorIsAuthor)
    return jsonError(403, 'Não pode aprovar/rejeitar a sua própria despesa (segregação de funções).')
  if (approving.includes(body.action) && !['FINANCE', 'COMPANY_ADMIN', 'PLATFORM_ADMIN', 'FLEET_MANAGER'].includes(ctx.user.role))
    return jsonError(403, 'Aprovação restrita a perfis financeiros/gestão.')

  if (body.action === 'approve') {
    if (!['SUBMITTED', 'IN_REVIEW', 'RETURNED'].includes(expense.status)) return jsonError(409, `Estado actual ${expense.status} não permite aprovação.`)
    const updated = await db.expense.update({ where: { id: expense.id }, data: { status: 'APPROVED' } })
    await audit({ req, ctx, companyId, action: 'APPROVE', entity: 'Expense', entityId: expense.id, before: { status: expense.status }, after: { status: 'APPROVED' } })
    await db.notification.create({ data: { companyId, userId: expense.authorUserId, severity: 'INFO', title: `Despesa ${expense.code} aprovada`, body: 'A sua despesa foi aprovada.', channel: 'IN_APP', deliveryStatus: 'SENT', refType: 'EXPENSE', refId: expense.id } })
    return jsonOk({ expense: updated })
  }

  if (body.action === 'reject' || body.action === 'return') {
    if (!['SUBMITTED', 'IN_REVIEW', 'RETURNED', 'APPROVED'].includes(expense.status)) return jsonError(409, 'Estado não permite esta decisão.')
    if (!body.reason || body.reason.length < 8) return jsonError(400, 'Motivo obrigatório com pelo menos 8 caracteres.')
    if (!body.rejectCategory) return jsonError(400, 'Categoria do motivo é obrigatória.')
    const status = body.action === 'reject' ? 'REJECTED' : 'RETURNED'
    const updated = await db.expense.update({
      where: { id: expense.id },
      data: { status, rejectReason: body.reason, rejectCategory: body.rejectCategory },
    })
    await audit({ req, ctx, companyId, action: body.action.toUpperCase(), entity: 'Expense', entityId: expense.id, before: { status: expense.status }, after: { status, reason: body.reason } })
    await db.notification.create({ data: { companyId, userId: expense.authorUserId, severity: 'MEDIUM', title: `Despesa ${expense.code} ${body.action === 'reject' ? 'rejeitada' : 'devolvida'}`, body: `Motivo: ${body.reason}`, channel: 'IN_APP', deliveryStatus: 'SENT', refType: 'EXPENSE', refId: expense.id } })
    return jsonOk({ expense: updated })
  }

  if (body.action === 'review') {
    if (expense.status !== 'SUBMITTED') return jsonError(409, 'Só despesas submetidas entram em revisão.')
    const updated = await db.expense.update({ where: { id: expense.id }, data: { status: 'IN_REVIEW' } })
    await audit({ req, ctx, companyId, action: 'REVIEW', entity: 'Expense', entityId: expense.id, after: { status: 'IN_REVIEW' } })
    return jsonOk({ expense: updated })
  }

  if (body.action === 'void') {
    if (!['FINANCE', 'COMPANY_ADMIN', 'PLATFORM_ADMIN'].includes(ctx.user.role))
      return jsonError(403, 'Anulamento restrito a finanças/administração.')
    if (!body.reason) return jsonError(400, 'Motivo do anulamento obrigatório.')
    if (['VOID', 'RECONCILED'].includes(expense.status)) return jsonError(409, 'Estado não permite anulamento.')
    const updated = await db.expense.update({
      where: { id: expense.id },
      data: { status: 'VOID', voidReason: body.reason, voidedById: ctx.user.id, voidedAt: new Date() },
    })
    await audit({ req, ctx, companyId, action: 'VOID', entity: 'Expense', entityId: expense.id, before: { status: expense.status }, after: { status: 'VOID', reason: body.reason } })
    return jsonOk({ expense: updated })
  }

  if (body.action === 'clear-duplicate-flag') {
    const updated = await db.expense.update({ where: { id: expense.id }, data: { duplicateFlag: null, duplicateOfId: null } })
    await audit({ req, ctx, companyId, action: 'DUPLICATE_REVIEWED', entity: 'Expense', entityId: expense.id, reason: body.reason })
    return jsonOk({ expense: updated })
  }

  return jsonError(400, `Acção desconhecida: ${body.action}`)
}, { perm: 'expense.approve' })
