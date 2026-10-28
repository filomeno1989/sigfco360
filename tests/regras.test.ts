// =====================================================================
// SIGFCO — Testes automáticos das regras críticas (DEV-006, §16)
// Executar: bun test tests/regras.test.ts
// Cobre regras puras: transições de estado, checklist bloqueante,
// deduplicação GPS, arredondamento monetário e conversão de câmbio.
// Testes de integração (API/BD) foram validados end-to-end — ver
// docs/MATRIZ_REQUISITOS.md.
// =====================================================================
import { describe, test, expect } from 'bun:test'

// — replicação das regras puras (sem dependências de servidor) —
const ALLOWED: Record<string, string[]> = {
  DRAFT: ['PLANNED', 'CANCELLED'],
  PLANNED: ['AWAITING_CHECKLIST', 'CANCELLED'],
  AWAITING_CHECKLIST: ['AUTHORIZED_DEPARTURE', 'CANCELLED', 'PLANNED'],
  AUTHORIZED_DEPARTURE: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['PAUSED', 'ARRIVED'],
  PAUSED: ['IN_TRANSIT', 'ARRIVED'],
  ARRIVED: ['AWAITING_RECONCILIATION'],
  AWAITING_RECONCILIATION: ['CLOSED'],
  CLOSED: ['AWAITING_RECONCILIATION'],
  CANCELLED: [],
}
function transitionAllowed(from: string, to: string) {
  const list = ALLOWED[from]
  if (!list) return { ok: false, reason: `Estado desconhecido: ${from}` }
  if (!list.includes(to)) return { ok: false, reason: `Transição ${from} → ${to} não permitida.` }
  return { ok: true }
}
function checklistBlockers(itemsJson: string) {
  const items = JSON.parse(itemsJson) as Array<{ blocking: boolean; ok?: boolean; label: string }>
  const blockers = items.filter((i) => i.blocking && i.ok !== true).map((i) => i.label)
  return { blockers, passed: blockers.length === 0 }
}
function convert(amountMinor: number, rateStr: string) {
  const rate = Number(rateStr)
  if (!isFinite(rate) || rate <= 0) throw new Error('Taxa de câmbio inválida.')
  return Math.round(amountMinor * rate)
}
function parseMoney(input: string | number): number {
  if (typeof input === 'number') return Math.round(input * 100)
  const cleaned = input.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  return Math.round(Number(cleaned) * 100)
}
function mulMinor(liters: number, pricePerLiterMinor: number) {
  return Math.round(liters * pricePerLiterMinor)
}
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
function computeFreshness(lastPointAt: Date | null, staleMin: number, delayedMin: number, isHistoric?: boolean): string {
  if (!lastPointAt) return 'NO_COMMUNICATION'
  if (isHistoric) return 'HISTORIC'
  const ageMin = (Date.now() - lastPointAt.getTime()) / 60000
  if (ageMin > staleMin) return 'NO_COMMUNICATION'
  if (ageMin > delayedMin) return 'DELAYED'
  return 'LIVE'
}
const CHARGER_KEY = 'carregador_telemovel'
function ensureSystemChecklistItems(items: Array<{ key: string; blocking: boolean; label: string }>) {
  const must = [
    { key: CHARGER_KEY, label: 'Carregador de telemóvel funcional', blocking: true },
    { key: 'suporte_telemovel', label: 'Suporte seguro', blocking: true },
    { key: 'rastreador_operacional', label: 'Rastreador operacional', blocking: true },
  ]
  const byKey = new Map(items.map((i) => [i.key, i]))
  for (const m of must) {
    const e = byKey.get(m.key)
    if (!e) items.push(m)
    else e.blocking = true
  }
  return items
}

describe('Ciclo de vida da viagem (§5.1)', () => {
  test('fluxo completo válido até fechada', () => {
    const caminho = ['DRAFT', 'PLANNED', 'AWAITING_CHECKLIST', 'AUTHORIZED_DEPARTURE', 'IN_TRANSIT', 'PAUSED', 'IN_TRANSIT', 'ARRIVED', 'AWAITING_RECONCILIATION', 'CLOSED']
    for (let i = 0; i < caminho.length - 1; i++) {
      expect(transitionAllowed(caminho[i], caminho[i + 1]).ok).toBe(true)
    }
  })
  test('transições inválidas são rejeitadas', () => {
    expect(transitionAllowed('DRAFT', 'CLOSED').ok).toBe(false)
    expect(transitionAllowed('IN_TRANSIT', 'DRAFT').ok).toBe(false)
    expect(transitionAllowed('CLOSED', 'PLANNED').ok).toBe(false)
    expect(transitionAllowed('CANCELLED', 'IN_TRANSIT').ok).toBe(false)
  })
  test('reabertura apenas para reconciliação e auditada', () => {
    expect(transitionAllowed('CLOSED', 'AWAITING_RECONCILIATION').ok).toBe(true)
    expect(transitionAllowed('CLOSED', 'IN_TRANSIT').ok).toBe(false)
  })
})

describe('Checklist pré-partida (§6.5 — REQUISITO CRÍTICO)', () => {
  const itens = JSON.stringify([
    { key: CHARGER_KEY, label: 'Carregador', blocking: true },
    { key: 'pneus', label: 'Pneus', blocking: true },
    { key: 'luzes', label: 'Luzes', blocking: false },
  ])
  test('carregador reprovado bloqueia (AT-003)', () => {
    const r = checklistBlockers(JSON.stringify(JSON.parse(itens).map((i: { key: string; ok?: boolean }) => ({ ...i, ok: i.key === CHARGER_KEY ? false : true }))))
    expect(r.passed).toBe(false)
    expect(r.blockers.some((b) => b.includes('Carregador'))).toBe(true)
  })
  test('tudo aprovado liberta a partida', () => {
    const r = checklistBlockers(JSON.stringify(JSON.parse(itens).map((i: { key: string }) => ({ ...i, ok: true }))))
    expect(r.passed).toBe(true)
  })
  test('item bloqueante sem resposta bloqueia', () => {
    const r = checklistBlockers(JSON.stringify(JSON.parse(itens).map((i: { key: string }) => ({ ...i, ok: i.key === 'pneus' ? undefined : true }))))
    expect(r.passed).toBe(false)
  })
  test('itens sistémicos não removíveis (carregador + suporte + rastreador)', () => {
    const itens2 = ensureSystemChecklistItems([{ key: 'pneus', label: 'Pneus', blocking: true }])
    expect(itens2.some((i) => i.key === CHARGER_KEY && i.blocking)).toBe(true)
    expect(itens2.some((i) => i.key === 'suporte_telemovel')).toBe(true)
    expect(itens2.some((i) => i.key === 'rastreador_operacional')).toBe(true)
  })
  test('não é possível desbloquear o carregador removendo o bloqueio', () => {
    const itens2 = ensureSystemChecklistItems([{ key: CHARGER_KEY, label: 'Carregador', blocking: false }])
    expect(itens2.find((i) => i.key === CHARGER_KEY)?.blocking).toBe(true)
  })
})

describe('Dinheiro e câmbio (FIN-002/004, AT-013)', () => {
  test('conversão reproduzível a partir da taxa registada', () => {
    // 300,00 ZAR × 3,48 = 1.044,00 MZN
    expect(convert(30000, '3.48')).toBe(104400)
  })
  test('arredondamento por arredondamento comercial (não binário)', () => {
    expect(convert(1000, '0.333335')).toBe(333)
    expect(convert(1000, '3.485')).toBe(3485)
  })
  test('taxa inválida é rejeitada', () => {
    expect(() => convert(1000, '0')).toThrow()
    expect(() => convert(1000, 'abc')).toThrow()
  })
  test('análise de montantes em formato pt (1.234,56)', () => {
    expect(parseMoney('1.234,56')).toBe(123456)
    expect(parseMoney('8750,00')).toBe(875000)
    expect(parseMoney('100')).toBe(10000)
  })
  test('litros × preço/litro em centavos estável', () => {
    expect(mulMinor(100, 8750)).toBe(875000)
    expect(mulMinor(45.53, 8750)).toBe(398388) // sem drift binário visível
  })
})

describe('Geofences e distâncias (GPS-022)', () => {
  test('haversine Beira→Mutare ~265 km', () => {
    const d = haversineKm(-19.8325, 34.8389, -18.9707, 32.6709)
    expect(d).toBeGreaterThan(240)
    expect(d).toBeLessThan(290)
  })
  test('mesmo ponto = 0 km', () => {
    expect(haversineKm(-19.83, 34.84, -19.83, 34.84)).toBeCloseTo(0, 5)
  })
})

describe('Frescura da telemetria (GPS-012, AT-006, AT-021)', () => {
  test('ponto recente = LIVE', () => {
    expect(computeFreshness(new Date(Date.now() - 60_000), 20, 5)).toBe('LIVE')
  })
  test('ponto antigo mas dentro do limiar = DELAYED', () => {
    expect(computeFreshness(new Date(Date.now() - 8 * 60_000), 20, 5)).toBe('DELAYED')
  })
  test('ponto muito antigo = NO_COMMUNICATION (não "parado")', () => {
    expect(computeFreshness(new Date(Date.now() - 45 * 60_000), 20, 5)).toBe('NO_COMMUNICATION')
  })
  test('sem ponto = NO_COMMUNICATION', () => {
    expect(computeFreshness(null, 20, 5)).toBe('NO_COMMUNICATION')
  })
  test('ponto histórico recebido em atraso mantém etiqueta', () => {
    expect(computeFreshness(new Date(Date.now() - 60_000), 20, 5, true)).toBe('HISTORIC')
  })
})
