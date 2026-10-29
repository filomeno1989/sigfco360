// =====================================================================
// SIGFCO - Ingestão de telemetria
// Autenticação por chave de dispositivo.
// Aceita lotes store-and-forward com timestamps originais e seq -
// deduplicação por (deviceId, seq) garante reenvio idempotente.
// Rate limiting aplicado. Nenhum ponto DEMO entra por aqui
// disfarçado: a fonte SIMULATOR é registada tal e qual.
// =====================================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { adapters, ingestPoints, type NormalizedPoint } from '@/lib/gps'
import { rateLimit } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const key = auth.replace(/^Bearer\s+/i, '').trim()
  if (!key) return NextResponse.json({ error: 'Chave de dispositivo ausente (header Authorization: Bearer <apiKey>).' }, { status: 401 })

  if (!rateLimit(`ingest:${key}`, 600, 60_000))
    return NextResponse.json({ error: 'Rate limit de ingestão excedido.' }, { status: 429 })

  const device = await db.gpsDevice.findUnique({ where: { apiKey: key } })
  if (!device) return NextResponse.json({ error: 'Chave inválida ou dispositivo desactivado.' }, { status: 401 })
  if (device.status === 'INACTIVE') return NextResponse.json({ error: 'Dispositivo inactivo.' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })

  const adapter = adapters[device.protocol ?? 'generic-json'] ?? adapters['generic-json']
  const validation = adapter.validate ? adapter.validate(body) : { ok: true }
  if (!validation.ok) return NextResponse.json({ error: `Payload rejeitado: ${validation.error}` }, { status: 400 })

  let points: NormalizedPoint[] = []
  try {
    points = adapter.parse(body)
  } catch (e) {
    return NextResponse.json({ error: `Falha ao normalizar payload: ${e instanceof Error ? e.message : e}` }, { status: 400 })
  }
  if (points.length === 0) return NextResponse.json({ error: 'Nenhum ponto no payload.' }, { status: 400 })
  if (points.length > 2000) return NextResponse.json({ error: 'Lote demasiado grande (máx. 2000 pontos).' }, { status: 413 })

  // Vínculo à viagem activa do veículo, se existir
  const trip = device.vehicleId
    ? await db.trip.findFirst({ where: { vehicleId: device.vehicleId, status: { in: ['IN_TRANSIT', 'PAUSED', 'AUTHORIZED_DEPARTURE'] } } })
    : null

  const result = await ingestPoints(device.companyId, { id: device.id, serial: device.serial, vehicleId: device.vehicleId, protocol: device.protocol, status: device.status }, points)
  if (trip) {
    await db.gpsPoint.updateMany({
      where: { deviceId: device.id, tripId: null, gnssTime: { gte: trip.departureAt ?? trip.plannedStart } },
      data: { tripId: trip.id },
    })
  }
  return NextResponse.json({
    ok: true, adapter: adapter.id,
    ...result,
    note: 'Pontos duplicados (mesma seq) são ignorados - reenvio seguro.',
  })
}

/** GET - documentação viva do contrato de ingestão. */
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/gps/ingest',
    auth: 'Authorization: Bearer <apiKey do dispositivo>',
    protocol_adapters_disponiveis: Object.keys(adapters),
    exemplo_payload: {
      points: [{
        deviceSerial: 'TLT-001',
        lat: -19.8436, lng: 34.8389,
        speedKmh: 62, heading: 270, accuracyM: 8,
        gnssTime: '2026-10-27T14:00:00.000Z',
        seq: 10231, ignition: true, fixQuality: '3D',
        powerEvent: null,
      }],
    },
    regras: [
      'seq incremental por dispositivo - reenvios do mesmo seq são deduplicados',
      'gnssTime = hora original do satélite; pontos atrasados são aceites e marcados isHistoric',
      'powerEvent: MAIN_LOST | MAIN_RESTORED | LOW_BATTERY | TAMPER - gera alerta crítico',
      'lote máximo: 2000 pontos por pedido',
    ],
  })
}
