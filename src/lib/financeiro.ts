// =====================================================================
// SIGFCO — Financeiro: orçamento vs realizado, duplicados, fecho
// (FIN-010..016, FR-058, §9.3)
// =====================================================================
import 'server-only'
import { db } from '@/lib/db'
import { getSetting } from './numeracao'
import { convert, resolveRate } from './money'
import { haversineKm } from './gps'
import type { Currency } from './constantes'

export type BudgetLine = { category: string; limitMinor: number; pendingMinor: number; approvedMinor: number; pct: number }

export async function computeTripBudget(companyId: string, tripId: string): Promise<{
  lines: BudgetLine[]
  baseCurrency: string
  totalLimit: number
  totalPending: number
  totalApproved: number
  alerts: string[]
}> {
  const company = await db.company.findUnique({ where: { id: companyId } })
  const baseCurrency = company?.currencyBase ?? 'MZN'
  const budgetLines = await db.tripBudgetLine.findMany({ where: { tripId } })
  const expenses = await db.expense.findMany({
    where: { tripId, status: { in: ['SUBMITTED', 'IN_REVIEW', 'APPROVED', 'RECONCILED'] } },
  })
  const alerts: string[] = []
  const alertPct = await getSetting<number>(companyId, 'budget_alert_pct')

  const lines: BudgetLine[] = []
  for (const bl of budgetLines) {
    let pendingMinor = 0
    let approvedMinor = 0
    for (const e of expenses) {
      if (e.category !== bl.category) continue
      let valueMinor = e.convertedMinor
      if (valueMinor === null) {
        if (e.currency === bl.currency) valueMinor = e.amountMinor
        else {
          const rate = await resolveRate(companyId, e.currency, baseCurrency, baseCurrency)
          valueMinor = rate ? convert(e.amountMinor, rate.rate) : e.amountMinor
        }
      }
      if (['APPROVED', 'RECONCILED'].includes(e.status)) approvedMinor += valueMinor
      else pendingMinor += valueMinor
    }
    const total = pendingMinor + approvedMinor
    const pct = bl.limitMinor > 0 ? Math.round((total / bl.limitMinor) * 100) : 0
    if (pct >= 100) alerts.push(`Rubrica ${bl.category}: orçamento esgotado (${pct}%).`)
    else if (pct >= alertPct) alerts.push(`Rubrica ${bl.category}: ${pct}% do orçamento consumido.`)
    lines.push({ category: bl.category, limitMinor: bl.limitMinor, pendingMinor, approvedMinor, pct })
  }
  return {
    lines,
    baseCurrency,
    totalLimit: lines.reduce((s, l) => s + l.limitMinor, 0),
    totalPending: lines.reduce((s, l) => s + l.pendingMinor, 0),
    totalApproved: lines.reduce((s, l) => s + l.approvedMinor, 0),
    alerts,
  }
}

/** Detecção de duplicados (FR-058, AT-015): sinaliza, não rejeita sozinha. */
export async function detectDuplicate(companyId: string, candidate: {
  id: string
  tripId?: string
  category: string
  amountMinor: number
  currency: string
  expenseDate: Date
  vendor?: string | null
  lat?: number | null
  lng?: number | null
  fileHash?: string | null
}): Promise<{ flag: string | null; score: number; ofId: string | null; reasons: string[] }> {
  const winMinutes = await getSetting<number>(companyId, 'duplicate_window_minutes')
  const radiusM = await getSetting<number>(companyId, 'duplicate_radius_m')
  const since = new Date(candidate.expenseDate.getTime() - winMinutes * 60_000)
  const until = new Date(candidate.expenseDate.getTime() + winMinutes * 60_000)

  const peers = await db.expense.findMany({
    where: {
      companyId,
      id: { not: candidate.id },
      status: { notIn: ['REJECTED', 'VOID'] },
      expenseDate: { gte: since, lte: until },
      ...(candidate.tripId ? { tripId: candidate.tripId } : {}),
    },
    include: { attachments: true },
  })

  let best: { id: string; score: number; reasons: string[] } | null = null
  for (const p of peers) {
    const reasons: string[] = []
    let score = 0
    if (p.amountMinor === candidate.amountMinor && p.currency === candidate.currency) { score += 0.35; reasons.push('valor/moeda idênticos') }
    if (p.category === candidate.category) { score += 0.2; reasons.push('mesma categoria') }
    if (p.vendor && candidate.vendor && p.vendor.toLowerCase().trim() === candidate.vendor.toLowerCase().trim()) { score += 0.15; reasons.push('mesmo estabelecimento') }
    if (candidate.fileHash && p.attachments.some((a) => a.hash === candidate.fileHash)) { score += 0.45; reasons.push('ficheiro idêntico (hash)') }
    if (candidate.lat != null && candidate.lng != null && p.lat != null && p.lng != null) {
      const d = haversineKm(p.lat, p.lng, candidate.lat, candidate.lng) * 1000
      if (d <= radiusM) { score += 0.15; reasons.push('localização próxima') }
    }
    const dt = Math.abs(p.expenseDate.getTime() - candidate.expenseDate.getTime())
    if (dt <= 5 * 60_000) { score += 0.1; reasons.push('horário quase igual') }
    if (score >= 0.5 && (!best || score > best.score)) best = { id: p.id, score, reasons }
  }
  if (!best) return { flag: null, score: 0, ofId: null, reasons: [] }
  return { flag: 'POSSIBLE_DUPLICATE', score: Math.min(best.score, 1), ofId: best.id, reasons: best.reasons }
}

/** Reconciliação de viagem (FR-067, FIN-015). */
export async function reconcileTrip(companyId: string, tripId: string) {
  const company = await db.company.findUnique({ where: { id: companyId } })
  const baseCurrency = company?.currencyBase ?? 'MZN'
  const advances = await db.advance.findMany({ where: { tripId } })
  const expenses = await db.expense.findMany({ where: { tripId, status: 'APPROVED' } })

  const byCurrency: Record<string, { advances: number; approved: number }> = {}
  for (const a of advances) {
    byCurrency[a.currency] ??= { advances: 0, approved: 0 }
    byCurrency[a.currency].advances += a.amountMinor
  }
  for (const e of expenses) {
    byCurrency[e.currency] ??= { advances: 0, approved: 0 }
    byCurrency[e.currency].approved += e.amountMinor
  }
  const pending = await db.expense.count({ where: { tripId, status: { in: ['SUBMITTED', 'IN_REVIEW', 'RETURNED'] } } })
  const rejected = await db.expense.count({ where: { tripId, status: 'REJECTED' } })

  const balances = Object.entries(byCurrency).map(([ccy, v]) => ({
    currency: ccy,
    advanceMinor: v.advances,
    approvedMinor: v.approved,
    balanceMinor: v.advances - v.approved, // positivo: a devolver; negativo: a reembolsar
  }))
  return { baseCurrency, balances, pendingExpenses: pending, rejectedExpenses: rejected }
}
