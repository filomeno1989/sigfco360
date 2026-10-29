// =====================================================================
// SIGFCO - Despesas
//  · Idempotência por clientUuid
//  · Valor original + moeda NUNCA substituídos; conversão guardada
//  · Detecção de duplicados sinaliza, não rejeita sozinha
//  · Aprovados não são alterados/apagados em silêncio
// =====================================================================
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'
import { detectDuplicate, computeTripBudget } from '@/lib/financeiro'
import { resolveRate, convert, fmtMoney } from '@/lib/money'
import { nextCode, getSetting } from '@/lib/numeracao'
import { EXPENSE_CATEGORIES } from '@/lib/constantes'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const sp = req.nextUrl.searchParams
  const estado = sp.get('status')
  const viagemId = sp.get('tripId')
  const categoria = sp.get('category')
  const motoristaId = sp.get('driverId')
  const moeda = sp.get('currency')
  const q = {
    companyId,
    ...(estado ? { status: { in: estado.split(',') } } : {}),
    ...(viagemId ? { tripId: viagemId } : {}),
    ...(categoria ? { category: categoria } : {}),
    ...(motoristaId ? { driverId: motoristaId } : {}),
    ...(moeda ? { currency: moeda } : {}),
    ...(sp.get('duplicates') === '1' ? { duplicateFlag: 'POSSIBLE_DUPLICATE' } : {}),
    ...(sp.get('noReceipt') === '1' ? { noReceiptReason: { not: null } } : {}),
  }
  // FINANCEIRO vê fila completa; motorista só as suas
  const where = ctx.user.role === 'DRIVER' ? { ...q, driverId: ctx.user.driverId ?? '___' } : q
  const expenses = await db.expense.findMany({
    where,
    orderBy: { expenseDate: 'desc' },
    take: Number(sp.get('take') ?? 300),
    include: {
      trip: { select: { id: true, code: true } },
      driver: { select: { id: true, name: true } },
      attachments: { select: { id: true, hash: true, mime: true, size: true } },
    },
  })
  return jsonOk({ expenses })
}, { anyPerm: ['expense.read', 'expense.own'] })

export const POST = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, unknown>>(req)

  const clientUuid = String(b.clientUuid ?? crypto.randomUUID())
  // /: repetição do mesmo UUID → um único registo
  const existing = await db.expense.findUnique({ where: { clientUuid } })
  if (existing) {
    await db.syncRecord.updateMany({ where: { clientUuid }, data: { status: 'PROCESSED', processedAt: new Date() } })
    return jsonOk({ expense: existing, idempotent: true })
  }

  const tripId = String(b.tripId ?? '')
  const trip = await db.trip.findUnique({ where: { id: tripId } })
  if (!trip || trip.companyId !== companyId) return jsonError(404, 'Viagem não encontrada.')
  if (['CLOSED', 'CANCELLED'].includes(trip.status))
    return jsonError(409, 'Despesas não podem ser submetidas para viagem fechada sem reabertura controlada.')

  const category = String(b.category ?? 'outros')
  if (!EXPENSE_CATEGORIES.includes(category as never)) return jsonError(400, 'Categoria inválida.')
  const amountMinor = Number(b.amountMinor)
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) return jsonError(400, 'Montante inválido.')
  const currency = String(b.currency ?? 'MZN')

  const company = await db.company.findUnique({ where: { id: companyId } })
  const base = company?.currencyBase ?? 'MZN'

  ///003: taxa com origem explícita; conversão reproduzível
  let convertedMinor: number | null = null
  let rateApplied: string | null = null
  let rateSource: string | null = null
  if (currency !== base) {
    const rate = await resolveRate(companyId, currency, base, base)
    if (!rate) return jsonError(400, `Sem taxa de câmbio registada para ${currency} → ${base}. Registe a taxa antes de submeter.`)
    convertedMinor = convert(amountMinor, rate.rate)
    rateApplied = rate.rate
    rateSource = rate.source
  } else {
    convertedMinor = amountMinor
  }

  //: sem comprovativo - excepção documentada apenas nas categorias aprovadas
  const noReceiptReason = (b.noReceiptReason as string) || null
  const requireReceipt = await getSetting<string[]>(companyId, 'require_receipt_categories')
  if (!b.attachmentId && !noReceiptReason && requireReceipt.includes(category))
    return jsonError(400, `Comprovativo obrigatório para a categoria "${category}" (política da empresa). Registre fotografia ou justifique a excepção.`)

  const code = await nextCode(companyId, 'expense')

  // /: sinalizar duplicado potencial
  const dup = await detectDuplicate(companyId, {
    id: 'new', tripId, category, amountMinor, currency,
    expenseDate: new Date(String(b.expenseDate ?? new Date())),
    vendor: (b.vendor as string) || null,
    lat: (b.lat as number) ?? null, lng: (b.lng as number) ?? null,
    fileHash: (b.fileHash as string) || null,
  })

  const expense = await db.expense.create({
    data: {
      clientUuid, companyId, code,
      tripId,
      driverId: (b.driverId as string) || trip.driverId,
      authorUserId: ctx.user.id,
      category, amountMinor, currency,
      convertedMinor, baseCurrency: base, rateApplied, rateSource,
      rateDate: currency !== base ? new Date() : null,
      expenseDate: new Date(String(b.expenseDate ?? new Date())),
      vendor: (b.vendor as string) || null,
      description: (b.description as string) || null,
      paymentMethod: (b.paymentMethod as string) || null,
      odoKm: b.odoKm !== undefined && b.odoKm !== '' ? Number(b.odoKm) : null,
      liters: b.liters !== undefined && b.liters !== '' ? Number(b.liters) : null,
      pricePerLiterMinor: b.pricePerLiterMinor ? Number(b.pricePerLiterMinor) : null,
      fuelType: (b.fuelType as string) || null,
      station: (b.station as string) || null,
      lat: (b.lat as number) ?? null, lng: (b.lng as number) ?? null,
      locSource: (b.locSource as string) || null,
      locPrecisionM: b.locPrecisionM ? Number(b.locPrecisionM) : null,
      locStatus: (b.locStatus as string) || null,
      locNote: (b.locNote as string) || null,
      status: 'SUBMITTED',
      duplicateFlag: dup.flag,
      duplicateOfId: dup.ofId,
      duplicateScore: dup.score || null,
      noReceiptReason,
    },
  })

  if (b.attachmentId) {
    await db.attachment.update({ where: { id: String(b.attachmentId) }, data: { expenseId: expense.id } })
  }

  // /: comparação com orçamento e alerta
  const budget = await computeTripBudget(companyId, tripId)
  for (const a of budget.alerts) {
    await db.alert.create({
      data: { companyId, severity: 'HIGH', type: 'BUDGET_EXCEEDED', title: `Orçamento da viagem ${trip.code}`, message: a, refType: 'TRIP', refId: tripId, tripId },
    })
  }
  if (dup.flag) {
    await db.alert.create({
      data: { companyId, severity: 'MEDIUM', type: 'DUPLICATE_EXPENSE',
        title: `Possível despesa duplicada (${Math.round(dup.score * 100)}%)`,
        message: `Despesa ${code} assemelha-se a registo existente: ${dup.reasons.join(', ')}. Revisão humana necessária.`,
        refType: 'EXPENSE', refId: expense.id },
    })
  }

  await db.syncRecord.upsert({
    where: { clientUuid },
    create: { clientUuid, companyId, userId: ctx.user.id, type: 'EXPENSE', payloadJson: JSON.stringify({ code }), status: 'PROCESSED', processedAt: new Date(), deviceTime: b.expenseDate ? new Date(String(b.expenseDate)) : null },
    update: { status: 'PROCESSED', processedAt: new Date() },
  })

  await audit({ req, ctx, companyId, action: 'CREATE', entity: 'Expense', entityId: expense.id, after: { code, category, amountMinor, currency, convertedMinor, duplicate: dup.flag } })
  return jsonOk({
    expense,
    duplicate: dup.flag ? { score: dup.score, reasons: dup.reasons, ofId: dup.ofId } : null,
    message: `Despesa ${code} submetida para aprovação.${dup.flag ? ' Sinalizada como possível duplicado.' : ''}`,
  })
}, { anyPerm: ['expense.submit', 'expense.own'] })
