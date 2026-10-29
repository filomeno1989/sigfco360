// =====================================================================
// SIGFCO - Frota: veículos, motoristas,
// reboques, rastreadores e documentos
// =====================================================================
'use client'

import * as React from 'react'
import { useApp } from './root'
import { api, fmtData, fmtMT } from '@/lib/client/api'
import { Page, Panel, DataTable, StatusBadge, Campo, EntradaTexto, Selecao, Modal, Button, ErroAlerta, Confirmacao } from './ui-kit'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, KeyRound, Link2, FileUp } from 'lucide-react'

type Vehicle = { id: string; plate: string; brand?: string; model?: string; year?: number; vin?: string; type: string; odometerKm: number; tankCapacityL?: number; refConsumption?: number; status: string; stateReason?: string; isDemo?: boolean; device?: { serial: string; status: string; lastPointAt?: string } | null; expiredBlockingDoc?: boolean }
type Driver = { id: string; code: string; name: string; phone?: string; licenseNumber?: string; licenseCategory?: string; licenseExpiry?: string; status: string; licenseExpired?: boolean | null; eligible?: boolean }
type Trailer = { id: string; plate: string; type: string; brand?: string; capacityKg?: number; status: string }
type Device = { id: string; serial: string; imei?: string; vendor?: string; protocol?: string; status: string; vehicleId?: string | null; vehicle?: { plate: string } | null; simNumber?: string; lastPointAt?: string | null }
type Doc = { id: string; ownerType: string; type: string; number?: string; issuerCountry?: string; expiresAt?: string; blocking: boolean; status: string; vehicleId?: string | null; driverId?: string | null }

const PLATE_LABEL = { TRUCK: 'Camião', TRUCK_6X4: 'Camião 6x4', TRACTOR: 'Tractor', VAN: 'Furgão', PICKUP: 'Pick-up' }

export function FrotaView({ abaInicial = 'veiculos' }: { abaInicial?: string }) {
  const { sessao } = useApp()
  const podeGerir = ['COMPANY_ADMIN', 'PLATFORM_ADMIN', 'FLEET_MANAGER', 'BRANCH_MANAGER'].includes(sessao.user.role)
  return (
    <Page title="Frota" subtitle="Veículos, motoristas, reboques, rastreadores e documentos - estados calculados a partir de eventos" demo={sessao.company?.isDemo}>
      <Tabs defaultValue={abaInicial}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="veiculos">Veículos</TabsTrigger>
          <TabsTrigger value="motoristas">Motoristas</TabsTrigger>
          <TabsTrigger value="reboques">Reboques</TabsTrigger>
          <TabsTrigger value="gps">Rastreadores GPS</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>
        <TabsContent value="veiculos"><Veiculos podeGerir={podeGerir} /></TabsContent>
        <TabsContent value="motoristas"><Motoristas podeGerir={podeGerir} /></TabsContent>
        <TabsContent value="reboques"><Reboques podeGerir={podeGerir} /></TabsContent>
        <TabsContent value="gps"><Dispositivos podeGerir={podeGerir} /></TabsContent>
        <TabsContent value="documentos"><Documentos podeGerir={podeGerir} /></TabsContent>
      </Tabs>
    </Page>
  )
}

function Veiculos({ podeGerir }: { podeGerir: boolean }) {
  const [rows, setRows] = React.useState<Vehicle[]>([])
  const [erro, setErro] = React.useState<string | null>(null)
  const [novo, setNovo] = React.useState(false)
  const [form, setForm] = React.useState<Record<string, string>>({})

  const carregar = React.useCallback(async () => {
    try { setRows((await api<{ vehicles: Vehicle[] }>('/api/vehicles')).vehicles); setErro(null) }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar veículos.') }
  }, [])
  React.useEffect(() => { carregar() }, [carregar])

  const criar = async () => {
    try {
      await api('/api/vehicles', { method: 'POST', body: { ...form, year: form.year ? Number(form.year) : undefined, odometerKm: form.odometerKm ? Number(form.odometerKm) : 0 } })
      setNovo(false); setForm({}); carregar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao criar.') }
  }

  return (
    <div className="space-y-4">
      <ErroAlerta erro={erro} />
      <Panel title={`Frota de camiões (${rows.length})`}
        actions={podeGerir && <Button size="sm" onClick={() => setNovo(true)}><Plus className="mr-1 h-4 w-4" />Novo veículo</Button>}>
        <DataTable
          rows={rows} filtro={(v, q) => [v.plate, v.brand, v.model, v.vin].some((s) => s?.toLowerCase().includes(q))}
          filtroPlaceholder="Matrícula, marca…"
          columns={[
            { key: 'plate', header: 'Matrícula', render: (v) => <span className="font-medium">{v.plate}{v.isDemo && <Badge variant="outline" className="ml-1.5 border-amber-500 text-amber-600">DEMO</Badge>}</span> },
            { key: 'brand', header: 'Marca/Modelo', render: (v) => `${v.brand ?? '-'} ${v.model ?? ''}` },
            { key: 'type', header: 'Tipo', render: (v) => PLATE_LABEL[v.type as keyof typeof PLATE_LABEL] ?? v.type, hideOnMobile: true },
            { key: 'odometerKm', header: 'Odómetro', render: (v) => `${Math.round(v.odometerKm).toLocaleString('pt-PT')} km`, hideOnMobile: true },
            { key: 'device', header: 'Rastreador', render: (v) => v.device ? <Badge variant="outline" className={v.device.status === 'OPERATIONAL' ? 'border-emerald-400 text-emerald-700' : 'border-amber-400 text-amber-700'}>{v.device.serial}</Badge> : <span className="text-red-600 font-medium">Sem rastreador</span> },
            { key: 'status', header: 'Estado', render: (v) => <div className="space-y-0.5"><StatusBadge estado={v.status} mapa={{}} />{v.stateReason && <div className="text-xs text-muted-foreground">{v.stateReason}</div>}{v.expiredBlockingDoc && <div className="text-xs text-red-600">Documento bloqueante expirado</div>}</div> },
          ]}
        />
      </Panel>

      <Modal open={novo} onOpenChange={setNovo} title="Novo veículo" description="Matrícula normalizada e única na empresa."
        footer={<><Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button><Button onClick={criar}>Registar</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Matrícula" required hint="Sem espaços/traços; ex.: AAH123MZ"><EntradaTexto value={form.plate ?? ''} onChange={(e) => setForm({ ...form, plate: e.target.value })} /></Campo>
          <Campo label="Marca"><EntradaTexto value={form.brand ?? ''} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Campo>
          <Campo label="Modelo"><EntradaTexto value={form.model ?? ''} onChange={(e) => setForm({ ...form, model: e.target.value })} /></Campo>
          <Campo label="Ano"><EntradaTexto type="number" value={form.year ?? ''} onChange={(e) => setForm({ ...form, year: e.target.value })} /></Campo>
          <Campo label="VIN / Chassis"><EntradaTexto value={form.vin ?? ''} onChange={(e) => setForm({ ...form, vin: e.target.value })} /></Campo>
          <Campo label="Tipo"><Selecao value={form.type ?? 'TRUCK'} onChange={(v) => setForm({ ...form, type: v })} opcoes={Object.entries(PLATE_LABEL).map(([value, label]) => ({ value, label }))} /></Campo>
          <Campo label="Capacidade do tanque (L)"><EntradaTexto type="number" value={form.tankCapacityL ?? ''} onChange={(e) => setForm({ ...form, tankCapacityL: e.target.value })} /></Campo>
          <Campo label="Consumo de referência (L/100km)" hint="Usado na comparação esperado vs real"><EntradaTexto type="number" value={form.refConsumption ?? ''} onChange={(e) => setForm({ ...form, refConsumption: e.target.value })} /></Campo>
          <Campo label="Odómetro actual (km)"><EntradaTexto type="number" value={form.odometerKm ?? ''} onChange={(e) => setForm({ ...form, odometerKm: e.target.value })} /></Campo>
          <Campo label="Capacidade de carga (kg)"><EntradaTexto type="number" value={form.cargoCapacityKg ?? ''} onChange={(e) => setForm({ ...form, cargoCapacityKg: e.target.value })} /></Campo>
        </div>
      </Modal>
    </div>
  )
}

function Motoristas({ podeGerir }: { podeGerir: boolean }) {
  const [rows, setRows] = React.useState<Driver[]>([])
  const [erro, setErro] = React.useState<string | null>(null)
  const [novo, setNovo] = React.useState(false)
  const [form, setForm] = React.useState<Record<string, string>>({})

  const carregar = React.useCallback(async () => {
    try { setRows((await api<{ drivers: Driver[] }>('/api/drivers')).drivers); setErro(null) }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar motoristas.') }
  }, [])
  React.useEffect(() => { carregar() }, [carregar])

  const criar = async () => {
    try { await api('/api/drivers', { method: 'POST', body: form }); setNovo(false); setForm({}); carregar() }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao criar.') }
  }

  return (
    <div className="space-y-4">
      <ErroAlerta erro={erro} />
      <Panel title={`Motoristas (${rows.length})`} description="Elegibilidade verificada antes de qualquer atribuição"
        actions={podeGerir && <Button size="sm" onClick={() => setNovo(true)}><Plus className="mr-1 h-4 w-4" />Novo motorista</Button>}>
        <DataTable
          rows={rows} filtro={(d, q) => [d.name, d.code, d.phone].some((s) => s?.toLowerCase().includes(q))}
          filtroPlaceholder="Nome, código…"
          columns={[
            { key: 'code', header: 'Código', render: (d) => <span className="font-medium">{d.code}</span> },
            { key: 'name', header: 'Nome' },
            { key: 'phone', header: 'Contacto', hideOnMobile: true },
            { key: 'license', header: 'Carta', render: (d) => `${d.licenseCategory ?? '-'} • ${d.licenseNumber ?? '-'}`, hideOnMobile: true },
            { key: 'validade', header: 'Validade da carta', render: (d) => <span className={d.licenseExpired ? 'text-red-600 font-medium' : ''}>{fmtData(d.licenseExpiry)}{d.licenseExpired ? ' (expirada)' : ''}</span> },
            { key: 'status', header: 'Estado', render: (d) => <StatusBadge estado={d.status} mapa={{ ACTIVE: 'Activo', INACTIVE: 'Inactivo', SUSPENDED: 'Suspenso', ON_TRIP: 'Em viagem' }} /> },
            { key: 'elig', header: 'Elegível', render: (d) => d.eligible ? <Badge variant="outline" className="border-emerald-400 text-emerald-700">Sim</Badge> : <Badge variant="outline" className="border-red-400 text-red-700">Não</Badge> },
          ]}
        />
      </Panel>

      <Modal open={novo} onOpenChange={setNovo} title="Novo motorista" description="Contacto de emergência apenas quando autorizado pela política."
        footer={<><Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button><Button onClick={criar}>Registar</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nome completo" required><EntradaTexto value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Campo>
          <Campo label="Código interno" hint="Gerado automaticamente se vazio"><EntradaTexto value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Campo>
          <Campo label="Contacto"><EntradaTexto value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Campo>
          <Campo label="Contacto de emergência"><EntradaTexto value={form.emergencyContact ?? ''} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} /></Campo>
          <Campo label="Nº da carta"><EntradaTexto value={form.licenseNumber ?? ''} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} /></Campo>
          <Campo label="Categoria"><Selecao value={form.licenseCategory ?? 'C1'} onChange={(v) => setForm({ ...form, licenseCategory: v })} opcoes={[{ value: 'C1', label: 'C1' }, { value: 'C', label: 'C' }, { value: 'C2', label: 'C2' }, { value: 'D', label: 'D' }]} /></Campo>
          <Campo label="Validade da carta" required><EntradaTexto type="date" value={form.licenseExpiry ?? ''} onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} /></Campo>
          <Campo label="País emissor"><EntradaTexto value={form.licenseCountry ?? 'MZ'} onChange={(e) => setForm({ ...form, licenseCountry: e.target.value })} /></Campo>
        </div>
      </Modal>
    </div>
  )
}

function Reboques({ podeGerir }: { podeGerir: boolean }) {
  const [rows, setRows] = React.useState<Trailer[]>([])
  const [novo, setNovo] = React.useState(false)
  const [form, setForm] = React.useState<Record<string, string>>({})
  const carregar = React.useCallback(async () => { setRows((await api<{ trailers: Trailer[] }>('/api/trailers')).trailers) }, [])
  React.useEffect(() => { carregar() }, [carregar])
  const criar = async () => { try { await api('/api/trailers', { method: 'POST', body: { ...form, capacityKg: form.capacityKg ? Number(form.capacityKg) : undefined } }); setNovo(false); setForm({}); carregar() } catch { /* erro tratado pela API */ } }

  return (
    <Panel title={`Reboques e combinações (${rows.length})`} description="Registados separadamente e associáveis às viagens"
      actions={podeGerir && <Button size="sm" onClick={() => setNovo(true)}><Plus className="mr-1 h-4 w-4" />Novo reboque</Button>}>
      <DataTable rows={rows} columns={[
        { key: 'plate', header: 'Matrícula', render: (t) => <span className="font-medium">{t.plate}</span> },
        { key: 'type', header: 'Tipo', render: (t) => ({ TRAILER: 'Atrelado', TANKER: 'Cisterna', DOLLY: 'Dolly' }[t.type] ?? t.type) },
        { key: 'brand', header: 'Marca', hideOnMobile: true },
        { key: 'capacityKg', header: 'Capacidade (kg)', render: (t) => t.capacityKg?.toLocaleString('pt-PT') ?? '-', hideOnMobile: true },
        { key: 'status', header: 'Estado', render: (t) => <StatusBadge estado={t.status} mapa={{ AVAILABLE: 'Disponível', IN_USE: 'Em uso', MAINTENANCE: 'Manutenção', INACTIVE: 'Inactivo' }} /> },
      ]} />
      <Modal open={novo} onOpenChange={setNovo} title="Novo reboque"
        footer={<><Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button><Button onClick={criar}>Registar</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Matrícula/Identificação" required><EntradaTexto value={form.plate ?? ''} onChange={(e) => setForm({ ...form, plate: e.target.value })} /></Campo>
          <Campo label="Tipo"><Selecao value={form.type ?? 'TRAILER'} onChange={(v) => setForm({ ...form, type: v })} opcoes={[{ value: 'TRAILER', label: 'Atrelado' }, { value: 'TANKER', label: 'Cisterna' }, { value: 'DOLLY', label: 'Dolly' }]} /></Campo>
          <Campo label="Marca"><EntradaTexto value={form.brand ?? ''} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Campo>
          <Campo label="Capacidade (kg)"><EntradaTexto type="number" value={form.capacityKg ?? ''} onChange={(e) => setForm({ ...form, capacityKg: e.target.value })} /></Campo>
        </div>
      </Modal>
    </Panel>
  )
}

function Dispositivos({ podeGerir }: { podeGerir: boolean }) {
  const { sessao } = useApp()
  const [rows, setRows] = React.useState<Device[]>([])
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([])
  const [erro, setErro] = React.useState<string | null>(null)
  const [novo, setNovo] = React.useState(false)
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [novaChave, setNovaChave] = React.useState<string | null>(null)
  const [confirmarRotacao, setConfirmarRotacao] = React.useState<Device | null>(null)
  const isDemo = sessao.company?.isDemo

  const carregar = React.useCallback(async () => {
    try {
      const [d, v] = await Promise.all([api<{ devices: Device[] }>('/api/gps/devices'), api<{ vehicles: Vehicle[] }>('/api/vehicles')])
      setRows(d.devices); setVehicles(v.vehicles); setErro(null)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar dispositivos.') }
  }, [])
  React.useEffect(() => { carregar() }, [carregar])

  const criar = async () => {
    try { await api('/api/gps/devices', { method: 'POST', body: form }); setNovo(false); setForm({}); carregar() }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao criar dispositivo.') }
  }

  const atribuir = async (device: Device, vehicleId: string) => {
    try { await api('/api/gps/devices', { method: 'PATCH', body: { id: device.id, action: 'assign', vehicleId } }); carregar() }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao associar.') }
  }

  const rodarChave = async (device: Device) => {
    try {
      const r = await api<{ apiKey: string }>('/api/gps/devices', { method: 'PATCH', body: { id: device.id, action: 'rotate-key' } })
      setNovaChave(r.apiKey); setConfirmarRotacao(null)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao rodar chave.') }
  }

  const copiarIngest = async () => {
    await navigator.clipboard.writeText(JSON.stringify({ points: [{ deviceSerial: rows[0]?.serial ?? 'TLT-DEMO-001', lat: -19.8436, lng: 34.8389, speedKmh: 62, heading: 270, accuracyM: 8, gnssTime: new Date().toISOString(), seq: 10231, ignition: true, fixQuality: '3D' }] }, null, 2))
  }

  return (
    <div className="space-y-4">
      <ErroAlerta erro={erro} />
      <Panel title="Integração de telemetria" description="Camada de adaptadores: o fornecedor real é convertido para o contrato comum sem alterar os módulos de viagem/despesas."
        actions={isDemo && <Button size="sm" variant="outline" onClick={copiarIngest}><FileUp className="mr-1 h-4 w-4" />Copiar payload de teste</Button>}>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border p-3"><b className="block text-xs uppercase text-muted-foreground">Endpoint de ingestão</b><code className="text-xs">POST /api/gps/ingest</code><p className="mt-1 text-xs text-muted-foreground">Autenticação: Bearer apiKey do dispositivo. Lotes store-and-forward com seq deduplicada.</p></div>
          <div className="rounded-lg border p-3"><b className="block text-xs uppercase text-muted-foreground">Adaptadores</b><code className="text-xs">generic-json</code><p className="mt-1 text-xs text-muted-foreground">Fornecedor real (Teltonika, Queclink…) acrescenta o seu adapter - homologação pendente.</p></div>
          <div className="rounded-lg border p-3"><b className="block text-xs uppercase text-muted-foreground">Documentação viva</b><code className="text-xs">GET /api/gps/ingest</code><p className="mt-1 text-xs text-muted-foreground">Contrato, exemplo de payload e regras de deduplicação/histórico.</p></div>
        </div>
      </Panel>

      <Panel title={`Rastreadores (${rows.length})`} description="Fonte primária de posição - um por camião; chave por dispositivo com rotação"
        actions={podeGerir && <Button size="sm" onClick={() => setNovo(true)}><Plus className="mr-1 h-4 w-4" />Novo dispositivo</Button>}>
        <DataTable rows={rows} columns={[
          { key: 'serial', header: 'Série/IMEI', render: (d) => <div><span className="font-medium">{d.serial}</span><div className="text-xs text-muted-foreground">{d.imei}</div></div> },
          { key: 'vendor', header: 'Fornecedor', render: (d) => d.vendor ?? '-', hideOnMobile: true },
          { key: 'vehicle', header: 'Veículo', render: (d) => d.vehicle ? <span className="font-medium">{d.vehicle.plate}</span> : <span className="text-muted-foreground">Sem associação</span> },
          { key: 'sim', header: 'SIM', render: (d) => d.simNumber ?? '-', hideOnMobile: true },
          { key: 'last', header: 'Último ponto', render: (d) => fmtData(d.lastPointAt, true), hideOnMobile: true },
          { key: 'status', header: 'Estado', render: (d) => <StatusBadge estado={d.status} mapa={{}} /> },
          { key: 'actions', header: '', render: (d) => podeGerir && (
            <div className="flex gap-1.5">
              <Selecao value={d.vehicleId ?? ''} onChange={(v) => v && atribuir(d, v)} opcoes={[{ value: '', label: 'Associar a…' }, ...vehicles.map((v) => ({ value: v.id, label: v.plate }))]} />
              <Button size="sm" variant="outline" title="Rodar chave de API" onClick={() => setConfirmarRotacao(d)}><KeyRound className="h-3.5 w-3.5" /></Button>
            </div>
          ) },
        ]} />
      </Panel>

      <Modal open={novo} onOpenChange={setNovo} title="Novo rastreador GPS" description="Registe a instalação (local, instalador) para validação por técnico."
        footer={<><Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button><Button onClick={criar}>Registar</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nº de série" required><EntradaTexto value={form.serial ?? ''} onChange={(e) => setForm({ ...form, serial: e.target.value })} /></Campo>
          <Campo label="IMEI"><EntradaTexto value={form.imei ?? ''} onChange={(e) => setForm({ ...form, imei: e.target.value })} /></Campo>
          <Campo label="Fornecedor" hint="A homologar"><EntradaTexto value={form.vendor ?? ''} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></Campo>
          <Campo label="Nº SIM / roaming"><EntradaTexto value={form.simNumber ?? ''} onChange={(e) => setForm({ ...form, simNumber: e.target.value })} /></Campo>
        </div>
      </Modal>

      <Confirmacao open={!!confirmarRotacao} onOpenChange={(v) => !v && setConfirmarRotacao(null)}
        titulo={`Rodar chave de API - ${confirmarRotacao?.serial}`} perigo exigirTexto="RODAR"
        mensagem="A chave actual deixa de ser aceita imediatamente. Actualize a configuração do equipamento com a nova chave. Operação auditada."
        onConfirm={() => confirmarRotacao && rodarChave(confirmarRotacao)} />

      <Modal open={!!novaChave} onOpenChange={(v) => !v && setNovaChave(null)} title="Nova chave de API gerada"
        description="Guarde com segurança - não será mostrada novamente."
        footer={<Button onClick={() => setNovaChave(null)}>Entendido</Button>}>
        <code className="block break-all rounded bg-muted p-3 text-sm">{novaChave}</code>
      </Modal>
    </div>
  )
}

function Documentos({ podeGerir }: { podeGerir: boolean }) {
  const [rows, setRows] = React.useState<Doc[]>([])
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([])
  const [drivers, setDrivers] = React.useState<Driver[]>([])
  const [erro, setErro] = React.useState<string | null>(null)
  const [novo, setNovo] = React.useState(false)
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [filtro, setFiltro] = React.useState('')

  const carregar = React.useCallback(async () => {
    try {
      const [d, v, m] = await Promise.all([api<{ documents: Doc[] }>('/api/documents'), api<{ vehicles: Vehicle[] }>('/api/vehicles'), api<{ drivers: Driver[] }>('/api/drivers')])
      setRows(d.documents); setVehicles(v.vehicles); setDrivers(m.drivers); setErro(null)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar documentos.') }
  }, [])
  React.useEffect(() => { carregar() }, [carregar])

  const criar = async () => {
    try {
      await api('/api/documents', { method: 'POST', body: { ...form, ownerType: form.ownerType || 'VEHICLE', vehicleId: form.ownerType === 'VEHICLE' ? form.ownerId : undefined, driverId: form.ownerType === 'DRIVER' ? form.ownerId : undefined, blocking: form.blocking === '1' } })
      setNovo(false); setForm({}); carregar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao criar documento.') }
  }

  const TIPOS = [
    { value: 'seguro', label: 'Seguro' }, { value: 'inspecao', label: 'Inspecção' },
    { value: 'licenca', label: 'Licença' }, { value: 'autorizacao_transfronteira', label: 'Autorização transfronteiriça' },
    { value: 'carta_conducao', label: 'Carta de condução' }, { value: 'aduaneiro', label: 'Documento aduaneiro' },
    { value: 'certificado_carga', label: 'Certificado de carga' }, { value: 'outro', label: 'Outro' },
  ]

  return (
    <div className="space-y-4">
      <ErroAlerta erro={erro} />
      <div className="flex flex-wrap gap-2">
        {[{ k: '', l: 'Todos' }, { k: 'expiring', l: 'A expirar (30 dias)' }, { k: 'expired', l: 'Expirados' }].map((f) => (
          <Button key={f.k} size="sm" variant={filtro === f.k ? 'default' : 'outline'} onClick={() => { setFiltro(f.k); api<{ documents: Doc[] }>(`/api/documents${f.k ? `?filter=${f.k}` : ''}`).then((r) => setRows(r.documents)) }}>{f.l}</Button>
        ))}
        {podeGerir && <Button size="sm" className="ml-auto" onClick={() => setNovo(true)}><Plus className="mr-1 h-4 w-4" />Novo documento</Button>}
      </div>
      <Panel title={`Documentos (${rows.length})`} description="Vencimentos com alerta; bloqueantes expirados impedem a partida">
        <DataTable rows={rows} columns={[
          { key: 'type', header: 'Tipo', render: (d) => <span className="font-medium">{TIPOS.find((t) => t.value === d.type)?.label ?? d.type}</span> },
          { key: 'number', header: 'Número', hideOnMobile: true },
          { key: 'owner', header: 'Associado a', render: (d) => d.ownerType === 'VEHICLE' ? (vehicles.find((v) => v.id === d.vehicleId)?.plate ?? '-') : d.ownerType === 'DRIVER' ? (drivers.find((x) => x.id === d.driverId)?.name ?? '-') : d.ownerType },
          { key: 'expiresAt', header: 'Validade', render: (d) => <span className={d.status === 'EXPIRED' ? 'text-red-600 font-medium' : d.status === 'EXPIRING' ? 'text-amber-600' : ''}>{fmtData(d.expiresAt)}</span> },
          { key: 'blocking', header: 'Bloqueante', render: (d) => d.blocking ? <Badge variant="outline" className="border-red-300 text-red-700">Sim - bloqueia partida</Badge> : 'Não' },
          { key: 'status', header: 'Estado', render: (d) => <StatusBadge estado={d.status} mapa={{ VALID: 'Válido', EXPIRING: 'A expirar', EXPIRED: 'Expirado' }} /> },
          { key: 'country', header: 'País', render: (d) => d.issuerCountry ?? '-', hideOnMobile: true },
        ]} />
      </Panel>

      <Modal open={novo} onOpenChange={setNovo} title="Novo documento" description="Lista configurável por rota/país - a completude legal exige validação de especialista local."
        footer={<><Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button><Button onClick={criar}>Registar</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Associado a" required><Selecao value={form.ownerType ?? 'VEHICLE'} onChange={(v) => setForm({ ...form, ownerType: v })} opcoes={[{ value: 'VEHICLE', label: 'Veículo' }, { value: 'DRIVER', label: 'Motorista' }]} /></Campo>
          <Campo label={form.ownerType === 'DRIVER' ? 'Motorista' : 'Veículo'} required>
            <Selecao value={form.ownerId ?? ''} onChange={(v) => setForm({ ...form, ownerId: v })} opcoes={[{ value: '', label: 'Seleccionar…' }, ...(form.ownerType === 'DRIVER' ? drivers.map((d) => ({ value: d.id, label: d.name })) : vehicles.map((v) => ({ value: v.id, label: v.plate })))]} />
          </Campo>
          <Campo label="Tipo" required><Selecao value={form.type ?? 'seguro'} onChange={(v) => setForm({ ...form, type: v })} opcoes={TIPOS} /></Campo>
          <Campo label="Número"><EntradaTexto value={form.number ?? ''} onChange={(e) => setForm({ ...form, number: e.target.value })} /></Campo>
          <Campo label="Emissão"><EntradaTexto type="date" value={form.issuedAt ?? ''} onChange={(e) => setForm({ ...form, issuedAt: e.target.value })} /></Campo>
          <Campo label="Validade" required><EntradaTexto type="date" value={form.expiresAt ?? ''} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></Campo>
          <Campo label="País emissor"><EntradaTexto value={form.issuerCountry ?? 'MZ'} onChange={(e) => setForm({ ...form, issuerCountry: e.target.value })} /></Campo>
          <Campo label="Bloqueante" hint="Expirado → impede autorização de partida"><Selecao value={form.blocking ?? '0'} onChange={(v) => setForm({ ...form, blocking: v })} opcoes={[{ value: '0', label: 'Não' }, { value: '1', label: 'Sim' }]} /></Campo>
        </div>
      </Modal>
    </div>
  )
}
