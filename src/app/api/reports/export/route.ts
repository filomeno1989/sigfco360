// SIGFCO - Exportações CSV autorizadas e auditadas
// Permissão verificada por tipo; cada exportação gera evento de auditoria.
import { withAuth, jsonError, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

function csv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return 'sem_dados\n'
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return `"${s.replace(/"/g, '""')}"`
  }
  return [headers.join(';'), ...rows.map((r) => headers.map((h) => esc(r[h])).join(';'))].join('\n')
}

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const type = req.nextUrl.searchParams.get('type')
  const from = req.nextUrl.searchParams.get('from') ? new Date(req.nextUrl.searchParams.get('from')!) : new Date(Date.now() - 90 * 86400_000)
  const to = req.nextUrl.searchParams.get('to') ? new Date(req.nextUrl.searchParams.get('to')!) : new Date()

  let rows: Array<Record<string, unknown>> = []
  let name = type ?? 'export'

  if (type === 'expenses') {
    if (!['FINANCE', 'COMPANY_ADMIN', 'AUDITOR', 'PLATFORM_ADMIN', 'FLEET_MANAGER'].includes(ctx.user.role))
      return jsonError(403, 'Exportação financeira restrita.')
    const list = await db.expense.findMany({
      where: { companyId, expenseDate: { gte: from, lte: to } },
      include: { trip: { select: { code: true } }, driver: { select: { name: true } } },
      orderBy: { expenseDate: 'asc' },
    })
    rows = list.map((e) => ({
      codigo: e.code, data: e.expenseDate.toISOString().slice(0, 10), viagem: e.trip?.code,
      motorista: e.driver?.name, categoria: e.category,
      valor_original: (e.amountMinor / 100).toFixed(2), moeda: e.currency,
      valor_MZN: e.convertedMinor !== null ? (e.convertedMinor / 100).toFixed(2) : '',
      taxa: e.rateApplied ?? '', fonte_taxa: e.rateSource ?? '',
      estado: e.status, duplicado: e.duplicateFlag ?? '',
      sem_comprovativo: e.noReceiptReason ?? '',
      gps: e.lat !== null ? `${e.lat.toFixed(5)},${e.lng?.toFixed(5)}` : '',
    }))
  } else if (type === 'fuel') {
    const list = await db.fuelLog.findMany({
      where: { companyId, deviceTime: { gte: from, lte: to } },
      include: { vehicle: { select: { plate: true } } },
      orderBy: { deviceTime: 'asc' },
    })
    rows = list.map((f) => ({
      data: f.deviceTime.toISOString().slice(0, 10), veiculo: f.vehicle?.plate,
      litros: f.liters, preco_litro: (f.pricePerLiterMinor / 100).toFixed(2),
      total: (f.totalMinor / 100).toFixed(2), moeda: f.currency, odometro: f.odoKm,
      posto: f.station ?? '', anomalias: f.flagsJson ?? '',
    }))
  } else if (type === 'trips') {
    const list = await db.trip.findMany({
      where: { companyId, createdAt: { gte: from, lte: to } },
      include: { vehicle: { select: { plate: true } }, driver: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    })
    rows = list.map((t) => ({
      codigo: t.code, estado: t.status, origem: t.origin, destino: t.destination,
      veiculo: t.vehicle?.plate, motorista: t.driver?.name,
      inicio_previsto: t.plannedStart.toISOString().slice(0, 16), partida: t.departureAt?.toISOString().slice(0, 16) ?? '',
      chegada: t.arrivalAt?.toISOString().slice(0, 16) ?? '', fecho: t.closedAt?.toISOString().slice(0, 16) ?? '',
      km_inicio: t.startOdometerKm ?? '', km_fim: t.endOdometerKm ?? '',
      orcamento_MZN: (t.budgetMinorTotal / 100).toFixed(2), cancelamento: t.cancelReason ?? '',
    }))
  } else if (type === 'documents') {
    const list = await db.documentItem.findMany({ where: { companyId }, orderBy: { expiresAt: 'asc' } })
    rows = list.map((d) => ({
      tipo: d.type, numero: d.number ?? '', dono: d.ownerType, validade: d.expiresAt?.toISOString().slice(0, 10) ?? '',
      pais: d.issuerCountry ?? '', bloqueante: d.blocking ? 'SIM' : 'NÃO', estado: d.status,
    }))
  } else {
    return jsonError(400, 'Tipo de exportação desconhecido. Use: expenses | fuel | trips | documents.')
  }

  //: exportação registada
  await audit({ req, ctx, companyId, action: 'EXPORT', entity: `Report:${type}`, after: { rows: rows.length, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) } })

  return new Response('\uFEFF' + csv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sigfco_${name}_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}, { perm: 'report.export' })
