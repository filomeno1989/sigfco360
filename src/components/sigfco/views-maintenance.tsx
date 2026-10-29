// SIGFCO - Manutenção, pneus e combustível
// Ordem de serviço crítica bloqueia despacho até libertação autorizada
'use client'

import * as React from 'react'
import { useApp } from './root'
import { api, fmtData, fmtMT } from '@/lib/client/api'
import { Page, Panel, DataTable, StatusBadge, Campo, EntradaTexto, Selecao, TextoLongo, Modal, Button, ErroAlerta, Confirmacao, Kpi } from './ui-kit'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Plus, Lock, Unlock } from 'lucide-react'

type Vehicle = { id: string; plate: string }
type WO = { id: string; code: string; vehicle?: { plate: string }; type: string; symptom: string; diagnosis?: string | null; priority: string; critical: boolean; status: string; workshop?: string | null; openedAt: string; closedAt?: string | null; laborCostMinor: number; partsCostMinor: number; currency: string; odometerKm?: number }
type Plan = { id: string; vehicleId: string; serviceType: string; intervalKm?: number; intervalDays?: number; lastDoneKm?: number; lastDoneAt?: string; thresholdKm?: number; active: boolean }
type Tire = { id: string; serial: string; brand?: string; size?: string; status: string; vehicleId?: string | null; position?: string | null }
type TireEvent = { id: string; tireId: string; type: string; date: string; position?: string | null; note?: string | null }
type FuelLog = { id: string; vehicle?: { plate: string }; trip?: { code: string } | null; liters: number; pricePerLiterMinor: number; currency: string; totalMinor: number; odoKm: number; deviceTime: string; station?: string | null; flagsJson?: string | null }
type Consumption = Array<{ vehicle: string; expectedL: number | null; realL: number | null; distanceKm: number | null; refL100: number | null; assumptions: string[] }>

export function ManutencaoView({ abaInicial = 'os' }: { abaInicial?: string }) {
  const { sessao } = useApp()
  const podeGerir = ['COMPANY_ADMIN', 'PLATFORM_ADMIN', 'FLEET_MANAGER', 'MECHANIC', 'BRANCH_MANAGER'].includes(sessao.user.role)
  return (
    <Page title="Manutenção, pneus e combustível" subtitle="Planos, ordens de serviço com bloqueio crítico, pneus com histórico e consumo esperado vs real" demo={sessao.company?.isDemo}>
      <Tabs defaultValue={abaInicial}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="os">Ordens de serviço</TabsTrigger>
          <TabsTrigger value="planos">Planos preventivos</TabsTrigger>
          <TabsTrigger value="pneus">Pneus</TabsTrigger>
          <TabsTrigger value="combustivel">Combustível</TabsTrigger>
        </TabsList>
        <TabsContent value="os"><OrdensServico podeGerir={podeGerir} /></TabsContent>
        <TabsContent value="planos"><Planos podeGerir={podeGerir} /></TabsContent>
        <TabsContent value="pneus"><Pneus podeGerir={podeGerir} /></TabsContent>
        <TabsContent value="combustivel"><Combustivel podeRegistar={['COMPANY_ADMIN', 'PLATFORM_ADMIN', 'FLEET_MANAGER', 'DRIVER', 'MECHANIC'].includes(sessao.user.role)} /></TabsContent>
      </Tabs>
    </Page>
  )
}

function OrdensServico({ podeGerir }: { podeGerir: boolean }) {
  const [rows, setRows] = React.useState<WO[]>([])
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([])
  const [erro, setErro] = React.useState<string | null>(null)
  const [novo, setNovo] = React.useState(false)
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [liberarOS, setLibertar] = React.useState<WO | null>(null)
  const [motivo, setMotivo] = React.useState('')

  const carregar = React.useCallback(async () => {
    try {
      const [w, v] = await Promise.all([api<{ workorders: WO[] }>('/api/maintenance'), api<{ vehicles: Vehicle[] }>('/api/vehicles')])
      setRows(w.workorders); setVehicles(v.vehicles); setErro(null)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar ordens de serviço.') }
  }, [])
  React.useEffect(() => { carregar() }, [carregar])

  const criar = async () => {
    try {
      await api('/api/maintenance', { method: 'POST', body: { vehicleId: form.vehicleId, type: form.type ?? 'CORRECTIVE', symptom: form.symptom, priority: form.priority ?? 'NORMAL', critical: form.critical === '1', workshop: form.workshop, status: 'OPEN' } })
      setNovo(false); setForm({}); carregar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao abrir OS.') }
  }

  const libertarOS = async () => {
    if (!liberarOS) return
    try { await api('/api/maintenance', { method: 'PATCH', body: { id: liberarOS.id, action: 'release', reason: motivo, diagnosis: form.diagnosis } }); setLibertar(null); setMotivo(''); carregar() }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao libertar.') }
  }

  return (
    <div className="space-y-4">
      <ErroAlerta erro={erro} />
      <Panel title={`Ordens de serviço (${rows.length})`} description="Críticas bloqueiam atribuição de nova viagem até libertação com prova"
        actions={podeGerir && <Button size="sm" onClick={() => setNovo(true)}><Plus className="mr-1 h-4 w-4" />Abrir OS</Button>}>
        <DataTable rows={rows} columns={[
          { key: 'code', header: 'OS', render: (w) => <span className="font-medium">{w.code}</span> },
          { key: 'vehicle', header: 'Veículo', render: (w) => w.vehicle?.plate ?? '-' },
          { key: 'symptom', header: 'Sintoma/Diagnóstico', render: (w) => <div><div>{w.symptom}</div>{w.diagnosis && <div className="text-xs text-muted-foreground">{w.diagnosis}</div>}</div> },
          { key: 'priority', header: 'Prioridade', render: (w) => <StatusBadge estado={w.priority === 'CRITICAL' || w.critical ? 'CRITICAL' : w.priority} mapa={{ LOW: 'Baixa', NORMAL: 'Normal', HIGH: 'Alta', CRITICAL: 'Crítica' }} />, hideOnMobile: true },
          { key: 'custos', header: 'Custos', render: (w) => fmtMT(w.laborCostMinor + w.partsCostMinor, w.currency), hideOnMobile: true },
          { key: 'status', header: 'Estado', render: (w) => <div className="flex items-center gap-1.5"><StatusBadge estado={w.status} mapa={{ OPEN: 'Aberta', IN_PROGRESS: 'Em curso', DONE: 'Concluída', CANCELLED: 'Cancelada' }} />{w.critical && w.status !== 'DONE' && <Lock className="h-3.5 w-3.5 text-red-600" />}</div> },
          { key: 'actions', header: '', render: (w) => podeGerir && w.status !== 'DONE' && (
            <Button size="sm" variant="outline" onClick={() => setLibertar(w)}><Unlock className="mr-1 h-3.5 w-3.5" />Concluir/libertar</Button>
          ) },
        ]} />
      </Panel>

      <Modal open={novo} onOpenChange={setNovo} title="Abrir ordem de serviço"
        footer={<><Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button><Button onClick={criar}>Abrir OS</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Veículo" required><Selecao value={form.vehicleId ?? ''} onChange={(v) => setForm({ ...form, vehicleId: v })} opcoes={[{ value: '', label: 'Seleccionar…' }, ...vehicles.map((v) => ({ value: v.id, label: v.plate }))]} /></Campo>
          <Campo label="Tipo"><Selecao value={form.type ?? 'CORRECTIVE'} onChange={(v) => setForm({ ...form, type: v })} opcoes={[{ value: 'CORRECTIVE', label: 'Correctiva' }, { value: 'PREVENTIVE', label: 'Preventiva' }]} /></Campo>
          <Campo label="Prioridade"><Selecao value={form.priority ?? 'NORMAL'} onChange={(v) => setForm({ ...form, priority: v })} opcoes={[{ value: 'LOW', label: 'Baixa' }, { value: 'NORMAL', label: 'Normal' }, { value: 'HIGH', label: 'Alta' }, { value: 'CRITICAL', label: 'Crítica' }]} /></Campo>
          <Campo label="Oficina"><EntradaTexto value={form.workshop ?? ''} onChange={(e) => setForm({ ...form, workshop: e.target.value })} /></Campo>
          <div className="sm:col-span-2"><Campo label="Sintoma / avaria" required><TextoLongo rows={2} value={form.symptom ?? ''} onChange={(e) => setForm({ ...form, symptom: e.target.value })} /></Campo></div>
          <Campo label="Crítica (bloqueia despacho)" hint=""><Selecao value={form.critical ?? '0'} onChange={(v) => setForm({ ...form, critical: v })} opcoes={[{ value: '0', label: 'Não' }, { value: '1', label: 'Sim' }]} /></Campo>
        </div>
      </Modal>

      <Modal open={!!libertar} onOpenChange={(v) => !v && setLibertar(null)} title={`Libertar ${libertar?.code ?? ''}`}
        description="A libertação exige motivo/prova e fica registada com autor e data."
        footer={
          <>
            <Button variant="outline" onClick={() => setLibertar(null)}>Cancelar</Button>
            <Button disabled={motivo.length < 5} onClick={libertarOS}>Concluir e libertar veículo</Button>
          </>
        }>
        <div className="space-y-3">
          <Campo label="Diagnóstico / serviço executado"><EntradaTexto value={form.diagnosis ?? ''} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></Campo>
          <Campo label="Motivo/prova da libertação" required><TextoLongo rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
        </div>
      </Modal>
    </div>
  )
}

function Planos({ podeGerir }: { podeGerir: boolean }) {
  const [rows, setRows] = React.useState<Plan[]>([])
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([])
  const [novo, setNovo] = React.useState(false)
  const [form, setForm] = React.useState<Record<string, string>>({})
  const carregar = React.useCallback(async () => {
    const [p, v] = await Promise.all([api<{ plans: Plan[] }>('/api/maintenance'), api<{ vehicles: Vehicle[] }>('/api/vehicles')])
    setRows(p.plans); setVehicles(v.vehicles)
  }, [])
  React.useEffect(() => { carregar() }, [carregar])

  const criar = async () => {
    try {
      await api('/api/maintenance', { method: 'POST', body: { action: 'create-plan', vehicleId: form.vehicleId, serviceType: form.serviceType, intervalKm: form.intervalKm ? Number(form.intervalKm) : undefined, thresholdKm: form.thresholdKm ? Number(form.thresholdKm) : undefined } })
      setNovo(false); setForm({}); carregar()
    } catch { /* erro tratado */ }
  }

  return (
    <Panel title={`Planos preventivos (${rows.length})`} description="Intervalos por quilometragem/tempo com alertas antecipados"
      actions={podeGerir && <Button size="sm" onClick={() => setNovo(true)}><Plus className="mr-1 h-4 w-4" />Novo plano</Button>}>
      <DataTable rows={rows} columns={[
        { key: 'vehicle', header: 'Veículo', render: (p) => vehicles.find((v) => v.id === p.vehicleId)?.plate ?? '-' },
        { key: 'serviceType', header: 'Serviço', render: (p) => ({ oleo: 'Óleo', filtros: 'Filtros', travoes: 'Travões', pneus: 'Pneus', suspensao: 'Suspensão', arrefecimento: 'Arrefecimento', transmissao: 'Transmissão', inspecao: 'Inspecção' }[p.serviceType] ?? p.serviceType) },
        { key: 'intervalKm', header: 'Intervalo', render: (p) => `${p.intervalKm?.toLocaleString('pt-PT') ?? '-'} km${p.intervalDays ? ` / ${p.intervalDays} d` : ''}` },
        { key: 'lastDoneKm', header: 'Última aos', render: (p) => p.lastDoneKm ? `${p.lastDoneKm.toLocaleString('pt-PT')} km` : '-', hideOnMobile: true },
        { key: 'active', header: 'Activo', render: (p) => p.active ? 'Sim' : 'Não' },
      ]} />
      <Modal open={novo} onOpenChange={setNovo} title="Novo plano preventivo"
        footer={<><Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button><Button onClick={criar}>Registar</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Veículo" required><Selecao value={form.vehicleId ?? ''} onChange={(v) => setForm({ ...form, vehicleId: v })} opcoes={[{ value: '', label: 'Seleccionar…' }, ...vehicles.map((v) => ({ value: v.id, label: v.plate }))]} /></Campo>
          <Campo label="Serviço"><Selecao value={form.serviceType ?? 'oleo'} onChange={(v) => setForm({ ...form, serviceType: v })} opcoes={[{ value: 'oleo', label: 'Óleo' }, { value: 'filtros', label: 'Filtros' }, { value: 'travoes', label: 'Travões' }, { value: 'pneus', label: 'Pneus' }, { value: 'suspensao', label: 'Suspensão' }, { value: 'inspecao', label: 'Inspecção' }]} /></Campo>
          <Campo label="Intervalo (km)"><EntradaTexto type="number" value={form.intervalKm ?? ''} onChange={(e) => setForm({ ...form, intervalKm: e.target.value })} /></Campo>
          <Campo label="Alerta antecipado (km antes)" hint=""><EntradaTexto type="number" value={form.thresholdKm ?? ''} onChange={(e) => setForm({ ...form, thresholdKm: e.target.value })} /></Campo>
        </div>
      </Modal>
    </Panel>
  )
}

function Pneus({ podeGerir }: { podeGerir: boolean }) {
  const [tires, setTires] = React.useState<Tire[]>([])
  const [events, setEvents] = React.useState<TireEvent[]>([])
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([])
  const [novo, setNovo] = React.useState(false)
  const [mov, setMov] = React.useState<Tire | null>(null)
  const [form, setForm] = React.useState<Record<string, string>>({})
  const carregar = React.useCallback(async () => {
    const [t, v] = await Promise.all([api<{ tires: Tire[]; events: TireEvent[] }>('/api/tires'), api<{ vehicles: Vehicle[] }>('/api/vehicles')])
    setTires(t.tires); setEvents(t.events); setVehicles(v.vehicles)
  }, [])
  React.useEffect(() => { carregar() }, [carregar])

  const criar = async () => {
    try { await api('/api/tires', { method: 'POST', body: form }); setNovo(false); setForm({}); carregar() } catch { /* */ }
  }
  const mover = async () => {
    if (!mov) return
    try {
      await api('/api/tires', { method: 'POST', body: { action: 'event', tireId: mov.id, type: form.type, vehicleId: form.vehicleId || undefined, position: form.position, odoKm: form.odoKm ? Number(form.odoKm) : undefined, note: form.note } })
      setMov(null); setForm({}); carregar()
    } catch { /* */ }
  }

  return (
    <div className="space-y-4">
      <Panel title={`Pneus (${tires.length})`} description="Cadastro com posição, histórico de rotação/reparação/substituição"
        actions={podeGerir && <Button size="sm" onClick={() => setNovo(true)}><Plus className="mr-1 h-4 w-4" />Novo pneu</Button>}>
        <DataTable rows={tires} columns={[
          { key: 'serial', header: 'Série', render: (t) => <span className="font-medium">{t.serial}</span> },
          { key: 'brand', header: 'Marca/Medida', render: (t) => `${t.brand ?? '-'} ${t.size ?? ''}`, hideOnMobile: true },
          { key: 'vehicle', header: 'Veículo/Posição', render: (t) => t.vehicleId ? `${vehicles.find((v) => v.id === t.vehicleId)?.plate ?? '-'} • ${t.position ?? '-'}` : '-' },
          { key: 'status', header: 'Estado', render: (t) => <StatusBadge estado={t.status} mapa={{ IN_STOCK: 'Em stock', INSTALLED: 'Instalado', REPAIR: 'Em reparação', RETIRED: 'Reformado' }} /> },
          { key: 'actions', header: '', render: (t) => podeGerir && <Button size="sm" variant="outline" onClick={() => setMov(t)}>Movimentar</Button> },
        ]} />
      </Panel>
      <Panel title="Histórico de movimentos">
        <DataTable rows={events} columns={[
          { key: 'date', header: 'Data', render: (e) => fmtData(e.date) },
          { key: 'tire', header: 'Pneu', render: (e) => tires.find((t) => t.id === e.tireId)?.serial ?? '-' },
          { key: 'type', header: 'Movimento', render: (e) => ({ INSTALL: 'Instalação', REMOVE: 'Remoção', ROTATE: 'Rotação', REPAIR: 'Reparação', REPLACE: 'Substituição' }[e.type] ?? e.type) },
          { key: 'position', header: 'Posição', render: (e) => e.position ?? '-', hideOnMobile: true },
          { key: 'note', header: 'Nota', render: (e) => e.note ?? '-', hideOnMobile: true },
        ]} />
      </Panel>
      <Modal open={novo} onOpenChange={setNovo} title="Novo pneu"
        footer={<><Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button><Button onClick={criar}>Registar</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nº de série" required><EntradaTexto value={form.serial ?? ''} onChange={(e) => setForm({ ...form, serial: e.target.value })} /></Campo>
          <Campo label="Marca"><EntradaTexto value={form.brand ?? ''} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Campo>
          <Campo label="Medida"><EntradaTexto value={form.size ?? ''} onChange={(e) => setForm({ ...form, size: e.target.value })} /></Campo>
        </div>
      </Modal>
      <Modal open={!!mov} onOpenChange={(v) => !v && setMov(null)} title={`Movimentar ${mov?.serial ?? ''}`}
        footer={<><Button variant="outline" onClick={() => setMov(null)}>Cancelar</Button><Button onClick={mover}>Registar movimento</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Movimento" required><Selecao value={form.type ?? 'INSTALL'} onChange={(v) => setForm({ ...form, type: v })} opcoes={[{ value: 'INSTALL', label: 'Instalação' }, { value: 'REMOVE', label: 'Remoção' }, { value: 'ROTATE', label: 'Rotação' }, { value: 'REPAIR', label: 'Reparação' }, { value: 'REPLACE', label: 'Reforma' }]} /></Campo>
          <Campo label="Veículo"><Selecao value={form.vehicleId ?? ''} onChange={(v) => setForm({ ...form, vehicleId: v })} opcoes={[{ value: '', label: 'Nenhum' }, ...vehicles.map((v) => ({ value: v.id, label: v.plate }))]} /></Campo>
          <Campo label="Posição" hint="Ex.: E1, E2, DI, DE, T1"><EntradaTexto value={form.position ?? ''} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Campo>
          <Campo label="Odómetro (km)"><EntradaTexto type="number" value={form.odoKm ?? ''} onChange={(e) => setForm({ ...form, odoKm: e.target.value })} /></Campo>
        </div>
      </Modal>
    </div>
  )
}

function Combustivel({ podeRegistar }: { podeRegistar: boolean }) {
  const [logs, setLogs] = React.useState<FuelLog[]>([])
  const [consumo, setConsumo] = React.useState<Consumption>([])
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([])
  const [erro, setErro] = React.useState<string | null>(null)
  const [novo, setNovo] = React.useState(false)
  const [form, setForm] = React.useState<Record<string, string>>({})

  const carregar = React.useCallback(async () => {
    try {
      const [f, v] = await Promise.all([api<{ logs: FuelLog[]; consumption: Consumption }>('/api/fuel'), api<{ vehicles: Vehicle[] }>('/api/vehicles')])
      setLogs(f.logs); setConsumo(f.consumption); setVehicles(v.vehicles); setErro(null)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar abastecimentos.') }
  }, [])
  React.useEffect(() => { carregar() }, [carregar])

  const criar = async () => {
    try {
      await api('/api/fuel', { method: 'POST', body: { vehicleId: form.vehicleId, liters: Number(form.liters), pricePerLiterMinor: Math.round(Number(form.preco.replace(',', '.')) * 100), odoKm: Number(form.odoKm), station: form.station, tripId: form.tripId || undefined } })
      setNovo(false); setForm({}); carregar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao registar abastecimento.') }
  }

  return (
    <div className="space-y-4">
      <ErroAlerta erro={erro} />
      <Panel title="Consumo esperado vs real" description="Pressupostos do cálculo apresentados - sem dados completos não há indicador fiável">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {consumo.map((c) => (
            <div key={c.vehicle} className="rounded-lg border p-3">
              <b className="text-sm">{c.vehicle}</b>
              <div className="mt-1.5 text-sm space-y-0.5">
                {c.realL != null && <div>Real: <b>{c.realL} L</b> em {c.distanceKm?.toLocaleString('pt-PT')} km</div>}
                {c.expectedL != null && <div>Esperado: {c.expectedL} L (ref. {c.refL100} L/100km)</div>}
                {c.realL != null && c.expectedL != null && (
                  <div className={c.realL > c.expectedL * 1.15 ? 'text-red-700' : 'text-emerald-700'}>
                    Diferença: {c.realL - c.expectedL > 0 ? '+' : ''}{Math.round((c.realL - c.expectedL) * 10) / 10} L
                  </div>
                )}
              </div>
              <ul className="mt-2 text-xs text-muted-foreground">{c.assumptions.map((a, i) => <li key={i}>• {a}</li>)}</ul>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={`Abastecimentos (${logs.length})`} description="Anomalias sinalizadas para revisão humana, nunca corrigidas em silêncio"
        actions={podeRegistar && <Button size="sm" onClick={() => setNovo(true)}><Plus className="mr-1 h-4 w-4" />Registar abastecimento</Button>}>
        <DataTable rows={logs} columns={[
          { key: 'date', header: 'Data', render: (f) => fmtData(f.deviceTime, true) },
          { key: 'vehicle', header: 'Veículo', render: (f) => f.vehicle?.plate ?? '-' },
          { key: 'liters', header: 'Litros', render: (f) => <b>{f.liters} L</b> },
          { key: 'total', header: 'Total', render: (f) => fmtMT(f.totalMinor, f.currency) },
          { key: 'odo', header: 'Odómetro', render: (f) => `${Math.round(f.odoKm).toLocaleString('pt-PT')} km`, hideOnMobile: true },
          { key: 'station', header: 'Posto', render: (f) => f.station ?? '-', hideOnMobile: true },
          { key: 'flags', header: 'Sinais', render: (f) => f.flagsJson ? <Badge variant="outline" className="border-amber-500 text-amber-700">Anomalia</Badge> : '-' },
        ]} />
      </Panel>

      <Modal open={novo} onOpenChange={setNovo} title="Registar abastecimento"
        footer={<><Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button><Button onClick={criar}>Registar</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Veículo" required><Selecao value={form.vehicleId ?? ''} onChange={(v) => setForm({ ...form, vehicleId: v })} opcoes={[{ value: '', label: 'Seleccionar…' }, ...vehicles.map((v) => ({ value: v.id, label: v.plate }))]} /></Campo>
          <Campo label="Litros" required><EntradaTexto type="number" step="0.01" value={form.liters ?? ''} onChange={(e) => setForm({ ...form, liters: e.target.value })} /></Campo>
          <Campo label="Preço por litro" required hint="Ex.: 87,50"><EntradaTexto value={form.preco ?? ''} onChange={(e) => setForm({ ...form, preco: e.target.value })} /></Campo>
          <Campo label="Odómetro (km)" required><EntradaTexto type="number" value={form.odoKm ?? ''} onChange={(e) => setForm({ ...form, odoKm: e.target.value })} /></Campo>
          <Campo label="Posto/Estação"><EntradaTexto value={form.station ?? ''} onChange={(e) => setForm({ ...form, station: e.target.value })} /></Campo>
        </div>
      </Modal>
    </div>
  )
}
