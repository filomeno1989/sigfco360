// =====================================================================
// SIGFCO - Ambiente DEMO
// Semeia uma empresa de DEMONSTRAÇÃO (isDemo=true) claramente
// identificada e alimenta o SIMULADOR de telemetria (fonte=SIMULATOR).
// NADA disto é apresentado como operação real: a UI marca DEMO em todos
// os ecrãs afectados. Em produção, a empresa real é criada limpa.
// =====================================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { rateLimit } from '@/lib/api'
import { ensureSystemChecklistItems } from '@/lib/viagem'

export const dynamic = 'force-dynamic'

// O ambiente de demonstração só existe em servidores que o autorizam
// (variável SIGFCO_DEMO=1). Em produção fica desactivado por defeito.
const DEMO_ENABLED = process.env.SIGFCO_DEMO === '1'

const DEMO_POINTS = [
  // Corredor Beira → Mutare (EN6) com pontos de fronteira
  { nome: 'Porto da Beira', lat: -19.8325, lng: 34.8389, tipo: 'porto' },
  { nome: 'EN6 km 14', lat: -19.7800, lng: 34.8600, tipo: 'checkpoint' },
  { nome: 'Dondo', lat: -19.6120, lng: 34.7430, tipo: 'posto' },
  { nome: 'Inchope (cruzamento)', lat: -18.9500, lng: 34.5100, tipo: 'checkpoint' },
  { nome: 'Chimoio', lat: -19.1164, lng: 33.4833, tipo: 'cidade' },
  { nome: 'Manica', lat: -18.9283, lng: 32.9733, tipo: 'cidade' },
  { nome: 'Fronteira Machipanda (Forbes)', lat: -18.9600, lng: 32.7500, tipo: 'fronteira' },
  { nome: 'Mutare', lat: -18.9707, lng: 32.6709, tipo: 'cidade' },
  { nome: 'Harare (Mbare)', lat: -17.8600, lng: 31.0400, tipo: 'cliente' },
]

export async function POST(req: NextRequest) {
  if (!DEMO_ENABLED) {
    return NextResponse.json({ error: 'Ambiente de demonstração desactivado neste servidor.' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const action = body.action as string

  if (action === 'seed' || !action) {
    if (!rateLimit('demo-seed', 3, 300_000)) return NextResponse.json({ error: 'Aguarde antes de voltar a semear.' }, { status: 429 })
    const existing = await db.company.findFirst({ where: { isDemo: true } })
    if (existing) return NextResponse.json({ ok: true, alreadySeeded: true, companyId: existing.id })

    // -------- Empresa DEMO --------
    const company = await db.company.create({
      data: {
        name: 'Transportadora Corredor DEMO',
        legalName: 'Transportadora Corredor da Beira (DEMONSTRAÇÃO)',
        nuit: '400000000',
        address: 'Av. das FPLM 123, Beira, Moçambique',
        phone: '+258 84 000 0000',
        email: 'demo@sigfco.mz',
        currencyBase: 'MZN', timezone: 'Africa/Maputo', locale: 'pt-MZ',
        isDemo: true,
      },
    })

    await db.branch.create({ data: { companyId: company.id, name: 'Beira - Sede', address: 'Porto da Beira', lat: -19.8325, lng: 34.8389 } })
    await db.branch.create({ data: { companyId: company.id, name: 'Chimoio - Filial', address: 'Chimoio', lat: -19.1164, lng: 33.4833 } })

    // -------- Utilizadores DEMO (um por perfil) --------
    const pwd = hashPassword('Sigfco2026!')
    const users = [
      { name: 'Director Geral (DEMO)', email: 'director@demo.sigfco', role: 'COMPANY_ADMIN' },
      { name: 'Gestor de Frota (DEMO)', email: 'frota@demo.sigfco', role: 'FLEET_MANAGER' },
      { name: 'Despachante (DEMO)', email: 'despacho@demo.sigfco', role: 'DISPATCHER' },
      { name: 'Financeiro (DEMO)', email: 'financas@demo.sigfco', role: 'FINANCE' },
      { name: 'Mecânico (DEMO)', email: 'mecanico@demo.sigfco', role: 'MECHANIC' },
      { name: 'Auditor (DEMO)', email: 'auditor@demo.sigfco', role: 'AUDITOR' },
    ]
    for (const u of users) {
      await db.user.create({ data: { companyId: company.id, name: u.name, email: u.email, passwordHash: pwd, role: u.role, isDemo: true } })
    }

    // Motoristas DEMO + utilizador motorista
    const driver = await db.driver.create({
      data: { companyId: company.id, code: 'MTR-001', name: 'João Macuácua (DEMO)', phone: '+258 84 111 1111', licenseNumber: 'MZ-123456', licenseCategory: 'C1', licenseExpiry: new Date('2028-06-30'), licenseCountry: 'MZ', status: 'ACTIVE' },
    })
    const driver2 = await db.driver.create({
      data: { companyId: company.id, code: 'MTR-002', name: 'Arsénio Chivite (DEMO)', phone: '+258 82 222 2222', licenseNumber: 'MZ-223456', licenseCategory: 'C', licenseExpiry: new Date(Date.now() + 20 * 86400_000), licenseCountry: 'MZ', status: 'ACTIVE' },
    })
    await db.driver.create({
      data: { companyId: company.id, code: 'MTR-003', name: 'Carlos Bila (DEMO)', phone: '+258 86 333 3333', licenseNumber: 'MZ-323456', licenseCategory: 'C1', licenseExpiry: new Date(Date.now() - 5 * 86400_000), licenseCountry: 'MZ', status: 'ACTIVE' }, // carta expirada → inelegível
    })
    await db.user.create({
      data: { companyId: company.id, name: 'João Macuácua - Motorista (DEMO)', email: 'motorista@demo.sigfco', passwordHash: pwd, role: 'DRIVER', driverId: driver.id, isDemo: true },
    })

    // -------- Frota DEMO --------
    const truck1 = await db.vehicle.create({
      data: { companyId: company.id, plate: 'AAH123MZ', brand: 'Scania', model: 'R420', year: 2019, vin: 'YS2R4X20005412345', type: 'TRUCK', axleConfig: '6x4', cargoCapacityKg: 30000, tankCapacityL: 500, fuelType: 'DIESEL', odometerKm: 482300, refConsumption: 34, tareKg: 9200, isDemo: true },
    })
    const truck2 = await db.vehicle.create({
      data: { companyId: company.id, plate: 'BBH456MZ', brand: 'MAN', model: 'TGS 33.480', year: 2021, vin: 'WMA06XZZ7CP012345', type: 'TRUCK', axleConfig: '6x4', cargoCapacityKg: 32000, tankCapacityL: 600, fuelType: 'DIESEL', odometerKm: 210450, refConsumption: 32, tareKg: 9500, isDemo: true },
    })
    await db.vehicle.create({
      data: { companyId: company.id, plate: 'CCH789MZ', brand: 'Volvo', model: 'FH16', year: 2017, vin: 'YV2RT40A8FA987654', type: 'TRUCK', axleConfig: '6x2', cargoCapacityKg: 26000, tankCapacityL: 450, fuelType: 'DIESEL', odometerKm: 756900, refConsumption: 36, tareKg: 8800, isDemo: true },
    })
    await db.trailer.create({ data: { companyId: company.id, plate: 'RB100MZ', type: 'TRAILER', brand: 'Krone', capacityKg: 34000 } })

    // -------- Rastreadores DEMO --------
    const dev1 = await db.gpsDevice.create({
      data: { companyId: company.id, serial: 'TLT-DEMO-001', imei: '860001051234567', vendor: '', protocol: 'generic-json', simNumber: '+258 84 555 0001', status: 'OPERATIONAL', vehicleId: truck1.id, apiKey: 'gps_demo0000000000000000000000000001', installedAt: new Date('2026-01-10'), installedBy: 'Fornecedor GPS (a homologar)' },
    })
    const dev2 = await db.gpsDevice.create({
      data: { companyId: company.id, serial: 'TLT-DEMO-002', imei: '860001051234568', vendor: '', protocol: 'generic-json', simNumber: '+258 84 555 0002', status: 'OPERATIONAL', vehicleId: truck2.id, apiKey: 'gps_demo0000000000000000000000000002' },
    })
    await db.gpsDevice.create({
      data: { companyId: company.id, serial: 'TLT-DEMO-003', imei: '860001051234569', vendor: '', protocol: 'generic-json', status: 'NO_NETWORK', vehicleId: null, apiKey: 'gps_demo0000000000000000000000000003' },
    })
    await db.deviceAssignment.create({ data: { companyId: company.id, deviceId: dev1.id, vehicleId: truck1.id, fromAt: new Date('2026-01-10'), note: 'Instalação inicial (DEMO)' } })

    // -------- Geofences --------
    const fences = [
      { name: 'Porto da Beira - Terminal', type: 'PORT', lat: -19.8325, lng: 34.8389, radiusM: 1500 },
      { name: 'Base Beira', type: 'BASE', lat: -19.8200, lng: 34.8500, radiusM: 500 },
      { name: 'Fronteira Machipanda', type: 'BORDER', lat: -18.9600, lng: 32.7500, radiusM: 1000 },
      { name: 'Cliente Harare', type: 'CUSTOMER', lat: -17.8600, lng: 31.0400, radiusM: 800 },
      { name: 'Posto Inchope', type: 'FUEL', lat: -18.9500, lng: 34.5100, radiusM: 300 },
    ]
    for (const f of fences) await db.geofence.create({ data: { companyId: company.id, ...f } })

    // -------- Checklist DEMO --------
    const items = ensureSystemChecklistItems([
      { key: 'pneus', label: 'Pneus: estado e pressão visualmente OK', blocking: true, category: 'mecanica' },
      { key: 'travoes', label: 'Travões / inspecção visual de travagem', blocking: true, category: 'mecanica' },
      { key: 'luzes', label: 'Luzes e sinalização a funcionar', blocking: false, category: 'mecanica' },
      { key: 'combustivel_inicial', label: 'Combustível inicial suficiente para o plano', blocking: false, category: 'operacional' },
      { key: 'documentos', label: 'Documentos do veículo e do motorista a bordo', blocking: true, category: 'documentacao' },
      { key: 'carga_selada', label: 'Carga conforme manifesto e selada (quando aplicável)', blocking: false, category: 'operacional' },
      { key: 'extintor', label: 'Extintor e itens de segurança exigidos', blocking: true, category: 'seguranca' },
      { key: 'telemovel', label: 'Telemóvel de trabalho carregado e com saldo/dados', blocking: true, category: 'comunicacoes' },
    ])
    await db.checklistTemplate.create({ data: { companyId: company.id, name: 'Checklist padrão - camião pesado (DEMO)', itemsJson: JSON.stringify(items), active: true } })

    // -------- Taxas de câmbio DEMO --------
    await db.exchangeRate.create({ data: { companyId: company.id, fromCcy: 'USD', toCcy: 'MZN', rate: '63.85', source: 'MANUAL', note: 'Taxa DEMO definida manualmente - substituir por fonte real.' } })
    await db.exchangeRate.create({ data: { companyId: company.id, fromCcy: 'ZAR', toCcy: 'MZN', rate: '3.48', source: 'MANUAL', note: 'Taxa DEMO definida manualmente.' } })
    await db.exchangeRate.create({ data: { companyId: company.id, fromCcy: 'ZWG', toCcy: 'MZN', rate: '4.95', source: 'MANUAL', note: 'Taxa DEMO definida manualmente.' } })

    // -------- Per diem DEMO --------
    await db.perDiemRule.create({ data: { companyId: company.id, country: 'MZ', amountMinor: 80000, currency: 'MZN' } })
    await db.perDiemRule.create({ data: { companyId: company.id, country: 'ZW', city: 'Harare', amountMinor: 4000, currency: 'USD' } })
    await db.perDiemRule.create({ data: { companyId: company.id, country: 'MW', amountMinor: 3500, currency: 'USD' } })

    // -------- Documentos DEMO --------
    await db.documentItem.create({ data: { companyId: company.id, ownerType: 'VEHICLE', vehicleId: truck1.id, type: 'seguro', number: 'SEGURO-2026-001', issuerCountry: 'MZ', issuedAt: new Date('2026-01-15'), expiresAt: new Date('2027-01-15'), blocking: true } })
    await db.documentItem.create({ data: { companyId: company.id, ownerType: 'VEHICLE', vehicleId: truck1.id, type: 'inspecao', number: 'INSP-2026-001', issuerCountry: 'MZ', issuedAt: new Date('2026-04-01'), expiresAt: new Date(Date.now() + 45 * 86400_000), blocking: true } })
    await db.documentItem.create({ data: { companyId: company.id, ownerType: 'VEHICLE', vehicleId: truck2.id, type: 'autorizacao_transfronteira', number: 'CD-2026-014', issuerCountry: 'MZ', issuedAt: new Date('2026-02-01'), expiresAt: new Date(Date.now() - 3 * 86400_000), blocking: true, notes: 'DEMO: expirado de propósito para demonstrar bloqueio.' } })
    await db.documentItem.create({ data: { companyId: company.id, ownerType: 'DRIVER', driverId: driver.id, type: 'carta_conducao', number: 'MZ-123456', issuerCountry: 'MZ', expiresAt: new Date('2028-06-30'), blocking: true } })

    // -------- Manutenção DEMO --------
    await db.maintenancePlan.create({ data: { companyId: company.id, vehicleId: truck1.id, serviceType: 'oleo', intervalKm: 15000, lastDoneKm: 475000, thresholdKm: 2000 } })
    await db.maintenancePlan.create({ data: { companyId: company.id, vehicleId: truck2.id, serviceType: 'travoes', intervalKm: 60000, lastDoneKm: 180000, thresholdKm: 5000 } })
    const wo = await db.workOrder.create({
      data: { companyId: company.id, code: 'OS-DEMO-00001', vehicleId: truck2.id, type: 'CORRECTIVE', symptom: 'Ruído no eixo traseiro em curva fechada', priority: 'HIGH', critical: true, blocksVehicle: true, workshop: 'Oficina Central (DEMO)', status: 'IN_PROGRESS', odometerKm: 210450 },
    })

    // -------- Pneus DEMO --------
    const t1 = await db.tire.create({ data: { companyId: company.id, serial: 'PIRE-889001', brand: 'Pirelli', model: 'FH86', size: '315/80 R22.5', status: 'INSTALLED', vehicleId: truck1.id, position: 'E1', installedAt: new Date('2026-03-01'), installedOdoKm: 470000 } })
    await db.tireEvent.create({ data: { companyId: company.id, tireId: t1.id, type: 'INSTALL', vehicleId: truck1.id, position: 'E1', odoKm: 470000, date: new Date('2026-03-01'), note: 'DEMO' } })

    // -------- Telemetria inicial DEMO (fonte=SIMULATOR, identificada) --------
    for (let i = 0; i < DEMO_POINTS.length; i++) {
      const p = DEMO_POINTS[i]
      await db.gpsPoint.create({
        data: {
          companyId: company.id, deviceId: dev1.id, vehicleId: truck1.id,
          lat: p.lat + (Math.random() - 0.5) * 0.002, lng: p.lng + (Math.random() - 0.5) * 0.002,
          speedKmh: 55 + Math.round(Math.random() * 25), heading: 270, accuracyM: 6 + Math.round(Math.random() * 8),
          gnssTime: new Date(Date.now() - (DEMO_POINTS.length - i) * 8 * 60_000),
          source: 'SIMULATOR', seq: 1000 + i, ignition: true, fixQuality: '3D', isHistoric: i < DEMO_POINTS.length - 3,
        },
      })
    }
    await db.gpsPoint.create({
      data: { companyId: company.id, deviceId: dev2.id, vehicleId: truck2.id, lat: -19.8255, lng: 34.8420, speedKmh: 0, heading: 0, accuracyM: 5, gnssTime: new Date(Date.now() - 15 * 60_000), source: 'SIMULATOR', seq: 2000, ignition: false, fixQuality: '3D', isHistoric: true },
    })

    return NextResponse.json({ ok: true, companyId: company.id, note: 'Dados DEMO criados. Credenciais demo listadas no ecrã de login. Telemetria marcada como SIMULATOR.' })
  }

  // ------------------------- Simulador DEMO -------------------------
  if (action === 'simulator-tick') {
    // Move o camião DEMO ao longo do corredor Beira→Harare e ingere pontos
    // pela MESMA via do adaptador (fonte SIMULATOR - nunca apresentada como real).
    const company = await db.company.findFirst({ where: { isDemo: true } })
    if (!company) return NextResponse.json({ error: 'Sem ambiente DEMO semeado.' }, { status: 400 })
    const dev = await db.gpsDevice.findFirst({ where: { companyId: company.id, serial: 'TLT-DEMO-001' } })
    if (!dev) return NextResponse.json({ error: 'Dispositivo DEMO ausente.' }, { status: 404 })

    const last = await db.gpsPoint.findFirst({ where: { deviceId: dev.id }, orderBy: { seq: 'desc' } })
    const seq = (last?.seq ?? 999) + 1
    const idx = seq % DEMO_POINTS.length
    const cur = DEMO_POINTS[idx]
    const gnssTime = new Date()
    const receivedAt = new Date(gnssTime.getTime() + Math.random() * 90_000) // latência realista

    // cerca de 25% das vezes simula perda de rede: ponto entra como histórico/atrasado
    const netLoss = Math.random() < 0.25
    const simTime = netLoss ? new Date(Date.now() - (3 + Math.random() * 25) * 60_000) : gnssTime

    const point = await db.gpsPoint.create({
      data: {
        companyId: company.id, deviceId: dev.id, vehicleId: dev.vehicleId,
        lat: cur.lat + (Math.random() - 0.5) * 0.003, lng: cur.lng + (Math.random() - 0.5) * 0.003,
        speedKmh: cur.tipo === 'porto' || cur.tipo === 'fronteira' ? 0 : 50 + Math.round(Math.random() * 30),
        heading: Math.round(Math.random() * 359), accuracyM: 5 + Math.round(Math.random() * 10),
        gnssTime: simTime, source: 'SIMULATOR', seq, ignition: true, fixQuality: '3D',
        isHistoric: netLoss,
      },
    })
    await db.gpsDevice.update({ where: { id: dev.id }, data: { lastPointAt: point.gnssTime } })
    await NextResponse.json // noop para lint
    return NextResponse.json({ ok: true, point: { lat: point.lat, lng: point.lng, gnssTime: point.gnssTime, isHistoric: point.isHistoric, local: cur.nome }, note: 'Ponto DEMO (fonte SIMULATOR) - não é telemetria real.' })
  }

  return NextResponse.json({ error: 'Acção desconhecida.' }, { status: 400 })
}

export async function GET() {
  if (!DEMO_ENABLED) return NextResponse.json({ enabled: false, seeded: false })
  const company = await db.company.findFirst({ where: { isDemo: true } })
  return NextResponse.json({ enabled: true, seeded: Boolean(company), companyId: company?.id ?? null })
}
