// SIGFCO - Utilizadores e permissões - isolamento por empresa
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'
import { hashPassword, passwordPolicyOk } from '@/lib/auth'
import { ROLES } from '@/lib/constantes'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const q = req.nextUrl.searchParams.get('q')
  const users = await db.user.findMany({
    where: { companyId, ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}) },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, role: true, branchId: true, driverId: true, active: true, isDemo: true, lastLoginAt: true, phone: true },
  })
  return jsonOk({ users })
}, { perm: 'user.read' })

export const POST = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const body = await readJson<{ name: string; email: string; password: string; role: string; branchId?: string; driverId?: string; phone?: string }>(req)
  if (!ROLES.includes(body.role as never)) return jsonError(400, 'Perfil inválido.')
  const policy = passwordPolicyOk(body.password)
  if (!policy.ok) return jsonError(400, policy.message!)
  const email = body.email.toLowerCase().trim()
  if (await db.user.findUnique({ where: { email } })) return jsonError(409, 'Email já registado.')

  const user = await db.user.create({
    data: {
      companyId, name: body.name.trim(), email, passwordHash: hashPassword(body.password),
      role: body.role, branchId: body.branchId || null, driverId: body.driverId || null, phone: body.phone || null,
    },
  })
  await audit({ req, ctx, companyId, action: 'CREATE', entity: 'User', entityId: user.id, after: { name: user.name, email: user.email, role: user.role } })
  return jsonOk({ user: { id: user.id, name: user.name, email: user.email, role: user.role } })
}, { perm: 'user.manage' })

export const PATCH = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const body = await readJson<{ id: string; name?: string; role?: string; branchId?: string | null; driverId?: string | null; active?: boolean; phone?: string; newPassword?: string }>(req)
  const user = await db.user.findUnique({ where: { id: body.id } })
  if (!user || user.companyId !== companyId) return jsonError(404, 'Utilizador não encontrado na sua empresa.')

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.phone !== undefined) data.phone = body.phone
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role as never)) return jsonError(400, 'Perfil inválido.')
    data.role = body.role
  }
  if (body.branchId !== undefined) data.branchId = body.branchId
  if (body.driverId !== undefined) data.driverId = body.driverId
  if (body.active !== undefined) data.active = body.active
  if (body.newPassword) {
    const policy = passwordPolicyOk(body.newPassword)
    if (!policy.ok) return jsonError(400, policy.message!)
    data.passwordHash = hashPassword(body.newPassword)
    //: alteração de palavra-passe revoga outras sessões
    const { revokeAllSessions } = await import('@/lib/auth')
    await revokeAllSessions(user.id, ctx.session.id)
  }

  const updated = await db.user.update({ where: { id: user.id }, data })
  await audit({
    req, ctx, companyId, action: 'UPDATE', entity: 'User', entityId: user.id,
    before: { role: user.role, active: user.active },
    after: { role: updated.role, active: updated.active, passwordChanged: Boolean(body.newPassword) },
  })
  return jsonOk({ ok: true })
}, { perm: 'user.manage' })
