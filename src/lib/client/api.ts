// SIGFCO — Cliente HTTP da interface: erros legíveis, sem segredos no
// cliente (DEV-007). Todas as chamadas usam caminhos relativos.
export class ApiError extends Error {
  status: number
  payload: Record<string, unknown>
  constructor(status: number, message: string, payload?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.payload = payload ?? {}
  }
}

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}
): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? 'GET',
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    cache: 'no-store',
  })
  const text = await res.text()
  let data: Record<string, unknown> = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }
  if (!res.ok) {
    throw new ApiError(res.status, (data.error as string) ?? `Erro ${res.status}`, data)
  }
  return data as T
}

export const fmtMT = (minor: number | null | undefined, ccy = 'MZN') => {
  if (minor === null || minor === undefined) return '—'
  try { return new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: ccy }).format(minor / 100) }
  catch { return `${ccy} ${(minor / 100).toFixed(2)}` }
}

export const parseMT = (s: string): number => {
  const cleaned = s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  return Math.round(Number(cleaned) * 100)
}

export const fmtData = (d?: string | Date | null, comHora = false) => {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  try {
    return date.toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: comHora ? 'short' : undefined, timeZone: 'Africa/Maputo' })
  } catch { return date.toISOString().slice(0, 16).replace('T', ' ') }
}

export const idadeMin = (d?: string | Date | null) => {
  if (!d) return null
  return Math.round((Date.now() - new Date(d).getTime()) / 60_000)
}
