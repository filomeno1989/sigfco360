// SIGFCO - Trilha de auditoria: consulta com filtros;
// exportação sensível também auditada
import { withAuth, jsonOk, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const sp = req.nextUrl.searchParams
  const page = Math.max(1, Number(sp.get('page') ?? 1))
  const pageSize = 50
  const where = {
    companyId,
    ...(sp.get('entity') ? { entity: { contains: sp.get('entity')! } } : {}),
    ...(sp.get('action') ? { action: { contains: sp.get('action')! } } : {}),
    ...(sp.get('userId') ? { userId: sp.get('userId') } : {}),
    ...(sp.get('from') ? { createdAt: { gte: new Date(sp.get('from')!), lte: sp.get('to') ? new Date(sp.get('to')!) : new Date() } } : {}),
  }
  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
  ])
  await audit({ req, ctx, companyId, action: 'AUDIT_VIEW', entity: 'AuditLog', after: { page } })
  return jsonOk({ logs, total, page, pageSize })
}, { perm: 'audit.read' })
