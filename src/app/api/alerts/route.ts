// SIGFCO - Alertas: fila por gravidade, reconhecer/encerrar com motivo
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const sp = req.nextUrl.searchParams
  const estado = sp.get('status')
  const gravidade = sp.get('severity')
  const alerts = await db.alert.findMany({
    where: {
      companyId,
      ...(estado ? { status: estado } : {}),
      ...(gravidade ? { severity: gravidade } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return jsonOk({ alerts })
}, { perm: 'alert.handle' })

export const PATCH = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<{ id: string; action: 'ack' | 'close'; reason?: string }>(req)
  const alert = await db.alert.findUnique({ where: { id: b.id } })
  if (!alert || alert.companyId !== companyId) return jsonError(404, 'Alerta não encontrado.')

  if (b.action === 'ack') {
    const updated = await db.alert.update({
      where: { id: alert.id },
      data: { status: 'ACK', ackById: ctx.user.id, ackAt: new Date() },
    })
    await audit({ req, ctx, companyId, action: 'ALERT_ACK', entity: 'Alert', entityId: alert.id, after: { title: alert.title } })
    return jsonOk({ alert: updated })
  }
  // HIGH/CRITICAL exigem motivo para encerrar
  if (['CRITICAL', 'HIGH'].includes(alert.severity) && !b.reason)
    return jsonError(400, 'Encerrar alerta de gravidade alta/crítica exige motivo.')
  const updated = await db.alert.update({
    where: { id: alert.id },
    data: { status: 'CLOSED', closeReason: b.reason, closedById: ctx.user.id, closedAt: new Date() },
  })
  await audit({ req, ctx, companyId, action: 'ALERT_CLOSE', entity: 'Alert', entityId: alert.id, reason: b.reason, after: { title: alert.title } })
  return jsonOk({ alert: updated })
}, { perm: 'alert.handle' })
