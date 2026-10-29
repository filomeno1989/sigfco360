// SIGFCO - Histórico de trajecto: ordem cronológica preservada,
// pontos históricos e atrasados distinguíveis; paginação obrigatória
import { withAuth, jsonOk, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const sp = req.nextUrl.searchParams
  const deviceId = sp.get('deviceId')
  const vehicleId = sp.get('vehicleId')
  const tripId = sp.get('tripId')
  const from = sp.get('from') ? new Date(sp.get('from')!) : new Date(Date.now() - 24 * 3600_000)
  const to = sp.get('to') ? new Date(sp.get('to')!) : new Date()
  const page = Math.max(1, Number(sp.get('page') ?? 1))
  const pageSize = Math.min(2000, Math.max(50, Number(sp.get('pageSize') ?? 500)))

  if (!deviceId && !vehicleId && !tripId) return jsonOk({ points: [], total: 0, note: 'Indique deviceId, vehicleId ou tripId.' })

  const where = {
    companyId,
    gnssTime: { gte: from, lte: to },
    ...(deviceId ? { deviceId } : {}),
    ...(vehicleId ? { vehicleId } : {}),
    ...(tripId ? { tripId } : {}),
  }
  const [total, points] = await Promise.all([
    db.gpsPoint.count({ where }),
    db.gpsPoint.findMany({
      where, orderBy: { gnssTime: 'asc' }, skip: (page - 1) * pageSize, take: pageSize,
      select: { id: true, lat: true, lng: true, speedKmh: true, heading: true, accuracyM: true, gnssTime: true, receivedTime: true, source: true, seq: true, isHistoric: true, qualityFlags: true, ignition: true, fixQuality: true },
    }),
  ])
  return jsonOk({ points, total, page, pageSize })
}, { perm: 'gps.view' })
