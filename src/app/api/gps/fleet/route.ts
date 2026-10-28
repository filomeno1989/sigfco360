// SIGFCO — Mapa da frota: último ponto + frescura inequívoca (GPS-012, GPS-020)
import { withAuth, jsonOk, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'
import { computeFreshness } from '@/lib/gps'
import { getSetting } from '@/lib/numeracao'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const [staleMinutes, delayedMinutes] = await Promise.all([
    getSetting<number>(companyId, 'gps_stale_minutes'),
    getSetting<number>(companyId, 'gps_delayed_minutes'),
  ])

  const devices = await db.gpsDevice.findMany({
    where: { companyId, vehicleId: { not: null } },
    include: { },
  })

  const fleet = await Promise.all(devices.map(async (d) => {
    const vehicle = d.vehicleId ? await db.vehicle.findUnique({ where: { id: d.vehicleId } }) : null
    const driverTrip = vehicle ? await db.trip.findFirst({
      where: { companyId, vehicleId: vehicle.id, status: { in: ['IN_TRANSIT', 'PAUSED', 'AUTHORIZED_DEPARTURE'] } },
      include: { driver: true },
    }) : null
    const last = await db.gpsPoint.findFirst({ where: { deviceId: d.id }, orderBy: { gnssTime: 'desc' } })
    const freshness = last
      ? computeFreshness(last.gnssTime, staleMinutes, delayedMinutes, last.isHistoric)
      : 'NO_COMMUNICATION'
    return {
      deviceId: d.id,
      serial: d.serial,
      deviceStatus: d.status,
      vehicle: vehicle && { id: vehicle.id, plate: vehicle.plate, status: vehicle.status },
      driver: driverTrip ? { id: driverTrip.driver.id, name: driverTrip.driver.name } : null,
      trip: driverTrip ? { id: driverTrip.id, code: driverTrip.code, status: driverTrip.status, origin: driverTrip.origin, destination: driverTrip.destination } : null,
      lastPoint: last && {
        lat: last.lat, lng: last.lng, speedKmh: last.speedKmh, heading: last.heading,
        gnssTime: last.gnssTime, receivedTime: last.receivedTime,
        source: last.source, qualityFlags: last.qualityFlags,
        ageMinutes: Math.round((Date.now() - last.gnssTime.getTime()) / 60000),
      },
      freshness,
      lastPointAt: d.lastPointAt,
    }
  }))

  return jsonOk({ fleet, thresholds: { staleMinutes, delayedMinutes }, serverTime: new Date().toISOString() })
}, { perm: 'gps.view' })
