// =====================================================================
// SIGFCO — Dinheiro e câmbio (FIN-001..005)
// Montantes em unidades menores inteiras (centavos). NUNCA ponto
// flutuante para saldos financeiros. Câmbio com fonte, data e autor.
// =====================================================================
import 'server-only'
import { db } from '@/lib/db'
import { audit } from './api'
import type { SessionContext } from './auth'

export const BASE_CURRENCY_DEFAULT = 'MZN'

/** Formata unidades menores → string "1.234,56 MT" (UX-001). */
export function fmtMoney(amountMinor: number | null | undefined, currency = 'MZN', locale = 'pt-MZ'): string {
  if (amountMinor === null || amountMinor === undefined) return '—'
  const value = amountMinor / 100
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'symbol' }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

/** "1.234,56" | "1234.56" → centavos inteiros. */
export function parseMoney(input: string | number): number {
  if (typeof input === 'number') return Math.round(input * 100)
  const cleaned = input.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const v = Number(cleaned)
  if (!isFinite(v)) throw new Error('Valor monetário inválido.')
  return Math.round(v * 100)
}

/** Multiplica com precisão: litros (float) × preço (centavos) → centavos. */
export function mulMinor(liters: number, pricePerLiterMinor: number): number {
  return Math.round(liters * pricePerLiterMinor)
}

/** Taxa guardada como string decimal; converção reproduzível (AT-013). */
export function convert(amountMinor: number, rateStr: string): number {
  const rate = Number(rateStr)
  if (!isFinite(rate) || rate <= 0) throw new Error('Taxa de câmbio inválida.')
  return Math.round(amountMinor * rate)
}

export async function resolveRate(
  companyId: string,
  from: string,
  to: string,
  baseCurrency: string
): Promise<{ rate: string; source: string; effectiveAt: Date } | null> {
  if (from === to) return { rate: '1', source: 'BASE', effectiveAt: new Date() }
  const target = to || baseCurrency
  const rate = await db.exchangeRate.findFirst({
    where: { companyId, fromCcy: from, toCcy: target },
    orderBy: { effectiveAt: 'desc' },
  })
  if (!rate) return null
  return { rate: rate.rate, source: rate.source, effectiveAt: rate.effectiveAt }
}

export async function setRate(params: {
  companyId: string
  fromCcy: string
  toCcy: string
  rate: string
  source: string
  setBy?: SessionContext | null
  req?: Request
  note?: string
}) {
  const created = await db.exchangeRate.create({
    data: {
      companyId: params.companyId,
      fromCcy: params.fromCcy,
      toCcy: params.toCcy,
      rate: params.rate,
      source: params.source,
      setById: params.setBy?.user.id,
      note: params.note,
    },
  })
  // Operação crítica: alterar taxa de câmbio → auditoria (§4.1)
  await audit({
    req: params.req as never,
    ctx: params.setBy ?? undefined,
    companyId: params.companyId,
    action: 'RATE_CHANGE',
    entity: 'ExchangeRate',
    entityId: created.id,
    after: { from: params.fromCcy, to: params.toCcy, rate: params.rate, source: params.source, note: params.note },
  })
  return created
}
