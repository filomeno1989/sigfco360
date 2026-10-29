// =====================================================================
// SIGFCO - Motor de viagens
// Transições de estado verificadas no SERVIDOR. Regras críticas:
//  · Carregador obrigatório bloqueia partida
//  · Sem motorista activo, veículo elegível, documentos válidos,
//    rastreado registado e checklist aprovado a viagem não inicia
//  · Conflito de recursos: um camião/motorista não entra em duas
//    viagens activas sobrepostas
// =====================================================================
import 'server-only'
import { db } from '@/lib/db'
import { TRIP_ACTIVE_STATUSES, CHARGER_ITEM_KEY, GPS_ITEM_KEY, PHONE_HOLDER_KEY } from './constantes'
import type { SessionContext } from './auth'

export type TransitionResult = { ok: boolean; reason?: string }

const ALLOWED: Record<string, string[]> = {
  DRAFT: ['PLANNED', 'CANCELLED'],
  PLANNED: ['AWAITING_CHECKLIST', 'CANCELLED'],
  AWAITING_CHECKLIST: ['AUTHORIZED_DEPARTURE', 'CANCELLED', 'PLANNED'],
  AUTHORIZED_DEPARTURE: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['PAUSED', 'ARRIVED'],
  PAUSED: ['IN_TRANSIT', 'ARRIVED'],
  ARRIVED: ['AWAITING_RECONCILIATION'],
  AWAITING_RECONCILIATION: ['CLOSED'],
  CLOSED: ['AWAITING_RECONCILIATION'], // apenas via reabertura autorizada
  CANCELLED: [],
}

export function transitionAllowed(from: string, to: string): TransitionResult {
  const list = ALLOWED[from]
  if (!list) return { ok: false, reason: `Estado desconhecido: ${from}` }
  if (!list.includes(to)) return { ok: false, reason: `Transição ${from} → ${to} não permitida.` }
  return { ok: true }
}

/** Documentos bloqueantes expirados do veículo/motorista. */
export async function expiredBlockingDocs(companyId: string, vehicleId?: string, driverId?: string) {
  const now = new Date()
  return db.documentItem.findMany({
    where: {
      companyId,
      blocking: true,
      expiresAt: { lt: now },
      OR: [
        ...(vehicleId ? [{ vehicleId }] : []),
        ...(driverId ? [{ driverId }] : []),
      ],
    },
  })
}

/** Elegibilidade de motorista e de veículo. */
export async function resourceBlockers(companyId: string, vehicleId: string, driverId: string) {
  const blockers: string[] = []
  const now = new Date()

  const driver = await db.driver.findUnique({ where: { id: driverId } })
  if (!driver || driver.companyId !== companyId) blockers.push('Motorista inexistente ou de outra empresa.')
  else {
    if (driver.status === 'INACTIVE' || driver.status === 'SUSPENDED')
      blockers.push(`Motorista ${driver.status === 'INACTIVE' ? 'inactivo' : 'suspenso'}.`)
    if (driver.licenseExpiry && driver.licenseExpiry < now)
      blockers.push('Carta de condução expirada.')
  }

  const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId } })
  if (!vehicle || vehicle.companyId !== companyId) blockers.push('Veículo inexistente ou de outra empresa.')
  else if (vehicle.status === 'MAINTENANCE' || vehicle.status === 'BLOCKED')
    blockers.push(`Veículo ${vehicle.status === 'MAINTENANCE' ? 'em manutenção' : 'bloqueado por segurança'}.`)

  const docs = await expiredBlockingDocs(companyId, vehicleId, driverId)
  for (const d of docs) blockers.push(`Documento obrigatório expirado: ${d.type}${d.number ? ` (${d.number})` : ''}`)

  const device = await db.gpsDevice.findFirst({
    where: { companyId, vehicleId, status: { in: ['OPERATIONAL', 'NO_NETWORK'] } },
  })
  if (!device) blockers.push('Sem rastreador GPS dedicado registado/operacional para o veículo (fonte primária de rastreio).')

  const wo = await db.workOrder.findFirst({
    where: { companyId, vehicleId, critical: true, status: { in: ['OPEN', 'IN_PROGRESS'] }, blocksVehicle: true },
  })
  if (wo) blockers.push(`Manutenção crítica em aberto: ${wo.code} - libertação autorizada necessária.`)

  return blockers
}

/** Sobreposição de viagens activas. */
export async function conflictCheck(
  companyId: string,
  vehicleId: string,
  driverId: string,
  plannedStart: Date,
  plannedEnd: Date | null,
  ignoreTripId?: string
) {
  const conflicts: string[] = []
  const trips = await db.trip.findMany({
    where: { companyId, status: { in: TRIP_ACTIVE_STATUSES }, id: ignoreTripId ? { not: ignoreTripId } : undefined },
    include: { vehicle: true, driver: true },
  })
  for (const t of trips) {
    const tEnd = t.plannedEnd ?? t.arrivalAt ?? new Date('2099-01-01')
    const overlaps = t.plannedStart <= plannedEnd! && tEnd >= plannedStart
    if (t.vehicleId === vehicleId && overlaps) conflicts.push(`Veículo já afecto à viagem ${t.code} (${t.status}) no período.`)
    if (t.driverId === driverId && overlaps) conflicts.push(`Motorista já afecto à viagem ${t.code} (${t.status}) no período.`)
  }
  return conflicts
}

/** Validação do checklist: itens bloqueantes falhados impedem partida. */
export function checklistBlockers(itemsJson: string): { blockers: string[]; passed: boolean } {
  const items = JSON.parse(itemsJson) as Array<{ key: string; label: string; blocking: boolean; ok?: boolean }>
  const blockers = items.filter((i) => i.blocking && i.ok !== true).map((i) => i.label)
  return { blockers, passed: blockers.length === 0 }
}

/** Garante que o template contém os itens sistémicos obrigatórios. */
export function ensureSystemChecklistItems(items: Array<{ key: string; label: string; blocking: boolean; category?: string }>) {
  const must: Array<{ key: string; label: string; blocking: boolean; category: string }> = [
    { key: CHARGER_ITEM_KEY, label: 'Carregador de telemóvel funcional e acessível (12/24V, USB compatível)', blocking: true, category: 'seguranca' },
    { key: PHONE_HOLDER_KEY, label: 'Suporte seguro de telemóvel montado', blocking: true, category: 'seguranca' },
    { key: GPS_ITEM_KEY, label: 'Rastreador GPS associado e operacional (GPS/sem rede local)', blocking: true, category: 'seguranca' },
  ]
  const byKey = new Map(items.map((i) => [i.key, i]))
  for (const m of must) {
    const existing = byKey.get(m.key)
    if (!existing) items.push(m)
    else { existing.blocking = true }
  }
  return items
}

export async function tripAudit(
  ctx: SessionContext | null,
  action: string,
  tripId: string,
  before: unknown,
  after: unknown,
  reason?: string,
  req?: Request
) {
  const { audit } = await import('./api')
  const trip = await db.trip.findUnique({ where: { id: tripId } })
  await audit({
    req: req as never,
    ctx: ctx ?? undefined,
    companyId: trip?.companyId,
    action,
    entity: 'Trip',
    entityId: tripId,
    before,
    after,
    reason,
  })
}
