// SIGFCO — Normalização de matrículas (FR-010): única no âmbito da empresa
export function normalizePlate(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').trim()
}
