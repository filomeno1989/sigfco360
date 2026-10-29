// =====================================================================
// SIGFCO - Sincronização offline do motorista
// Recebe a fila do dispositivo: cada item tem clientUuid (idempotency
// key); responde item a item com ACK/ERRO. O cliente só remove do
// IndexedDB após ACK durável. Server revalida tudo:
// guardado offline ≠ aprovado automaticamente.
// =====================================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSession, SESSION_COOKIE } from '@/lib/auth'
import { rateLimit } from '@/lib/api'
import { detectDuplicate } from '@/lib/financeiro'
import { resolveRate, convert } from '@/lib/money'
import { EXPENSE_CATEGORIES } from '@/lib/constantes'

export const dynamic = 'force-dynamic'

type QueueItem = {
  clientUuid: string
  type: 'EXPENSE' | 'INCIDENT' | 'TRIP_EVENT' | 'FUEL_LOG' | 'GPS_MOBILE'
  deviceTime: string
  payload: Record<string, unknown>
}

type Ack = { clientUuid: string; ok: boolean; id?: string; error?: string; duplicate?: unknown }

export async function POST(req: NextRequest) {
  const session = await resolveSession(req.cookies.get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ error: 'Sessão inválida - volte a autenticar para sincronizar.' }, { status: 401 })
  const user = session.user
  const companyId = user.companyId
  if (!companyId) return NextResponse.json({ error: 'Utilizador sem empresa.' }, { status: 400 })

  if (!rateLimit(`sync:${user.id}`, 60, 60_000))
    return NextResponse.json({ error: 'Sincronização em excesso - tente novamente dentro de um minuto.' }, { status: 429 })

  const body = await req.json().catch(() => null) as { items?: QueueItem[] } | null
  if (!body?.items || !Array.isArray(body.items)) return NextResponse.json({ error: 'Fila inválida.' }, { status: 400 })
  if (body.items.length > 100) return NextResponse.json({ error: 'Máximo 100 itens por lote.' }, { status: 413 })

  const acks: Ack[] = []
  const company = await db.company.findUnique({ where: { id: companyId } })
  const base = company?.currencyBase ?? 'MZN'

  for (const item of body.items) {
    try {
      const clientUuid = item.clientUuid
      if (!clientUuid || !item.type) {
        acks.push({ clientUuid: item.clientUuid ?? '?', ok: false, error: 'Item sem clientUuid/tipo.' })
        continue
      }

      // ACK de repetição: item já processado
      const prev = await db.syncRecord.findUnique({ where: { clientUuid: item.clientUuid } })
      if (prev?.status === 'PROCESSED') {
        acks.push({ clientUuid: item.clientUuid, ok: true, id: prev.id })
        continue
      }

      await db.syncRecord.upsert({
        where: { clientUuid: item.clientUuid },
        create: { clientUuid, companyId, userId: user.id, type: item.type, payloadJson: JSON.stringify(item.payload ?? {}), deviceTime: item.deviceTime ? new Date(item.deviceTime) : null },
        update: { attempts: { increment: 1 } },
      })

      let createdId: string | undefined
      let duplicateInfo: unknown

      if (item.type === 'EXPENSE') {
        const p = item.payload as Record<string, number | string>
        const trip = await db.trip.findUnique({ where: { id: String(p.tripId ?? '') } })
        if (!trip || trip.companyId !== companyId) throw new Error('Viagem inválida para o registo.')
        if (['CLOSED', 'CANCELLED'].includes(trip.status)) throw new Error('Viagem fechada - despesa exigirá reabertura autorizada.')
        const category = String(p.category ?? 'outros')
        if (!EXPENSE_CATEGORIES.includes(category as never)) throw new Error('Categoria inválida.')
        const amountMinor = Number(p.amountMinor)
        const currency = String(p.currency ?? 'MZN')
        let convertedMinor: number | null = null
        let rateApplied: string | null = null
        let rateSource: string | null = null
        if (currency !== base) {
          const rate = await resolveRate(companyId, currency, base, base)
          if (!rate) throw new Error(`Sem taxa de câmbio para ${currency} → ${base}. A despesa fica pendente até a taxa existir.`)
          convertedMinor = convert(amountMinor, rate.rate)
          rateApplied = rate.rate
          rateSource = rate.source
        } else convertedMinor = amountMinor

        const dup = await detectDuplicate(companyId, {
          id: 'new', tripId: trip.id, category, amountMinor, currency,
          expenseDate: new Date(String(p.expenseDate ?? item.deviceTime)),
          vendor: (p.vendor as string) || null,
          lat: (p.lat as number) ?? null, lng: (p.lng as number) ?? null,
          fileHash: (p.fileHash as string) || null,
        })

        const created = await db.expense.upsert({
          where: { clientUuid: item.clientUuid },
          create: {
            clientUuid: item.clientUuid, companyId, tripId: trip.id,
            driverId: user.driverId ?? trip.driverId,
            authorUserId: user.id,
            category, amountMinor, currency,
            convertedMinor, baseCurrency: base, rateApplied, rateSource,
            rateDate: currency !== base ? new Date() : null,
            expenseDate: new Date(String(p.expenseDate ?? item.deviceTime)),
            vendor: (p.vendor as string) || null,
            description: (p.description as string) || null,
            paymentMethod: (p.paymentMethod as string) || null,
            odoKm: p.odoKm ? Number(p.odoKm) : null,
            liters: p.liters ? Number(p.liters) : null,
            pricePerLiterMinor: p.pricePerLiterMinor ? Number(p.pricePerLiterMinor) : null,
            fuelType: (p.fuelType as string) || null,
            station: (p.station as string) || null,
            lat: (p.lat as number) ?? null, lng: (p.lng as number) ?? null,
            locSource: (p.locSource as string) || 'BROWSER',
            locPrecisionM: p.locPrecisionM ? Number(p.locPrecisionM) : null,
            locStatus: (p.locStatus as string) || null,
            locNote: (p.locNote as string) || null,
            noReceiptReason: (p.noReceiptReason as string) || null,
            status: 'SUBMITTED',
            duplicateFlag: dup.flag, duplicateOfId: dup.ofId, duplicateScore: dup.score || null,
            code: await (async () => {
              const c = await db.counter.upsert({ where: { companyId_key: { companyId, key: 'expense' } }, create: { companyId, key: 'expense', value: 1 }, update: { value: { increment: 1 } } })
              return `DESP-${new Date().getFullYear()}-${String(c.value).padStart(5, '0')}`
            })(),
          },
          update: {},
        })
        createdId = created.id
        duplicateInfo = dup.flag ? { score: dup.score, reasons: dup.reasons } : undefined
        // fotografia offline anexada quando presente
        if (p.dataUrl) {
          const { saveAttachment, validateUpload } = await import('@/lib/files')
          const crypto = await import('crypto')
          try {
            const m = /^data:([^;]+);base64,(.+)$/.exec(String(p.dataUrl))
            if (m) {
              const buf = Buffer.from(m[2], 'base64')
              const ok = validateUpload(buf, m[1], 'talao.jpg')
              if (ok.ok) {
                const att = await saveAttachment({
                  companyId, kind: 'RECEIPT', expenseId: created.id,
                  file: { buffer: buf, mime: m[1], originalName: 'talao.jpg', hash: crypto.createHash('sha256').update(buf).digest('hex'), size: buf.length },
                  uploadedById: user.id, capturedAt: new Date(String(p.capturedAt ?? item.deviceTime)),
                  width: p.width ? Number(p.width) : undefined, height: p.height ? Number(p.height) : undefined,
                })
                await db.attachment.update({ where: { id: att.id }, data: { expenseId: created.id } })
              }
            }
          } catch { /* foto falha mas despesa fica registada - motorista pode reenviar */ }
        }
      }

      else if (item.type === 'INCIDENT') {
        const p = item.payload as Record<string, number | string>
        const created = await db.incident.upsert({
          where: { clientUuid: item.clientUuid },
          create: {
            clientUuid: item.clientUuid, companyId,
            tripId: (p.tripId as string) || null,
            vehicleId: (p.vehicleId as string) || null,
            driverId: user.driverId ?? null,
            type: String(p.type ?? 'OUTRO'),
            severity: String(p.severity ?? 'MEDIUM'),
            description: String(p.description ?? ''),
            lat: (p.lat as number) ?? null, lng: (p.lng as number) ?? null,
            deviceTime: new Date(item.deviceTime),
            authorUserId: user.id, authorLabel: user.name,
          },
          update: {},
        })
        createdId = created.id
        await db.alert.create({
          data: { companyId, severity: created.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH', type: 'OTHER',
            title: `Ocorrência registada: ${created.type}`,
            message: created.description.slice(0, 300), refType: 'INCIDENT', refId: created.id, tripId: created.tripId, vehicleId: created.vehicleId },
        })
      }

      else if (item.type === 'TRIP_EVENT') {
        const p = item.payload as Record<string, number | string>
        const trip = await db.trip.findUnique({ where: { id: String(p.tripId ?? '') } })
        if (!trip || trip.companyId !== companyId) throw new Error('Viagem inválida.')
        const created = await db.tripEvent.upsert({
          where: { clientUuid: item.clientUuid },
          create: {
            companyId, tripId: trip.id, type: String(p.type ?? 'OTHER'),
            lat: (p.lat as number) ?? null, lng: (p.lng as number) ?? null,
            deviceTime: new Date(item.deviceTime),
            authorUserId: user.id, authorLabel: user.name,
            note: (p.note as string) || null,
            clientUuid: item.clientUuid,
          },
          update: {},
        })
        createdId = created.id
        if (created.type === 'SOS') {
          await db.alert.create({
            data: { companyId, severity: 'CRITICAL', type: 'SOS', title: `SOS na viagem ${trip.code}`,
              message: `Pedido de ajuda sincronizado (hora do dispositivo: ${item.deviceTime}).`, refType: 'TRIP', refId: trip.id, tripId: trip.id, vehicleId: trip.vehicleId },
          })
        }
      }

      else if (item.type === 'GPS_MOBILE') {
        // Fonte secundária etiquetada - nunca fundida sem origem
        const p = item.payload as Record<string, number | string>
        const device = await db.gpsDevice.findFirst({ where: { companyId, vehicleId: String(p.vehicleId ?? '') } })
        const created = await db.gpsPoint.create({
          data: {
            companyId, deviceId: device?.id ?? 'mobile', vehicleId: (p.vehicleId as string) || null,
            lat: Number(p.lat), lng: Number(p.lng),
            speedKmh: p.speedKmh ? Number(p.speedKmh) : null, heading: p.heading ? Number(p.heading) : null,
            accuracyM: p.accuracyM ? Number(p.accuracyM) : null,
            gnssTime: new Date(item.deviceTime),
            source: 'MOBILE', seq: Math.floor(Date.now() / 1000) % 2_000_000_000,
            fixQuality: p.fixQuality ? String(p.fixQuality) : null,
            isHistoric: false,
          },
        })
        createdId = created.id
      }

      await db.syncRecord.update({
        where: { clientUuid: item.clientUuid },
        data: { status: 'PROCESSED', processedAt: new Date() },
      })
      acks.push({ clientUuid: item.clientUuid, ok: true, id: createdId, duplicate: duplicateInfo })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao processar item.'
      await db.syncRecord.updateMany({ where: { clientUuid: item.clientUuid }, data: { status: 'ERROR', error: msg.slice(0, 300) } })
      acks.push({ clientUuid: item.clientUuid, ok: false, error: msg })
    }
  }

  return NextResponse.json({ acks, serverTime: new Date().toISOString() })
}

/** GET - estado da fila do utilizador. */
export async function GET(req: NextRequest) {
  const session = await resolveSession(req.cookies.get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  const records = await db.syncRecord.findMany({
    where: { userId: session.user.id },
    orderBy: { receivedTime: 'desc' },
    take: 100,
    select: { clientUuid: true, type: true, status: true, attempts: true, error: true, deviceTime: true, receivedTime: true },
  })
  return NextResponse.json({ records })
}
