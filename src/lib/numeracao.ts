// =====================================================================
// SIGFCO — Numeração única por empresa (FR-005) e parâmetros (FR-003)
// Contadores transaccionais evitam colisões multiutilizador/multiempresa.
// =====================================================================
import 'server-only'
import { db } from '@/lib/db'

export async function nextCode(companyId: string, key: 'trip' | 'expense' | 'workorder' | 'incident'): Promise<string> {
  return db.$transaction(async (tx) => {
    const counter = await tx.counter.upsert({
      where: { companyId_key: { companyId, key } },
      create: { companyId, key, value: 1 },
      update: { value: { increment: 1 } },
    })
    const year = new Date().getFullYear()
    const prefix = { trip: 'VIA', expense: 'DESP', workorder: 'OS', incident: 'INC' }[key]
    return `${prefix}-${year}-${String(counter.value).padStart(5, '0')}`
  })
}

// ------------------------- Parâmetros (FR-003) -----------------------
// Valores por defeito propostos pelo SRS; alteráveis por empresa SEM
// alteração de código. Guardados em Setting.valueJson.
export const SETTING_DEFAULTS = {
  gps_moving_seconds: 45,          // GPS-010: 30-60s em movimento
  gps_stopped_seconds: 300,        // GPS-010: 5min parado
  gps_stale_minutes: 20,           // GPS-012: limiar "sem comunicação"
  gps_delayed_minutes: 5,          // GPS-012: limiar "atrasado"
  long_stop_minutes: 120,          // GPS-023: paragem prolongada
  route_deviation_km: 15,          // GPS-021: tolerância de desvio
  budget_alert_pct: 80,            // FIN-011
  duplicate_window_minutes: 240,   // FR-058
  duplicate_radius_m: 2000,        // FR-058
  require_receipt_categories: ['combustivel', 'portagens', 'alfandega'],
  speed_limit_default_kmh: 100,    // GPS-025 (configurável por empresa/rota)
  photo_max_width: 1280,           // AT-011
  photo_jpeg_quality: 0.72,
} as const

export type SettingKey = keyof typeof SETTING_DEFAULTS

export async function getSettings(companyId: string): Promise<Record<string, unknown>> {
  const rows = await db.setting.findMany({ where: { companyId } })
  const out: Record<string, unknown> = { ...SETTING_DEFAULTS }
  for (const r of rows) {
    try { out[r.key] = JSON.parse(r.valueJson) } catch { out[r.key] = r.valueJson }
  }
  return out
}

export async function getSetting<T>(companyId: string, key: SettingKey): Promise<T> {
  const row = await db.setting.findUnique({ where: { companyId_key: { companyId, key } } })
  if (!row) return SETTING_DEFAULTS[key] as unknown as T
  try { return JSON.parse(row.valueJson) as T } catch { return row.valueJson as unknown as T }
}

export async function setSetting(companyId: string, key: string, value: unknown) {
  await db.setting.upsert({
    where: { companyId_key: { companyId, key } },
    create: { companyId, key, valueJson: JSON.stringify(value) },
    update: { valueJson: JSON.stringify(value) },
  })
}
