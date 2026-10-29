// SIGFCO - Combustível: abastecimentos, consumo esperado
// vs real com pressupostos visíveis, anomalias mantendo revisão humana
import { withAuth, jsonOk, jsonError, readJson, audit, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'
import { fmtMoney, mulMinor } from '@/lib/money'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const vehicleId = req.nextUrl.searchParams.get('vehicleId')
  const logs = await db.fuelLog.findMany({
    where: { companyId, ...(vehicleId ? { vehicleId } : {}) },
    orderBy: { deviceTime: 'desc' },
    take: 300,
    include: { vehicle: { select: { plate: true } }, trip: { select: { code: true } } },
  })

  //: consumo esperado vs real - com pressupostos declarados
  const consumption = await computeConsumption(companyId, vehicleId ?? undefined)
  return jsonOk({ logs, consumption })
}, { anyPerm: ['fuel.read', 'report.read'] })

export const POST = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const b = await readJson<Record<string, unknown>>(req)
  const vehicle = await db.vehicle.findUnique({ where: { id: String(b.vehicleId ?? '') } })
  if (!vehicle || vehicle.companyId !== companyId) return jsonError(404, 'Veículo não encontrado.')

  const liters = Number(b.liters)
  const pricePerLiterMinor = Number(b.pricePerLiterMinor)
  const odoKm = Number(b.odoKm)
  if (!isFinite(liters) || liters <= 0) return jsonError(400, 'Litros inválidos.')
  if (!isFinite(pricePerLiterMinor) || pricePerLiterMinor <= 0) return jsonError(400, 'Preço por litro inválido.')
  if (!isFinite(odoKm) || odoKm < 0) return jsonError(400, 'Quilometragem inválida.')

  const clientUuid = String(b.clientUuid ?? crypto.randomUUID())
  const existing = await db.fuelLog.findUnique({ where: { clientUuid } })
  if (existing) return jsonOk({ fuelLog: existing, idempotent: true })

  const totalMinor = mulMinor(liters, pricePerLiterMinor)
  const flags: string[] = []

  //: anomalias - sinalizar, nunca silenciosamente corrigir
  if (vehicle.tankCapacityL && liters > vehicle.tankCapacityL * 1.15)
    flags.push(`Litros (${liters}) acima da capacidade plausível do tanque (${vehicle.tankCapacityL} L).`)
  if (odoKm < vehicle.odometerKm - 50)
    flags.push(`Quilometragem (${odoKm}) inconsistente com odómetro do veículo (${vehicle.odometerKm}).`)
  const recent = await db.fuelLog.findFirst({
    where: { companyId, vehicleId: vehicle.id, deviceTime: { gte: new Date(Date.now() - 30 * 60_000) } },
  })
  if (recent) flags.push('Outro abastecimento registado há menos de 30 minutos - verificar duplicado.')

  const fuelLog = await db.fuelLog.create({
    data: {
      clientUuid, companyId, vehicleId: vehicle.id,
      tripId: (b.tripId as string) || null,
      driverId: (b.driverId as string) || null,
      liters, pricePerLiterMinor, currency: String(b.currency ?? 'MZN'), totalMinor,
      fuelType: String(b.fuelType ?? 'DIESEL'),
      station: (b.station as string) || null,
      odoKm,
      deviceTime: b.deviceTime ? new Date(String(b.deviceTime)) : new Date(),
      flagsJson: flags.length ? JSON.stringify(flags) : null,
      createdById: ctx.user.id,
    },
  })
  await db.vehicle.update({ where: { id: vehicle.id }, data: { odometerKm: Math.max(vehicle.odometerKm, odoKm) } })
  if (flags.length) {
    await db.alert.create({
      data: { companyId, severity: 'MEDIUM', type: 'OTHER', title: 'Anomalia em abastecimento', message: `${vehicle.plate}: ${flags.join(' ')}`, refType: 'FUEL_LOG', refId: fuelLog.id },
    })
  }
  await audit({ req, ctx, companyId, action: 'CREATE', entity: 'FuelLog', entityId: fuelLog.id, after: { liters, totalMinor: fmtMoney(totalMinor) } })
  return jsonOk({ fuelLog, flags })
}, { anyPerm: ['fuel.manage', 'expense.submit'] })

export async function computeConsumption(companyId: string, vehicleId?: string) {
  const vehicles = await db.vehicle.findMany({ where: { companyId, ...(vehicleId ? { id: vehicleId } : {}) } })
  const results: Array<{ vehicle: string; expectedL: number | null; realL: number | null; distanceKm: number | null; refL100: number | null; assumptions: string[] }> = []
  for (const v of vehicles) {
    const logs = await db.fuelLog.findMany({
      where: { companyId, vehicleId: v.id },
      orderBy: { odoKm: 'asc' },
    })
    const assumptions: string[] = []
    if (logs.length < 2) { results.push({ vehicle: v.plate, expectedL: null, realL: null, distanceKm: null, refL100: v.refConsumption ?? null, assumptions: ['Dados insuficientes (menos de 2 abastecimentos) - sem indicador fiável.'] }); continue }
    const first = logs[0]
    const last = logs[logs.length - 1]
    const distanceKm = last.odoKm - first.odoKm
    const realL = logs.slice(1).reduce((s, l) => s + l.liters, 0)
    const expectedL = v.refConsumption ? (distanceKm * v.refConsumption) / 100 : null
    if (!v.refConsumption) assumptions.push('Sem consumo de referência na ficha do veículo - comparação esperado/real indisponível.')
    if (first.odoKm <= 0) assumptions.push('Primeira leitura de odómetro implausível - intervalo pode estar distorcido.')
    assumptions.push('Método: soma dos litros entre leituras de odómetro (tanque cheio/parcial declarado manualmente).')
    results.push({
      vehicle: v.plate,
      expectedL: expectedL !== null ? Math.round(expectedL * 10) / 10 : null,
      realL: Math.round(realL * 10) / 10,
      distanceKm: Math.round(distanceKm),
      refL100: v.refConsumption ?? null,
      assumptions,
    })
  }
  return results
}
