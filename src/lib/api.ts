// =====================================================================
// SIGFCO - Infra-estrutura de API: sessão, permissões, auditoria,
// rate limiting e respostas padronizadas.
// =====================================================================
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSession, SESSION_COOKIE, type SessionContext } from '@/lib/auth'
import { can, type Perm } from '@/lib/rbac'
import type { User } from '@prisma/client'

export function jsonOk(data: unknown, init?: number) {
  return NextResponse.json(data as object, { status: init ?? 200 })
}

export function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...(extra || {}) }, { status })
}

// ------------------------- Auditoria -----------------------
export async function audit(params: {
  req?: NextRequest
  ctx?: SessionContext | null
  companyId?: string | null
  action: string
  entity: string
  entityId?: string | null
  before?: unknown
  after?: unknown
  reason?: string
}) {
  try {
    await db.auditLog.create({
      data: {
        companyId: params.companyId ?? params.ctx?.user.companyId ?? null,
        userId: params.ctx?.user.id ?? null,
        userName: params.ctx?.user.name ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        beforeJson: params.before !== undefined ? JSON.stringify(params.before) : null,
        afterJson: params.after !== undefined ? JSON.stringify(params.after) : null,
        reason: params.reason,
        ip: params.req?.headers.get('x-forwarded-for') ?? undefined,
        userAgent: params.req?.headers.get('user-agent')?.slice(0, 180) ?? undefined,
      },
    })
  } catch {
    // auditoria nunca deve quebrar a operação, mas falhas ficam em log
    console.error('[audit] falha ao registar evento', params.action)
  }
}

// ------------------------- Rate limiting -------------------
const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  b.count++
  if (b.count > limit) return false
  return true
}

if (typeof setInterval === 'function') {
  const t = setInterval(() => {
    const now = Date.now()
    for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k)
  }, 60_000)
  if (typeof t === 'object' && 'unref' in t) (t as unknown as { unref: () => void }).unref()
}

// ------------------------- Guard de rotas ----------------------------
export type AuthedContext = {
  ctx: SessionContext
  req: NextRequest
  params: Record<string, string>
}

export type RouteOptions = {
  perm?: Perm
  anyPerm?: Perm[]
}

export function withAuth(
  handler: (c: AuthedContext) => Promise<Response>,
  opts: RouteOptions = {}
) {
  return async (req: NextRequest, route?: { params?: Promise<Record<string, string>> }) => {
    const token = req.cookies.get(SESSION_COOKIE)?.value
    const session = await resolveSession(token)
    if (!session) return jsonError(401, 'Sessão inexistente, expirada ou revogada. Volte a autenticar-se.')
    const { user } = session

    if (opts.perm && !can(user.role, opts.perm)) {
      await audit({ req, ctx: session, action: 'ACCESS_DENIED', entity: req.nextUrl.pathname })
      return jsonError(403, 'Sem permissão para esta operação.')
    }
    if (opts.anyPerm && !opts.anyPerm.some((p) => can(user.role, p))) {
      await audit({ req, ctx: session, action: 'ACCESS_DENIED', entity: req.nextUrl.pathname })
      return jsonError(403, 'Sem permissão para esta operação.')
    }

    const params = route?.params ? await route.params : {}
    try {
      return await handler({ ctx: session, req, params })
    } catch (e) {
      console.error('[api]', req.nextUrl.pathname, e)
      const msg = e instanceof Error ? e.message : 'Erro interno inesperado.'
      return jsonError(500, msg)
    }
  }
}

// Escopo de empresa: PLATFORM_ADMIN pode operar entre empresas através de
// ?companyId=; restantes perfis
// estão presos à própria empresa.
export function scopeCompanyId(ctx: SessionContext, req: NextRequest): string {
  const requested = req.nextUrl.searchParams.get('companyId')
  if (ctx.user.role === 'PLATFORM_ADMIN') {
    return requested || ctx.user.companyId || ''
  }
  if (requested && requested !== ctx.user.companyId) {
    // tentativa de fuga de tenant - registada e negada
    audit({ req, ctx, action: 'TENANT_ESCAPE_ATTEMPT', entity: 'Company', entityId: requested })
    throw new Error('Acesso negado a dados de outra empresa.')
  }
  if (!ctx.user.companyId) throw new Error('Utilizador sem empresa associada.')
  return ctx.user.companyId
}

export async function readJson<T>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new Error('Corpo do pedido inválido.')
  }
}
