// SIGFCO - Perfil corrente (me): base de toda a autorização no cliente
import { withAuth, jsonOk } from '@/lib/api'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx }) => {
  const company = ctx.user.companyId ? await db.company.findUnique({ where: { id: ctx.user.companyId } }) : null
  const unread = await db.notification.count({
    where: { OR: [{ userId: ctx.user.id }, { userId: null }], readAt: null, ...(company ? { companyId: company.id } : {}) },
  })
  const driver = ctx.user.driverId ? await db.driver.findUnique({ where: { id: ctx.user.driverId } }) : null
  return jsonOk({
    user: {
      id: ctx.user.id, name: ctx.user.name, email: ctx.user.email, role: ctx.user.role,
      companyId: ctx.user.companyId, branchId: ctx.user.branchId, driverId: ctx.user.driverId,
    },
    company: company && {
      id: company.id, name: company.name, currencyBase: company.currencyBase,
      timezone: company.timezone, locale: company.locale, isDemo: company.isDemo,
    },
    driver: driver && { id: driver.id, name: driver.name, code: driver.code },
    unreadNotifications: unread,
  })
})
