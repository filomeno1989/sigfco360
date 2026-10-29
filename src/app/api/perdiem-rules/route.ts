// SIGFCO - Regras de per diem e cálculo legível
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const rules = await db.perDiemRule.findMany({ where: { companyId }, orderBy: [{ country: 'asc' }, { city: 'asc' }] })
  return jsonOk({ rules })
}, { perm: 'finance.read' })

export const POST = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, unknown>>(req)

  // Cálculo legível: apresenta regras usadas; alteração manual exige motivo+permissão
  if (b.action === 'calculate') {
    const country = String(b.country ?? '')
    const days = Math.max(1, Number(b.days ?? 1))
    const rules = await db.perDiemRule.findMany({ where: { companyId, active: true, country } })
    if (rules.length === 0) return jsonError(404, `Sem regras de per diem para ${country}. Configure primeiro.`)
    const city = b.city ? String(b.city) : null
    const rule = (city && rules.find((r) => r.city === city)) || rules.find((r) => !r.city) || rules[0]
    const amountMinor = rule.amountMinor * days
    return jsonOk({
      calculation: {
        rule: `${rule.country}${rule.city ? ` / ${rule.city}` : ''}`,
        dailyMinor: rule.amountMinor, currency: rule.currency, days, totalMinor: amountMinor,
        explanation: `Taxa diária ${rule.currency} ${(rule.amountMinor / 100).toFixed(2)} × ${days} dia(s)`,
      },
    })
  }

  const rule = await db.perDiemRule.create({
    data: {
      companyId, country: String(b.country ?? 'MZ'),
      city: (b.city as string) || null,
      category: (b.category as string) || null,
      amountMinor: Number(b.amountMinor),
      currency: String(b.currency ?? 'MZN'),
    },
  })
  await audit({ req, ctx, companyId, action: 'CREATE', entity: 'PerDiemRule', entityId: rule.id, after: rule })
  return jsonOk({ rule })
}, { perm: 'finance.manage' })

export const PATCH = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<{ id: string; amountMinor?: number; active?: boolean; reason?: string }>(req)
  const rule = await db.perDiemRule.findUnique({ where: { id: b.id } })
  if (!rule || rule.companyId !== companyId) return jsonError(404, 'Regra não encontrada.')
  if (!b.reason) return jsonError(400, 'Alterações manuais à regra de per diem exigem motivo.')
  const updated = await db.perDiemRule.update({
    where: { id: rule.id },
    data: { amountMinor: b.amountMinor !== undefined ? Number(b.amountMinor) : undefined, active: b.active },
  })
  await audit({ req, ctx, companyId, action: 'UPDATE', entity: 'PerDiemRule', entityId: rule.id, before: rule, after: updated, reason: b.reason })
  return jsonOk({ rule: updated })
}, { perm: 'finance.manage' })
