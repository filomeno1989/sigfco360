// =====================================================================
// SIGFCO — Autenticação e sessões (SEC-002, SEC-003, MOB-002)
// Sessões em base de dados com token opaco; o cookie guarda o token
// plano, a BD guarda apenas o hash SHA-256. Revogação imediata suportada
// (perda de telemóvel / saída de trabalhador — §4.1).
// =====================================================================
import 'server-only'
import crypto from 'crypto'
import { db } from '@/lib/db'
import type { User, Session } from '@prisma/client'

export const SESSION_COOKIE = 'sigfco_session'
// Sessão de curta duração (SEC-002); renovada em actividade
export const SESSION_TTL_HOURS = 12
export const SESSION_IDLE_MINUTES = 240

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [algo, salt, hash] = stored.split(':')
    if (algo !== 'scrypt' || !salt || !hash) return false
    const candidate = crypto.scryptSync(password, salt, 64)
    const expected = Buffer.from(hash, 'hex')
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

function sha256(v: string): string {
  return crypto.createHash('sha256').update(v).digest('hex')
}

export async function createSession(
  user: Pick<User, 'id'>,
  meta: { device?: string; ip?: string }
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000)
  await db.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      device: (meta.device || '').slice(0, 180),
      ip: meta.ip,
      expiresAt,
    },
  })
  return { token, expiresAt }
}

export type SessionContext = { user: User; session: Session }

export async function resolveSession(token: string | undefined | null): Promise<SessionContext | null> {
  if (!token) return null
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  })
  if (!session) return null
  if (session.revokedAt) return null
  const now = new Date()
  if (session.expiresAt < now) return null
  // expiração por inactividade — janela deslizante
  const idleMs = now.getTime() - session.lastSeenAt.getTime()
  if (idleMs > SESSION_IDLE_MINUTES * 60_000) return null
  if (!session.user.active) return null
  // actualização não-bloqueante da última actividade
  db.session.update({ where: { id: session.id }, data: { lastSeenAt: now } }).catch(() => {})
  return { user: session.user, session }
}

export async function revokeSession(token: string): Promise<void> {
  await db.session.updateMany({
    where: { tokenHash: sha256(token), revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const res = await db.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  })
  return res.count
}

export function passwordPolicyOk(password: string): { ok: boolean; message?: string } {
  if (password.length < 8) return { ok: false, message: 'A palavra-passe deve ter pelo menos 8 caracteres.' }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password))
    return { ok: false, message: 'A palavra-passe deve combinar letras e números.' }
  return { ok: true }
}
