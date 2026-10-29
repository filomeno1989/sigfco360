// SIGFCO - Taxas de câmbio: fonte explícita; manual exige permissão
import { withAuth, jsonOk, jsonError, readJson, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'
import { setRate } from '@/lib/money'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const rates = await db.exchangeRate.findMany({
    where: { companyId }, orderBy: { effectiveAt: 'desc' }, take: 200,
  })
  return jsonOk({ rates })
}, { perm: 'finance.read' })

export const POST = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<{ fromCcy: string; toCcy: string; rate: string; source?: string; note?: string }>(req)
  const rateNum = Number(b.rate)
  if (!isFinite(rateNum) || rateNum <= 0) return jsonError(400, 'Taxa inválida.')
  if ((b.source ?? 'MANUAL') === 'MANUAL' && !['FINANCE', 'COMPANY_ADMIN', 'PLATFORM_ADMIN'].includes(ctx.user.role))
    return jsonError(403, 'Taxa manual exige permissão financeira.')

  const created = await setRate({
    companyId, fromCcy: b.fromCcy.toUpperCase(), toCcy: b.toCcy.toUpperCase(),
    rate: b.rate, source: b.source ?? 'MANUAL', setBy: ctx, req, note: b.note,
  })
  return jsonOk({ rate: created })
}, { perm: 'finance.manage' })
