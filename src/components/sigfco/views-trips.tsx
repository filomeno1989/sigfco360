// =====================================================================
// SIGFCO — Viagens (FR-030..044, §5.1): planeamento com verificação de
// conflitos, checklist pré-partida com carregador obrigatório, eventos,
// orçamento por rubrica/moeda, despesas da viagem e fecho reconciliado
// =====================================================================
'use client'

import * as React from 'react'
import { useApp } from './root'
import { api, fmtData, fmtMT, parseMT } from '@/lib/client/api'
import { Page, Panel, DataTable, StatusBadge, Campo, EntradaTexto, Selecao, Modal, Button, ErroAlerta, Confirmacao, AProcessar, Kpi } from './ui-kit'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, ShieldCheck, ShieldAlert, MapPin, Download } from 'lucide-react'

type Trip = {
  id: string; code: string; client?: string; origin: string; destination: string; status: string
  cargoDesc?: string; cargoRef?: string
  driver: { id: string; name: string }; driverId: string
  vehicle: { id: string; plate: string }; vehicleId: string
  trailer?: { plate: string } | null; trailerId?: string | null
  plannedStart: string; plannedEnd?: string | null; plannedDistanceKm?: number
  departureAt?: string | null; arrivalAt?: string | null; closedAt?: string | null
  startOdometerKm?: number | null; endOdometerKm?: number | null
  budgetMinorTotal?: number; cancelReason?: string | null; isDemo?: boolean
  waypointsJson?: string | null
}
type DriverOpt = { id: string; name: string; eligible: boolean }
type VehicleOpt = { id: string; plate: string; status: string; device?: { id: string } | null }
type ChecklistItem = { key: string; label: string; blocking: boolean; ok?: boolean; note?: string }
type Detail = {
  trip: Trip & { approvedRouteJson?: string | null; closeBlockers?: string | null; notes?: string | null }
  expenses: Array<{ id: string; code: string; category: string; amountMinor: number; currency: string; status: string; expenseDate: string; vendor?: string }>
  incidents: Array<{ id: string; type: string; severity: string; description: string; deviceTime: string }>
  budget: { lines: Array<{ category: string; limitMinor: number; pendingMinor: number; approvedMinor: number; pct: number }>; totalLimit: number; totalPending: number; totalApproved: number; baseCurrency: string; alerts: string[] } | null
  device: { serial: string; status: string } | null
  lastPoint: { lat: number; lng: number; gnssTime: string; source: string } | null
}

const CATS = [
  { value: 'combustivel', label: 'Combustível' }, { value: 'portagens', label: 'Portagens' },
  { value: 'per_diem', label: 'Per diem' }, { value: 'alfandega', label: 'Alfândega' },
  { value: 'taxas', label: 'Taxas' }, { value: 'manutencao_emergencia', label: 'Manutenção de emergência' },
  { value: 'comunicacoes', label: 'Comunicações' }, { value: 'estacionamento', label: 'Estacionamento' },
  { value: 'outros', label: 'Outros' },
]

export function ViagensView() {
  const { sessao } = useApp()
  const [rows, setRows] = React.useState<Trip[]>([])
  const [erro, setErro] = React.useState<string | null>(null)
  const [sel, setSel] = React.useState<string | null>(null)
  const [novo, setNovo] = React.useState(false)
  const isDriver = sessao.user.role === 'DRIVER'

  const carregar = React.useCallback(async () => {
    try { setRows((await api<{ trips: Trip[] }>('/api/trips')).trips); setErro(null) }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar viagens.') }
  }, [])
  React.useEffect(() => { carregar(); const t = setInterval(carregar, 30_000); return () => clearInterval(t) }, [carregar])

  return (
    <Page title="Viagens" subtitle="Do planeamento ao fecho financeiro — ciclo de vida verificado no servidor (§5.1)"
      actions={!isDriver && <Button size="sm" onClick={() => setNovo(true)}><Plus className="mr-1 h-4 w-4" />Nova viagem</Button>}
      demo={sessao.company?.isDemo && !isDriver}>
      <ErroAlerta erro={erro} />
      <Panel>
        <DataTable
          rows={rows} filtro={(t, q) => [t.code, t.origin, t.destination, t.client, t.vehicle?.plate, t.driver?.name].some((s) => s?.toLowerCase().includes(q))}
          filtroPlaceholder="Código, origem, cliente…" onRowClick={(t) => setSel(t.id)}
          columns={[
            { key: 'code', header: 'Código', render: (t) => <span className="font-medium">{t.code}{t.isDemo && <Badge variant="outline" className="ml-1.5 border-amber-500 text-amber-600">DEMO</Badge>}</span> },
            { key: 'rota', header: 'Rota', render: (t) => `${t.origin} → ${t.destination}` },
            { key: 'client', header: 'Cliente', render: (t) => t.client ?? '—', hideOnMobile: true },
            { key: 'recursos', header: 'Veículo / Motorista', render: (t) => <div><div>{t.vehicle?.plate}</div><div className="text-xs text-muted-foreground">{t.driver?.name}</div></div> },
            { key: 'plannedStart', header: 'Início previsto', render: (t) => fmtData(t.plannedStart, true), hideOnMobile: true },
            { key: 'status', header: 'Estado', render: (t) => <StatusBadge estado={t.status} mapa={{}} /> },
          ]} />
      </Panel>

      <NovaViagem open={novo} onOpenChange={setNovo} aoCriar={() => { carregar() }} />
      <TripDetail tripId={sel} onOpenChange={(v) => !v && setSel(null)} aoMudar={carregar} />
    </Page>
  )
}

function NovaViagem({ open, onOpenChange, aoCriar }: { open: boolean; onOpenChange: (v: boolean) => void; aoCriar: () => void }) {
  const [drivers, setDrivers] = React.useState<DriverOpt[]>([])
  const [vehicles, setVehicles] = React.useState<VehicleOpt[]>([])
  const [trailers, setTrailers] = React.useState<Array<{ id: string; plate: string }>>([])
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [rubricas, setRubricas] = React.useState<Array<{ category: string; currency: string; valor: string }>>([])
  const [erro, setErro] = React.useState<string | null>(null)
  const [bloqueios, setBloqueios] = React.useState<string[]>([])
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    Promise.all([
      api<{ drivers: DriverOpt[] }>('/api/drivers'),
      api<{ vehicles: VehicleOpt[] }>('/api/vehicles'),
      api<{ trailers: Array<{ id: string; plate: string }> }>('/api/trailers'),
    ]).then(([d, v, r]) => { setDrivers(d.drivers); setVehicles(v.vehicles); setTrailers(r.trailers) }).catch(() => {})
  }, [open])

  const planejar = async (planned: boolean) => {
    setBusy(true); setErro(null); setBloqueios([])
    try {
      const res = await api<{ trip: Trip; blockers?: string[]; conflicts?: string[] }>('/api/trips', {
        method: 'POST',
        body: {
          ...form,
          status: planned ? 'PLANNED' : 'DRAFT',
          plannedStart: form.plannedStart ? new Date(form.plannedStart).toISOString() : new Date().toISOString(),
          budgetLines: rubricas.filter((r) => r.valor).map((r) => ({ category: r.category, currency: r.currency, limitMinor: parseMT(r.valor) })),
        },
      })
      aoCriar(); onOpenChange(false); setForm({}); setRubricas([])
      if (res.blockers?.length) setBloqueios(res.blockers)
    } catch (e) {
      const err = e as Error & { payload?: { blockers?: string[]; conflicts?: string[] } }
      setErro(err.message)
      const all = [...(err.payload?.blockers ?? []), ...(err.payload?.conflicts ?? [])]
      if (all.length) setBloqueios(all)
    } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Nova viagem" wide
      description="Antes de planear, o sistema verifica automaticamente elegibilidade, documentos, rastreador e conflitos de recursos (FR-032)."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="secondary" disabled={busy} onClick={() => planejar(false)}>Guardar rascunho</Button>
          <Button disabled={busy} onClick={() => planejar(true)}>{busy ? <AProcessar label="A validar…" /> : 'Validar e planear'}</Button>
        </>
      }>
      {erro && <ErroAlerta erro={erro} />}
      {bloqueios.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <b className="flex items-center gap-1.5"><ShieldAlert className="h-4 w-4" /> Bloqueios detectados:</b>
          <ul className="mt-1.5 list-disc pl-5 space-y-0.5">{bloqueios.map((b, i) => <li key={i}>{b}</li>)}</ul>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Cliente / Expedidor"><EntradaTexto value={form.client ?? ''} onChange={(e) => setForm({ ...form, client: e.target.value })} /></Campo>
        <Campo label="Referência da carga"><EntradaTexto value={form.cargoRef ?? ''} onChange={(e) => setForm({ ...form, cargoRef: e.target.value })} /></Campo>
        <Campo label="Origem" required><EntradaTexto value={form.origin ?? 'Porto da Beira'} onChange={(e) => setForm({ ...form, origin: e.target.value })} /></Campo>
        <Campo label="Destino" required hint="Ex.: Harare, Zimbabwe"><EntradaTexto value={form.destination ?? ''} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></Campo>
        <Campo label="Motorista" required hint="Inelegíveis aparecem mas serão bloqueados na validação (FR-021)">
          <Selecao value={form.driverId ?? ''} onChange={(v) => setForm({ ...form, driverId: v })}
            opcoes={[{ value: '', label: 'Seleccionar…' }, ...drivers.map((d) => ({ value: d.id, label: `${d.name}${d.eligible ? '' : ' — INELEGÍVEL'}` }))]} />
        </Campo>
        <Campo label="Veículo" required hint="Precisa de rastreador operacional (GPS-001)">
          <Selecao value={form.vehicleId ?? ''} onChange={(v) => setForm({ ...form, vehicleId: v })}
            opcoes={[{ value: '', label: 'Seleccionar…' }, ...vehicles.map((v) => ({ value: v.id, label: `${v.plate}${v.device ? '' : ' — SEM RASTREADOR'}` }))]} />
        </Campo>
        <Campo label="Reboque"><Selecao value={form.trailerId ?? ''} onChange={(v) => setForm({ ...form, trailerId: v })} opcoes={[{ value: '', label: 'Nenhum' }, ...trailers.map((t) => ({ value: t.id, label: t.plate }))]} /></Campo>
        <Campo label="Carga / descrição"><EntradaTexto value={form.cargoDesc ?? ''} onChange={(e) => setForm({ ...form, cargoDesc: e.target.value })} /></Campo>
        <Campo label="Início previsto" required><EntradaTexto type="datetime-local" value={form.plannedStart ?? ''} onChange={(e) => setForm({ ...form, plannedStart: e.target.value })} /></Campo>
        <Campo label="Fim previsto"><EntradaTexto type="datetime-local" value={form.plannedEnd ?? ''} onChange={(e) => setForm({ ...form, plannedEnd: e.target.value })} /></Campo>
        <Campo label="Distância estimada (km)"><EntradaTexto type="number" value={form.plannedDistanceKm ?? ''} onChange={(e) => setForm({ ...form, plannedDistanceKm: e.target.value })} /></Campo>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <b className="text-sm">Orçamento por rubrica (FR-033/034)</b>
          <Button size="sm" variant="outline" onClick={() => setRubricas([...rubricas, { category: 'combustivel', currency: 'MZN', valor: '' }])}><Plus className="mr-1 h-3.5 w-3.5" />Rubrica</Button>
        </div>
        {rubricas.length === 0 && <p className="text-xs text-muted-foreground">Sem rubricas — pode adicionar depois.</p>}
        {rubricas.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_110px_1fr_auto] gap-2 items-end">
            <Selecao value={r.category} onChange={(v) => setRubricas(rubricas.map((x, j) => j === i ? { ...x, category: v } : x))} opcoes={CATS} />
            <Selecao value={r.currency} onChange={(v) => setRubricas(rubricas.map((x, j) => j === i ? { ...x, currency: v } : x))} opcoes={[{ value: 'MZN', label: 'MZN' }, { value: 'USD', label: 'USD' }, { value: 'ZAR', label: 'ZAR' }, { value: 'ZWG', label: 'ZWG' }]} />
            <EntradaTexto placeholder="Limite (ex.: 15.000,00)" value={r.valor} onChange={(e) => setRubricas(rubricas.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))} />
            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setRubricas(rubricas.filter((_, j) => j !== i))}>×</Button>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function TripDetail({ tripId, onOpenChange, aoMudar }: { tripId: string | null; onOpenChange: (v: boolean) => void; aoMudar: () => void }) {
  const { sessao } = useApp()
  const [detail, setDetail] = React.useState<Detail | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [msg, setMsg] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [confirmar, setConfirmar] = React.useState<{ action: string; titulo: string; mensagem: string; perigo?: boolean; pedirMotivo?: boolean } | null>(null)
  const [odoPartida, setOdoPartida] = React.useState('')
  const [odoChegada, setOdoChegada] = React.useState('')
  const isDriver = sessao.user.role === 'DRIVER'

  const carregar = React.useCallback(async () => {
    if (!tripId) return
    try { setDetail(await api<Detail>(`/api/trips/${tripId}`)); setErro(null) }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar viagem.') }
  }, [tripId])
  React.useEffect(() => { carregar(); setMsg(null) }, [carregar])

  if (!tripId) return null

  const agir = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true); setErro(null); setMsg(null)
    try {
      const r = await api<{ message?: string; pendingCritical?: string[]; blockers?: string[] }>(`/api/trips/${tripId}/actions`, { method: 'POST', body: { action, ...extra } })
      setMsg(r.message ?? 'Acção executada.')
      if (r.pendingCritical?.length) setMsg(`Pendências para fecho: ${r.pendingCritical.join(' | ')}`)
      await carregar(); aoMudar()
    } catch (e) {
      const err = e as Error & { payload?: { blockers?: string[]; pending?: string[] } }
      const blocks = err.payload?.blockers ?? err.payload?.pending
      setErro(blocks?.length ? `${err.message} — ${blocks.join('; ')}` : err.message)
    } finally { setBusy(false); setConfirmar(null) }
  }

  const t = detail?.trip
  const STATUS_LABEL: Record<string, string> = {
    DRAFT: 'Rascunho', PLANNED: 'Planeada', AWAITING_CHECKLIST: 'A aguardar checklist', AUTHORIZED_DEPARTURE: 'Autorizada para partida',
    IN_TRANSIT: 'Em trânsito', PAUSED: 'Em pausa / retida', ARRIVED: 'Chegada registada', AWAITING_RECONCILIATION: 'A aguardar reconciliação', CLOSED: 'Fechada', CANCELLED: 'Cancelada',
  }

  return (
    <Modal open={!!tripId} onOpenChange={onOpenChange} title={t ? `Viagem ${t.code}` : 'Viagem'} description={t ? `${t.origin} → ${t.destination} • ${t.vehicle?.plate ?? ''} • ${t.driver?.name ?? ''}` : ''} wide>
      {!detail ? <AProcessar /> : (
        <div className="space-y-4">
          {erro && <ErroAlerta erro={erro} />}
          {msg && <div className="rounded-md border border-teal-300 bg-teal-50 px-3 py-2 text-sm text-teal-900">{msg}</div>}

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge estado={t!.status} mapa={STATUS_LABEL} />
            {detail.device && <Badge variant="outline" className={detail.device.status === 'OPERATIONAL' ? 'border-emerald-400 text-emerald-700' : 'border-amber-400 text-amber-700'}>Rastreador: {detail.device.status}</Badge>}
            {t!.isDemo && <Badge variant="outline" className="border-amber-500 text-amber-600">DEMO</Badge>}
            <span className="text-xs text-muted-foreground">Previsto: {fmtData(t!.plannedStart, true)}</span>
          </div>

          {/* Accões do ciclo de vida — visíveis apenas quando permitidas (DEV-004) */}
          {!isDriver && (
            <Panel title="Acções do ciclo de vida">
              <div className="flex flex-wrap gap-2">
                {t!.status === 'DRAFT' && <Button size="sm" onClick={() => agir('plan')}>Validar e planear</Button>}
                {t!.status === 'PLANNED' && <Button size="sm" onClick={() => agir('send_to_checklist')}>Enviar para checklist pré-partida</Button>}
                {t!.status === 'AWAITING_CHECKLIST' && (
                  <Button size="sm" variant="outline" disabled title="A autorização exige checklist aprovada (FR-035) — sem bypass (FR-044)">
                    Autorizar partida (bloqueado até checklist)
                  </Button>
                )}
                {t!.status === 'AWAITING_CHECKLIST' && detail && <Button size="sm" disabled>{'Checklist pendente'}</Button>}
                {t!.status === 'IN_TRANSIT' && (
                  <Button size="sm" variant="outline" onClick={() => setConfirmar({ action: 'pause', titulo: 'Registar pausa/retida', mensagem: 'Registe motivo, local e previsão (§5.1).', pedirMotivo: true })}>Registar pausa</Button>
                )}
                {t!.status === 'PAUSED' && <Button size="sm" onClick={() => agir('resume')}>Retomar trânsito</Button>}
                {t!.status !== 'DRAFT' && !['CLOSED', 'CANCELLED'].includes(t!.status) && (
                  <Button size="sm" variant="outline" className="text-red-700" onClick={() => setConfirmar({ action: 'cancel', titulo: 'Cancelar viagem', mensagem: 'O cancelamento exige motivo e fica registado no histórico (§5.1).', perigo: true, pedirMotivo: true })}>Cancelar viagem</Button>
                )}
              </div>
            </Panel>
          )}

          {/* Partida / chegada — motorista ou escritório */}
          {['AUTHORIZED_DEPARTURE', 'IN_TRANSIT', 'PAUSED'].includes(t!.status) && (
            <Panel title={t!.status === 'AUTHORIZED_DEPARTURE' ? 'Registar partida (FR-036)' : 'Registar chegada'}>
              {t!.status === 'AUTHORIZED_DEPARTURE' ? (
                <div className="flex flex-wrap items-end gap-2">
                  <Campo label="Odómetro de partida (km)" required><EntradaTexto type="number" value={odoPartida} onChange={(e) => setOdoPartida(e.target.value)} /></Campo>
                  <Button size="sm" disabled={busy || !odoPartida} onClick={() => agir('depart', { departureOdometerKm: Number(odoPartida) })}>Confirmar partida</Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  <Campo label="Odómetro de chegada (km)"><EntradaTexto type="number" value={odoChegada} onChange={(e) => setOdoChegada(e.target.value)} /></Campo>
                  <Button size="sm" disabled={busy} onClick={() => agir('arrive', { arrivalOdometerKm: odoChegada ? Number(odoChegada) : undefined })}>Confirmar chegada</Button>
                </div>
              )}
            </Panel>
          )}

          {/* Checklist pré-partida */}
          <ChecklistSection detail={detail} aoMudar={carregar} podeSubmeter={isDriver || ['COMPANY_ADMIN', 'PLATFORM_ADMIN', 'FLEET_MANAGER', 'DISPATCHER', 'BRANCH_MANAGER'].includes(sessao.user.role)} />

          {/* Orçamento */}
          {detail.budget && !isDriver && (
            <Panel title="Orçamento vs realizado (FIN-010)" description="Pendentes e aprovados apresentados separadamente (§15.3)">
              <div className="grid gap-3 sm:grid-cols-3 mb-3">
                <Kpi label="Limite" value={fmtMT(detail.budget.totalLimit, detail.budget.baseCurrency)} />
                <Kpi label="Pendente" value={fmtMT(detail.budget.totalPending, detail.budget.baseCurrency)} tone="warn" />
                <Kpi label="Aprovado" value={fmtMT(detail.budget.totalApproved, detail.budget.baseCurrency)} tone="ok" />
              </div>
              {detail.budget.lines.length > 0 && (
                <div className="space-y-1.5">
                  {detail.budget.lines.map((l) => (
                    <div key={l.category} className="flex items-center gap-2 text-sm">
                      <span className="w-40 shrink-0 text-muted-foreground">{CATS.find((c) => c.value === l.category)?.label ?? l.category}</span>
                      <div className="h-2 flex-1 rounded bg-muted overflow-hidden">
                        <div className={`h-full ${l.pct >= 100 ? 'bg-red-500' : l.pct >= 80 ? 'bg-amber-500' : 'bg-teal-600'}`} style={{ width: `${Math.min(100, l.pct)}%` }} />
                      </div>
                      <span className="w-28 text-right tabular-nums">{fmtMT(l.pendingMinor + l.approvedMinor, detail.budget!.baseCurrency)}</span>
                      <span className="w-12 text-right text-xs tabular-nums">{l.pct}%</span>
                    </div>
                  ))}
                </div>
              )}
              {detail.budget.alerts.length > 0 && (
                <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2.5 text-sm text-amber-900">
                  {detail.budget.alerts.map((a, i) => <div key={i}>⚠ {a}</div>)}
                </div>
              )}
            </Panel>
          )}

          {/* Despesas da viagem */}
          <Panel title={`Despesas da viagem (${detail.expenses.length})`}>
            {detail.expenses.length === 0 ? <p className="text-sm text-muted-foreground">Sem despesas registadas.</p> : (
              <div className="divide-y text-sm">
                {detail.expenses.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <span className="font-medium">{e.code}</span>
                    <span className="text-muted-foreground">{fmtData(e.expenseDate)}</span>
                    <span>{fmtMT(e.amountMinor, e.currency)}</span>
                    <StatusBadge estado={e.status} mapa={{}} />
                    {e.vendor && <span className="text-xs text-muted-foreground">{e.vendor}</span>}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Eventos + ocorrências */}
          <Panel title={`Ocorrências (${detail.incidents.length})`}>
            {detail.incidents.length === 0 ? <p className="text-sm text-muted-foreground">Sem ocorrências.</p> : (
              <div className="divide-y text-sm">
                {detail.incidents.map((i) => (
                  <div key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <StatusBadge estado={i.severity} mapa={{}} />
                    <span className="font-medium">{i.type}</span>
                    <span className="text-muted-foreground">{i.description}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{fmtData(i.deviceTime, true)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Fecho */}
          {!isDriver && ['ARRIVED', 'AWAITING_RECONCILIATION'].includes(t!.status) && (
            <Panel title="Fecho operacional e financeiro (FR-038)">
              {t!.closeBlockers && JSON.parse(t!.closeBlockers).length > 0 && (
                <div className="mb-3 rounded border border-amber-300 bg-amber-50 p-2.5 text-sm text-amber-900">
                  <b>Pendências detectadas:</b>
                  <ul className="list-disc pl-5">{(JSON.parse(t!.closeBlockers) as string[]).map((b, i) => <li key={i}>{b}</li>)}</ul>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {t!.status === 'ARRIVED' && <Button size="sm" onClick={() => agir('request_close')}>Solicitar fecho / reconciliação</Button>}
                {t!.status === 'AWAITING_RECONCILIATION' && (
                  <>
                    <Button size="sm" onClick={() => setConfirmar({ action: 'close', titulo: 'Fechar viagem', mensagem: 'O fecho é auditado. Pendências críticas bloqueiam o fecho (AT-023).' })}>Fechar viagem</Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmar({ action: 'close', titulo: 'Fechar com excepção autorizada', mensagem: 'Somente finanças/administração pode fechar com pendências excepcionadas, com motivo auditado.', perigo: true, pedirMotivo: true })}>Fechar com excepção</Button>
                  </>
                )}
              </div>
            </Panel>
          )}
        </div>
      )}

      <Confirmacao open={!!confirmar} onOpenChange={(v) => !v && setConfirmar(null)}
        titulo={confirmar?.titulo ?? ''} mensagem={confirmar?.mensagem ?? ''} perigo={confirmar?.perigo} pedirMotivo={confirmar?.pedirMotivo}
        onConfirm={(motivo) => confirmar && agir(confirmar.action, { reason: motivo || undefined, force: confirmar.action === 'close' && confirmar.perigo })} />
    </Modal>
  )
}

function ChecklistSection({ detail, aoMudar, podeSubmeter }: { detail: Detail; aoMudar: () => void; podeSubmeter: boolean }) {
  const [respostas, setRespostas] = React.useState<Record<string, boolean>>({})
  const [notas, setNotas] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const [resultado, setResultado] = React.useState<string | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const tripId = detail.trip.id
  const run = (detail.trip as unknown as { checklist?: { itemsJson: string; status: string; blockedReason?: string | null } }).checklist

  React.useEffect(() => {
    if (run) {
      const items = JSON.parse(run.itemsJson) as ChecklistItem[]
      const inicial: Record<string, boolean> = {}
      for (const i of items) if (i.ok !== undefined) inicial[i.key] = i.ok
      setRespostas(inicial)
    }
  }, [run?.itemsJson])  

  if (!run) {
    return <Panel title="Checklist pré-partida"><p className="text-sm text-muted-foreground">Checklist ainda não instanciada para esta viagem. O despacho envia para checklist quando a viagem está planeada.</p></Panel>
  }

  const items = JSON.parse(run.itemsJson) as ChecklistItem[]
  const todosRespondidos = items.every((i) => respostas[i.key] !== undefined)

  const submeter = async () => {
    setBusy(true); setErro(null); setResultado(null)
    try {
      const r = await api<{ passed: boolean; message: string; blockers: string[] }>(`/api/trips/${tripId}/checklist`, {
        method: 'POST',
        body: { items: items.map((i) => ({ key: i.key, ok: respostas[i.key], note: notas[i.key] })) },
      })
      setResultado(r.message)
      aoMudar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao submeter checklist.') }
    finally { setBusy(false) }
  }

  return (
    <Panel title="Checklist pré-partida (§6.5)" description="Itens bloqueantes falhados impedem a autorização de partida — sem botão de continuação forçada (FR-044, AT-003)."
      actions={<StatusBadge estado={run.status} mapa={{ PENDING: 'Pendente', PASSED: 'Aprovada', FAILED: 'Bloqueada' }} />}>
      {run.status === 'FAILED' && run.blockedReason && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <b className="flex items-center gap-1.5"><ShieldAlert className="h-4 w-4" /> Viagem bloqueada:</b>
          <ul className="mt-1 list-disc pl-5">{run.blockedReason.split(' | ').map((b, i) => <li key={i}>{b}</li>)}</ul>
          <p className="mt-1 text-xs">Corrija o item e submeta novamente. Excepções a requisitos de segurança exigem procedimento formal fora da aplicação (FR-044).</p>
        </div>
      )}
      {run.status === 'PASSED' && (
        <div className="mb-3 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> Checklist aprovada — viagem pronta para autorização de partida.
        </div>
      )}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.key} className={`flex flex-wrap items-start gap-3 rounded-lg border p-2.5 ${respostas[item.key] === false && item.blocking ? 'border-red-300 bg-red-50' : ''}`}>
            <Checkbox id={item.key} checked={respostas[item.key] ?? false}
              onCheckedChange={(v) => podeSubmeter && setRespostas({ ...respostas, [item.key]: v === true })}
              disabled={!podeSubmeter || run.status === 'PASSED'} className="mt-0.5" />
            <label htmlFor={item.key} className="flex-1 text-sm cursor-pointer">
              {item.label}
              {item.blocking && <Badge variant="outline" className="ml-2 border-red-300 text-red-700 text-[10px]">BLOQUEANTE</Badge>}
              {item.key === 'carregador_telemovel' && <span className="ml-1.5 text-[10px] font-bold text-amber-700">REQUISITO CRÍTICO — CARREGADOR</span>}
            </label>
            <EntradaTexto placeholder="Nota (opcional)" className="h-8 w-44 text-xs" value={notas[item.key] ?? ''}
              onChange={(e) => setNotas({ ...notas, [item.key]: e.target.value })} disabled={run.status === 'PASSED'} />
          </div>
        ))}
      </div>
      {podeSubmeter && run.status !== 'PASSED' && (
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" disabled={busy || !todosRespondidos} onClick={submeter}>
            {busy ? 'A submeter…' : 'Submeter checklist'}
          </Button>
          {!todosRespondidos && <span className="text-xs text-muted-foreground">Responda a todos os itens — incluindo o carregador (requisito crítico).</span>}
        </div>
      )}
      {resultado && <div className="mt-3 rounded border border-teal-300 bg-teal-50 p-2.5 text-sm text-teal-900">{resultado}</div>}
      {erro && <div className="mt-3"><ErroAlerta erro={erro} /></div>}
    </Panel>
  )
}
