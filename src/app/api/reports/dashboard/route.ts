// SIGFCO - Dashboard e relatórios: indicadores com fonte, período
// e limitações declaradas - pendentes nunca somados como aprovados
import { withAuth, jsonOk, scopeCompanyId } from '@/lib/api'
import { db } from '@/lib/db'
import { getSetting } from '@/lib/numeracao'
import { computeFreshness } from '@/lib/gps'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, req }) => {
  const companyId = scopeCompanyId(ctx, req)
  const now = new Date()
  const in30 = new Date(Date.now() + 30 * 86400_000)
  const staleMinutes = await getSetting<number>(companyId, 'gps_stale_minutes')
  const delayedMinutes = await getSetting<number>(companyId, 'gps_delayed_minutes')

  const [
    vehiclesByStatus, activeTrips, expensesByStatus, alertsOpen, docsExpiring, docsExpired,
    workordersOpen, pendingSync, unreadNotifications, devices, drivers,
  ] = await Promise.all([
    db.vehicle.groupBy({ by: ['status'], _count: { _all: true }, where: { companyId } }),
    db.trip.findMany({
      where: { companyId, status: { in: ['IN_TRANSIT', 'PAUSED', 'ARRIVED', 'AWAITING_RECONCILIATION', 'AUTHORIZED_DEPARTURE'] } },
      include: { vehicle: { select: { plate: true } }, driver: { select: { name: true } } },
      orderBy: { departureAt: 'desc' },
    }),
    db.expense.groupBy({ by: ['status'], _count: { _all: true }, _sum: { convertedMinor: true }, where: { companyId, status: { notIn: ['VOID'] } } }),
    db.alert.groupBy({ by: ['severity'], _count: { _all: true }, where: { companyId, status: 'OPEN' } }),
    db.documentItem.count({ where: { companyId, expiresAt: { gte: now, lte: in30 } } }),
    db.documentItem.count({ where: { companyId, expiresAt: { lt: now }, blocking: true } }),
    db.workOrder.count({ where: { companyId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    db.syncRecord.count({ where: { companyId, status: 'RECEIVED' } }),
    db.notification.count({ where: { companyId, readAt: null } }),
    db.gpsDevice.findMany({ where: { companyId, vehicleId: { not: null } } }),
    db.driver.count({ where: { companyId, status: 'ACTIVE' } }),
  ])

  // Frota por estado GPS
  const fleet = await Promise.all(devices.map(async (d) => {
    const last = await db.gpsPoint.findFirst({ where: { deviceId: d.id }, orderBy: { gnssTime: 'desc' } })
    return { freshness: computeFreshness(last?.gnssTime ?? null, staleMinutes, delayedMinutes, last?.isHistoric), deviceStatus: d.status }
  }))
  const gpsSummary = {
    live: fleet.filter((f) => f.freshness === 'LIVE').length,
    delayed: fleet.filter((f) => f.freshness === 'DELAYED').length,
    noComm: fleet.filter((f) => f.freshness === 'NO_COMMUNICATION').length,
    noPower: fleet.filter((f) => f.deviceStatus === 'NO_POWER' || f.deviceStatus === 'TAMPER_ALERT').length,
  }

  // Despesas: 30 dias, separado pendente/aprovado
  const monthAgo = new Date(Date.now() - 30 * 86400_000)
  const expenseAgg = await db.expense.groupBy({
    by: ['status'],
    _sum: { convertedMinor: true, amountMinor: true },
    _count: { _all: true },
    where: { companyId, expenseDate: { gte: monthAgo } },
  })

  return jsonOk({
    serverTime: now.toISOString(),
    vehiclesByStatus: Object.fromEntries(vehiclesByStatus.map((v) => [v.status, v._count._all])),
    activeTrips: activeTrips.map((t) => ({
      id: t.id, code: t.code, status: t.status, origin: t.origin, destination: t.destination,
      vehicle: t.vehicle?.plate, driver: t.driver?.name, departureAt: t.departureAt, plannedStart: t.plannedStart,
    })),
    expensesByStatus: Object.fromEntries(expensesByStatus.map((e) => [e.status, { count: e._count._all, totalMinor: e._sum.convertedMinor ?? 0 }])),
    alertsBySeverity: Object.fromEntries(alertsOpen.map((a) => [a.severity, a._count._all])),
    indicators: {
      docsExpiring30d: docsExpiring,
      docsExpiredBlocking: docsExpired,
      workordersOpen,
      pendingSyncRecords: pendingSync,
      unreadNotifications,
      activeDrivers: drivers,
      gps: gpsSummary,
      expensesLast30d: Object.fromEntries(expenseAgg.map((e) => [e.status, { count: e._count._all, totalMinor: e._sum.convertedMinor ?? 0 }])),
    },
    dataQualidade: {
      nota: 'Indicadores financeiros distinguem pendentes de aprovados. Tempo sem GPS não é contado como parado.',
    },
  })
}, { anyPerm: ['report.read', 'trip.read'] })
