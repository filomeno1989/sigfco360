// SIGFCO - Notificações in-app (inbox; canais externos ficam pendentes de
// fornecedor -,) e auditoria
import { withAuth, jsonOk, readJson, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const notifications = await db.notification.findMany({
    where: { companyId, OR: [{ userId: ctx.user.id }, { userId: null }] },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return jsonOk({ notifications, unread: notifications.filter((n) => !n.readAt).length })
})

export const PATCH = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<{ id?: string; all?: boolean }>(req)
  if (b.all) {
    await db.notification.updateMany({
      where: { companyId, OR: [{ userId: ctx.user.id }, { userId: null }], readAt: null },
      data: { readAt: new Date() },
    })
    return jsonOk({ ok: true })
  }
  if (b.id) await db.notification.updateMany({ where: { id: b.id, companyId }, data: { readAt: new Date() } })
  return jsonOk({ ok: true })
})
