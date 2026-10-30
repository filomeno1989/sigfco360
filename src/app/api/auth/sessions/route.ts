// SIGFCO - Sessões activas e revogação de dispositivos
import { withAuth, jsonOk, jsonError, readJson, audit } from '@/lib/api'
import { revokeAllSessions } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const targetUserId = req.nextUrl.searchParams.get('userId') || ctx.user.id
  if (targetUserId !== ctx.user.id && ctx.user.role !== 'COMPANY_ADMIN' && ctx.user.role !== 'PLATFORM_ADMIN')
    return jsonError(403, 'Sem permissão para ver sessões de outros utilizadores.')
  // Importante: a consulta tem de ser resolvida com await antes de responder;
  // sem await, o cliente recebe a Promise serializada e a interface quebra.
  const sessions = await db.session.findMany({
    where: { userId: targetUserId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: 'desc' },
    select: { id: true, device: true, ip: true, createdAt: true, lastSeenAt: true, expiresAt: true },
  })
  return jsonOk({ sessions, currentId: ctx.session.id })
})

export const POST = withAuth(async ({ ctx, req }) => {
  const body = await readJson<{ userId?: string; all?: boolean }>(req)
  const target = body.userId || ctx.user.id
  if (target !== ctx.user.id && !['COMPANY_ADMIN', 'PLATFORM_ADMIN'].includes(ctx.user.role))
    return jsonError(403, 'Sem permissão para revogar sessões de outros utilizadores.')
  const count = await revokeAllSessions(target, target === ctx.user.id ? ctx.session.id : undefined)
  await audit({ req, ctx, action: 'REVOKE_SESSIONS', entity: 'User', entityId: target, after: { revoked: count } })
  return jsonOk({ revoked: count })
})
