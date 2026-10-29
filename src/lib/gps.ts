// =====================================================================
// SIGFCO - GPS, telemetria e rastreio autónomo

// ARQUITECTURA (REQUISITO OBRIGATÓRIO):
//  · O rastreador GNSS dedicado instalado no camião é a FONTE PRIMÁRIA.
//    O telemóvel é fonte complementar (fonte=MOBILE) e nunca substitui
//    o equipamento.
//  · Store-and-forward: o endpoint de ingestão aceita pontos em lote
//    com timestamps originais; deduplicação por (deviceId, seq); pontos
//    atrasados mantêm gnssTime original e recebem isHistoric (,
//).
//  · Adaptador por fornecedor: a interface abaixo é
//    o ponto único de ligação de um fornecedor real - o protocolo do
//    fornecedor é convertido para NormalizedPoint e entregue ao
//    processador comum. O simulador DEMO usa a mesma via.
// =====================================================================
import 'server-only'
import { db } from '@/lib/db'
import { getSetting } from './numeracao'
import { audit } from './api'
import type { Freshness } from './constantes'

// ------------------------- Interface de fornecedor ---------
export type NormalizedPoint = {
  deviceSerial: string
  lat: number
  lng: number
  speedKmh?: number
  heading?: number
  accuracyM?: number
  gnssTime: Date
  seq: number
  ignition?: boolean
  fixQuality?: string
  powerEvent?: 'MAIN_LOST' | 'MAIN_RESTORED' | 'LOW_BATTERY' | 'TAMPER'
}

export type ProviderAdapter = {
  id: string
  vendor: string
  /** Converte o payload bruto do fornecedor em pontos normalizados. */
  parse: (payload: unknown) => NormalizedPoint[]
  /** Validação leve antes de gravar; não inventa compatibilidade. */
  validate?: (payload: unknown) => { ok: boolean; error?: string }
}

/** Adaptador genérico JSON - usado pelo simulador DEMO e por integrações
 *  simples de teste. Um fornecedor real (Teltonika, Queclink, etc.)
 *  acrescentaria o seu adapter SEM alterar os módulos de viagem/despesas. */
export const GenericJsonAdapter: ProviderAdapter = {
  id: 'generic-json',
  vendor: 'Genérico (JSON documentado)',
  parse: (payload) => {
    const raw = (payload as { points?: unknown[] }).points ?? []
    return (raw as Array<Record<string, unknown>>).map((p) => ({
      deviceSerial: String(p.deviceSerial ?? ''),
      lat: Number(p.lat),
      lng: Number(p.lng),
      speedKmh: p.speedKmh !== undefined ? Number(p.speedKmh) : undefined,
      heading: p.heading !== undefined ? Number(p.heading) : undefined,
      accuracyM: p.accuracyM !== undefined ? Number(p.accuracyM) : undefined,
      gnssTime: new Date(String(p.gnssTime)),
      seq: Number(p.seq),
      ignition: p.ignition === undefined ? undefined : Boolean(p.ignition),
      fixQuality: p.fixQuality ? String(p.fixQuality) : undefined,
      powerEvent: p.powerEvent ? (String(p.powerEvent) as NormalizedPoint['powerEvent']) : undefined,
    }))
  },
  validate: (payload) => {
    const raw = (payload as { points?: unknown[] }).points
    if (!Array.isArray(raw)) return { ok: false, error: 'points[] ausente' }
    return { ok: true }
  },
}

export const adapters: Record<string, ProviderAdapter> = {
  'generic-json': GenericJsonAdapter,
  // 'teltonika':  { id:'teltonika', vendor:'Teltonika', parse: ... },   // ← ponto de ligação do fornecedor real
  // 'queclink':   { id:'queclink', vendor:'Queclink', parse: ... },    // ← homologação pendente
}

// ------------------------- Qualidade -----------------------
function detectQualityFlags(
  point: { lat: number; lng: number; speedKmh?: number; accuracyM?: number; gnssTime: Date },
  prev?: { lat: number; lng: number; gnssTime: Date } | null
): string[] {
  const flags: string[] = []
  if (point.accuracyM !== undefined && point.accuracyM > 500) flags.push('LOW_ACCURACY')
  if (prev) {
    const dKm = haversineKm(prev.lat, prev.lng, point.lat, point.lng)
    const dtH = Math.max((point.gnssTime.getTime() - prev.gnssTime.getTime()) / 3_600_000, 0.0001)
    const impliedKmh = dKm / dtH
    if (impliedKmh > 160) flags.push('IMPOSSIBLE_JUMP')
    if (point.speedKmh !== undefined && point.speedKmh > 140) flags.push('IMPLAUSIBLE_SPEED')
  }
  return flags
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// ------------------------- Ingestão ----------------------------------
export type IngestResult = { accepted: number; duplicates: number; rejected: number; events: number }

export async function ingestPoints(
  companyId: string,
  device: { id: string; serial: string; vehicleId: string | null; protocol: string | null },
  points: NormalizedPoint[]
): Promise<IngestResult> {
  const result: IngestResult = { accepted: 0, duplicates: 0, rejected: 0, events: 0 }
  const staleMinutes = await getSetting<number>(companyId, 'gps_stale_minutes')
  const now = new Date()

  let prev = await db.gpsPoint.findFirst({
    where: { deviceId: device.id },
    orderBy: { gnssTime: 'desc' },
  })

  for (const p of points) {
    if (!isFinite(p.lat) || !isFinite(p.lng) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) { result.rejected++; continue }
    if (!isFinite(p.seq)) { result.rejected++; continue }
    if (p.gnssTime.getTime() > now.getTime() + 10 * 60_000) { result.rejected++; continue } // relógio no futuro

    const flags = detectQualityFlags(p, prev)
    const isHistoric = prev ? p.gnssTime < prev.gnssTime || now.getTime() - p.gnssTime.getTime() > staleMinutes * 60_000 * 6 : false

    try {
      const created = await db.gpsPoint.create({
        data: {
          companyId,
          deviceId: device.id,
          vehicleId: device.vehicleId,
          lat: p.lat, lng: p.lng,
          speedKmh: p.speedKmh, heading: p.heading, accuracyM: p.accuracyM,
          gnssTime: p.gnssTime,
          source: 'TRACKER',
          seq: p.seq,
          ignition: p.ignition,
          fixQuality: p.fixQuality,
          isHistoric,
          qualityFlags: flags.length ? JSON.stringify(flags) : null,
        },
      })
      result.accepted++
      result.events += await evaluateGeofences(companyId, device, created.id, p.lat, p.lng, p.gnssTime)
      if (p.powerEvent) await handlePowerEvent(companyId, device, p)
      prev = { lat: p.lat, lng: p.lng, gnssTime: p.gnssTime }
    } catch (e) {
      // violação de @@unique(deviceId, seq) → duplicado reenviado
      if (String(e).includes('Unique constraint')) result.duplicates++
      else { result.rejected++; console.error('[gps] ponto rejeitado', e) }
    }
  }

  if (result.accepted > 0) {
    const last = points[points.length - 1]
    await db.gpsDevice.update({
      where: { id: device.id },
      data: { lastPointAt: last.gnssTime, status: device.status === 'INACTIVE' ? 'OPERATIONAL' : device.status },
    })
  }
  return result
}

async function handlePowerEvent(
  companyId: string,
  device: { id: string; serial: string; vehicleId: string | null },
  p: NormalizedPoint
) {
  //: distinguir "sem rede" de "sem alimentação" - evento crítico
  if (p.powerEvent === 'MAIN_LOST' || p.powerEvent === 'TAMPER') {
    await db.gpsDevice.update({ where: { id: device.id }, data: { status: p.powerEvent === 'MAIN_LOST' ? 'NO_POWER' : 'TAMPER_ALERT' } })
    await createAlert(companyId, {
      severity: 'CRITICAL',
      type: p.powerEvent === 'MAIN_LOST' ? 'GPS_NO_POWER' : 'TAMPER',
      title: p.powerEvent === 'MAIN_LOST' ? 'Rastreador sem alimentação principal' : 'Alerta de manipulação do rastreador',
      message: `Dispositivo ${device.serial} reportou ${p.powerEvent}. Verificar instalação/energia do veículo.`,
      refType: 'DEVICE', refId: device.id, vehicleId: device.vehicleId,
    })
  }
}

// ------------------------- Geofences -----------------------
async function evaluateGeofences(
  companyId: string,
  device: { id: string; serial: string; vehicleId: string | null },
  pointId: string,
  lat: number, lng: number,
  when: Date
): Promise<number> {
  const fences = await db.geofence.findMany({ where: { companyId, active: true } })
  let generated = 0
  for (const f of fences) {
    const dKm = haversineKm(f.lat, f.lng, lat, lng)
    const inside = dKm * 1000 <= f.radiusM
    const prevPoint = await db.gpsPoint.findFirst({ where: { deviceId: device.id, id: { not: pointId } }, orderBy: { gnssTime: 'desc' } })
    const prevInside = prevPoint ? haversineKm(f.lat, f.lng, prevPoint.lat, prevPoint.lng) * 1000 <= f.radiusM : false
    if (inside && !prevInside) {
      generated++
      await createAlert(companyId, {
        severity: 'INFO', type: 'GEOFENCE',
        title: `Entrada em cerca: ${f.name}`,
        message: `Veículo/dispositivo ${device.serial} entrou em "${f.name}" (${f.type}).`,
        refType: 'GEOFENCE', refId: f.id, vehicleId: device.vehicleId,
      })
    } else if (!inside && prevInside) {
      generated++
      await createAlert(companyId, {
        severity: 'INFO', type: 'GEOFENCE',
        title: `Saída de cerca: ${f.name}`,
        message: `Veículo/dispositivo ${device.serial} saiu de "${f.name}" (${f.type}).`,
        refType: 'GEOFENCE', refId: f.id, vehicleId: device.vehicleId,
      })
    }
  }
  return generated
}

// ------------------------- Alertas ---------------------------
export async function createAlert(companyId: string, a: {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO'
  type: string
  title: string
  message: string
  refType?: string
  refId?: string
  vehicleId?: string | null
  tripId?: string | null
}) {
  await db.alert.create({ data: { companyId, ...a, vehicleId: a.vehicleId ?? null, tripId: a.tripId ?? null } })
  await db.notification.create({
    data: {
      companyId,
      severity: a.severity,
      title: a.title,
      body: a.message,
      refType: a.refType,
      refId: a.refId,
      channel: 'IN_APP',
      deliveryStatus: 'SENT',
    },
  })
}

// ------------------------- Frescura --------
export function computeFreshness(lastPointAt: Date | null | null, staleMinutes: number, delayedMinutes: number, isHistoric?: boolean): Freshness {
  if (!lastPointAt) return 'NO_COMMUNICATION'
  if (isHistoric) return 'HISTORIC'
  const ageMin = (Date.now() - lastPointAt.getTime()) / 60_000
  if (ageMin > staleMinutes) return 'NO_COMMUNICATION'
  if (ageMin > delayedMinutes) return 'DELAYED'
  return 'LIVE'
}

/** Verificação periódica de lacunas de telemetria em viagem activa (:
 *  sem dados ≠ sem movimento - alerta apenas assinala falta de telemetria). */
export async function checkStalledTrips(companyId: string) {
  const staleMinutes = await getSetting<number>(companyId, 'gps_stale_minutes')
  const threshold = new Date(Date.now() - staleMinutes * 60_000)
  const devices = await db.gpsDevice.findMany({
    where: { companyId, status: { in: ['OPERATIONAL', 'OFFLINE', 'NO_NETWORK'] }, vehicleId: { not: null } },
  })
  for (const d of devices) {
    if (!d.vehicleId) continue
    const activeTrip = await db.trip.findFirst({
      where: { companyId, vehicleId: d.vehicleId, status: { in: ['IN_TRANSIT', 'PAUSED'] } },
    })
    if (!activeTrip) continue
    const last = await db.gpsPoint.findFirst({ where: { deviceId: d.id }, orderBy: { gnssTime: 'desc' } })
    if (!last || last.gnssTime < threshold) {
      await createAlert(companyId, {
        severity: 'HIGH', type: 'GPS_STALLED',
        title: 'Interrupção de telemetria em viagem activa',
        message: `Sem pontos do rastreador ${d.serial} há mais de ${staleMinutes} min (viagem ${activeTrip.code}). Falta de telemetria não implica veículo parado ou avariado.`,
        refType: 'DEVICE', refId: d.id, vehicleId: d.vehicleId, tripId: activeTrip.id,
      })
    }
  }
}

export async function auditSim(req: Request, companyId: string | undefined, userId: string | undefined, action: string, after: unknown) {
  await audit({ req: req as never, companyId, action, entity: 'GpsSimulator', after })
}
