// SIGFCO - Autenticação: login/logout
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSession, revokeSession, SESSION_COOKIE, SESSION_TTL_HOURS } from '@/lib/auth'
import { audit, jsonError, rateLimit } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const action = body.action as string

  if (action === 'login') {
    const ip = req.headers.get('x-forwarded-for') ?? 'local'
    if (!rateLimit(`login:${ip}:${body.email ?? ''}`, 10, 60_000))
      return jsonError(429, 'Demasiadas tentativas. Aguarde um minuto antes de repetir.')
    const { email, password } = body as { email?: string; password?: string }
    if (!email || !password) return jsonError(400, 'Indique email e palavra-passe.')

    const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
      await audit({ req, action: 'LOGIN_FAILED', entity: 'User', entityId: String(email ?? '') })
      return jsonError(401, 'Credenciais inválidas.')
    }
    const device = req.headers.get('user-agent')?.slice(0, 180) ?? undefined
    const { token, expiresAt } = await createSession(user, { device, ip })
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    await audit({ req, companyId: user.companyId, action: 'LOGIN', entity: 'User', entityId: user.id })

    const res = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId, branchId: user.branchId, driverId: user.driverId },
      expiresAt,
    })
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: SESSION_TTL_HOURS * 3600,
    })
    return res
  }

  if (action === 'logout') {
    const token = req.cookies.get(SESSION_COOKIE)?.value
    if (token) {
      await revokeSession(token)
      await audit({ req, action: 'LOGOUT', entity: 'Session' })
    }
    const res = NextResponse.json({ ok: true })
    res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
    return res
  }

  return jsonError(400, 'Acção desconhecida.')
}
