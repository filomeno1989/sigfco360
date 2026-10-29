// SIGFCO - Financeiro: adiantamentos, reconciliação, per diem, taxas de
// câmbio - taxas manuais exigem permissão e
// ficam auditadas; valores originais nunca substituídos
'use client'

import * as React from 'react'
import { useApp } from './root'
import { api, fmtData, fmtMT, parseMT } from '@/lib/client/api'
import { Page, Panel, DataTable, Campo, EntradaTexto, Selecao, Modal, Button, ErroAlerta, Kpi } from './ui-kit'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Calculator } from 'lucide-react'

type Advance = { id: string; amountMinor: number; currency: string; method?: string; docRef?: string; grantedAt: string; settledMinor?: number | null; driver?: { name: string }; trip?: { code: string } }
type Rule = { id: string; country: string; city?: string | null; amountMinor: number; currency: string; active: boolean }
type Rate = { id: string; fromCcy: string; toCcy: string; rate: string; source: string; note?: string | null; effectiveAt: string }
type Recon = { baseCurrency: string; balances: Array<{ currency: string; advanceMinor: number; approvedMinor: number; balanceMinor: number }>; pendingExpenses: number; rejectedExpenses: number }
type TripOpt = { id: string; code: string; status: string; driverId: string }

export function FinanceiroView() {
  const { sessao } = useApp()
  const podeGerir = ['FINANCE', 'COMPANY_ADMIN', 'PLATFORM_ADMIN'].includes(sessao.user.role)
  return (
    <Page title="Financeiro" subtitle="Adiantamentos, per diem, câmbio e reconciliação - valores originais preservados com taxa registada" demo={sessao.company?.isDemo}>
      <Tabs defaultValue="adiantamentos">
        <TabsList>
          <TabsTrigger value="adiantamentos">Adiantamentos</TabsTrigger>
          <TabsTrigger value="perdiem">Per diem</TabsTrigger>
          <TabsTrigger value="cambio">Taxas de câmbio</TabsTrigger>
        </TabsList>
        <TabsContent value="adiantamentos"><Adiantamentos podeGerir={podeGerir} /></TabsContent>
        <TabsContent value="perdiem"><PerDiem podeGerir={podeGerir} /></TabsContent>
        <TabsContent value="cambio"><Cambios podeGerir={podeGerir} /></TabsContent>
      </Tabs>
    </Page>
  )
}

function Adiantamentos({ podeGerir }: { podeGerir: boolean }) {
  const [rows, setRows] = React.useState<Advance[]>([])
  const [trips, setTrips] = React.useState<TripOpt[]>([])
  const [erro, setErro] = React.useState<string | null>(null)
  const [novo, setNovo] = React.useState(false)
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [tripId, setTripId] = React.useState('')
  const [recon, setRecon] = React.useState<Recon | null>(null)

  const carregar = React.useCallback(async () => {
    try {
      const r = await api<{ advances: Advance[]; reconciliation: Recon | null }>(`/api/advances${tripId ? `?tripId=${tripId}` : ''}`)
      setRows(r.advances); setRecon(r.reconciliation); setErro(null)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar adiantamentos.') }
  }, [tripId])
  React.useEffect(() => {
    carregar()
    api<{ trips: TripOpt[] }>('/api/trips').then((r) => setTrips(r.trips.filter((t) => !['DRAFT', 'CANCELLED'].includes(t.status)))).catch(() => {})
  }, [carregar])

  const criar = async () => {
    try {
      await api('/api/advances', { method: 'POST', body: { tripId: form.tripId, driverId: form.driverId, amountMinor: parseMT(form.valor), currency: form.currency ?? 'MZN', method: form.method, docRef: form.docRef } })
      setNovo(false); setForm({}); carregar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao criar adiantamento.') }
  }

  return (
    <div className="space-y-4">
      <ErroAlerta erro={erro} />
      <div className="flex flex-wrap items-center gap-2">
        <Selecao value={tripId} onChange={setTripId} opcoes={[{ value: '', label: 'Todas as viagens' }, ...trips.map((t) => ({ value: t.id, label: t.code }))]} />
        {podeGerir && <Button size="sm" className="ml-auto" onClick={() => setNovo(true)}><Plus className="mr-1 h-4 w-4" />Novo adiantamento</Button>}
      </div>

      {recon && (
        <Panel title="Reconciliação da viagem" description="Saldo por moeda: positivo = a devolver pelo motorista; negativo = a reembolsar. Sem mistura de moedas sem taxa.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recon.balances.map((b) => (
              <Kpi key={b.currency} label={b.currency} value={fmtMT(b.balanceMinor, b.currency)}
                hint={`Adiantado ${fmtMT(b.advanceMinor, b.currency)} • Aprovado ${fmtMT(b.approvedMinor, b.currency)}`}
                tone={b.balanceMinor >= 0 ? 'muted' : 'warn'} />
            ))}
            <Kpi label="Pendências" value={`${recon.pendingExpenses} despesas`} hint={`${recon.rejectedExpenses} rejeitadas`} tone={recon.pendingExpenses > 0 ? 'warn' : 'ok'} />
          </div>
        </Panel>
      )}

      <Panel title={`Adiantamentos (${rows.length})`}>
        <DataTable rows={rows} columns={[
          { key: 'trip', header: 'Viagem', render: (a) => a.trip?.code ?? '-' },
          { key: 'driver', header: 'Motorista', render: (a) => a.driver?.name ?? '-' },
          { key: 'valor', header: 'Valor', render: (a) => <b>{fmtMT(a.amountMinor, a.currency)}</b> },
          { key: 'data', header: 'Concedido', render: (a) => fmtData(a.grantedAt), hideOnMobile: true },
          { key: 'method', header: 'Método', render: (a) => a.method ?? '-', hideOnMobile: true },
          { key: 'doc', header: 'Ref. documento', render: (a) => a.docRef ?? '-', hideOnMobile: true },
          { key: 'settled', header: 'Liquidado', render: (a) => a.settledMinor != null ? fmtMT(a.settledMinor, a.currency) : '-' },
        ]} />
      </Panel>

      <Modal open={novo} onOpenChange={setNovo} title="Novo adiantamento"
        footer={<><Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button><Button onClick={criar}>Conceder</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Viagem" required><Selecao value={form.tripId ?? ''} onChange={(v) => setForm({ ...form, tripId: v })} opcoes={[{ value: '', label: 'Seleccionar…' }, ...trips.map((t) => ({ value: t.id, label: t.code }))]} /></Campo>
          <Campo label="Valor" required><EntradaTexto placeholder="Ex.: 15.000,00" value={form.valor ?? ''} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Campo>
          <Campo label="Moeda"><Selecao value={form.currency ?? 'MZN'} onChange={(v) => setForm({ ...form, currency: v })} opcoes={[{ value: 'MZN', label: 'MZN' }, { value: 'USD', label: 'USD' }, { value: 'ZAR', label: 'ZAR' }, { value: 'ZWG', label: 'ZWG' }]} /></Campo>
          <Campo label="Método"><Selecao value={form.method ?? 'DINHEIRO'} onChange={(v) => setForm({ ...form, method: v })} opcoes={[{ value: 'DINHEIRO', label: 'Dinheiro' }, { value: 'TRANSFERENCIA', label: 'Transferência' }, { value: 'MOMO', label: 'Mobile money' }]} /></Campo>
          <Campo label="Referência de autorização"><EntradaTexto value={form.docRef ?? ''} onChange={(e) => setForm({ ...form, docRef: e.target.value })} /></Campo>
        </div>
      </Modal>
    </div>
  )
}

function PerDiem({ podeGerir }: { podeGerir: boolean }) {
  const [rows, setRows] = React.useState<Rule[]>([])
  const [novo, setNovo] = React.useState(false)
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [calc, setCalc] = React.useState<{ country: string; days: string } | null>(null)
  const [resultado, setResultado] = React.useState<string | null>(null)
  const carregar = React.useCallback(async () => setRows((await api<{ rules: Rule[] }>('/api/perdiem-rules')).rules), [])
  React.useEffect(() => { carregar() }, [carregar])

  const criar = async () => {
    try {
      await api('/api/perdiem-rules', { method: 'POST', body: { country: form.country, city: form.city, amountMinor: parseMT(form.valor), currency: form.currency ?? 'MZN' } })
      setNovo(false); setForm({}); carregar()
    } catch { /* erro tratado */ }
  }

  const calcular = async () => {
    if (!calc) return
    try {
      const r = await api<{ calculation: { explanation: string; totalMinor: number; currency: string } }>('/api/perdiem-rules', { method: 'POST', body: { action: 'calculate', country: calc.country, days: Number(calc.days) } })
      setResultado(`${r.calculation.explanation} = ${fmtMT(r.calculation.totalMinor, r.calculation.currency)}`)
    } catch (e) { setResultado(e instanceof Error ? e.message : 'Falha no cálculo.') }
  }

  const PAISES = [
    { value: 'MZ', label: 'Moçambique' }, { value: 'ZW', label: 'Zimbabwe' },
    { value: 'MW', label: 'Malawi' }, { value: 'ZM', label: 'Zâmbia' }, { value: 'CD', label: 'RD Congo' }, { value: 'ZA', label: 'África do Sul' },
  ]

  return (
    <div className="space-y-4">
      <Panel title="Calculadora de per diem" description="Apresenta as regras usadas; alterações manuais exigem motivo e permissão."
        actions={<Button size="sm" variant="outline" onClick={() => setCalc({ country: 'ZW', days: '1' })}><Calculator className="mr-1 h-4 w-4" />Calcular</Button>}>
        {resultado && <p className="rounded border border-teal-300 bg-teal-50 p-2.5 text-sm text-teal-900">{resultado}</p>}
      </Panel>
      <Panel title={`Regras de per diem (${rows.length})`} actions={podeGerir && <Button size="sm" onClick={() => setNovo(true)}><Plus className="mr-1 h-4 w-4" />Nova regra</Button>}>
        <DataTable rows={rows} columns={[
          { key: 'country', header: 'País', render: (r) => PAISES.find((p) => p.value === r.country)?.label ?? r.country },
          { key: 'city', header: 'Cidade', render: (r) => r.city ?? 'Todo o país' },
          { key: 'valor', header: 'Taxa diária', render: (r) => <b>{fmtMT(r.amountMinor, r.currency)}</b> },
          { key: 'active', header: 'Activa', render: (r) => r.active ? 'Sim' : 'Não' },
        ]} />
      </Panel>
      <Modal open={novo} onOpenChange={setNovo} title="Nova regra de per diem"
        footer={<><Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button><Button onClick={criar}>Registar</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="País" required><Selecao value={form.country ?? 'MZ'} onChange={(v) => setForm({ ...form, country: v })} opcoes={PAISES} /></Campo>
          <Campo label="Cidade (opcional)"><EntradaTexto value={form.city ?? ''} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Campo>
          <Campo label="Taxa diária" required><EntradaTexto placeholder="Ex.: 4.000,00" value={form.valor ?? ''} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Campo>
          <Campo label="Moeda"><Selecao value={form.currency ?? 'MZN'} onChange={(v) => setForm({ ...form, currency: v })} opcoes={[{ value: 'MZN', label: 'MZN' }, { value: 'USD', label: 'USD' }]} /></Campo>
        </div>
      </Modal>
      <Modal open={!!calc} onOpenChange={(v) => !v && setCalc(null)} title="Calcular per diem"
        footer={<><Button variant="outline" onClick={() => setCalc(null)}>Fechar</Button><Button onClick={calcular}>Calcular</Button></>}>
        {calc && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="País"><Selecao value={calc.country} onChange={(v) => setCalc({ ...calc, country: v })} opcoes={PAISES} /></Campo>
            <Campo label="Dias"><EntradaTexto type="number" value={calc.days} onChange={(e) => setCalc({ ...calc, days: e.target.value })} /></Campo>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Cambios({ podeGerir }: { podeGerir: boolean }) {
  const [rows, setRows] = React.useState<Rate[]>([])
  const [erro, setErro] = React.useState<string | null>(null)
  const [novo, setNovo] = React.useState(false)
  const [form, setForm] = React.useState<Record<string, string>>({})
  const carregar = React.useCallback(async () => {
    try { setRows((await api<{ rates: Rate[] }>('/api/exchange-rates')).rates); setErro(null) }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar taxas.') }
  }, [])
  React.useEffect(() => { carregar() }, [carregar])

  const criar = async () => {
    try { await api('/api/exchange-rates', { method: 'POST', body: { ...form, note: form.note || 'Taxa definida manualmente' } }); setNovo(false); setForm({}); carregar() }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao registar taxa.') }
  }

  return (
    <div className="space-y-4">
      <ErroAlerta erro={erro} />
      <Panel title="Regra de câmbio" description="Toda a taxa tem origem explícita. Fonte API/automática só é activada após credenciais e teste real - enquanto isso, registo manual auditado.">
        <p className="text-sm text-muted-foreground">A conversão guardada por despesa mantém o valor original, a taxa aplicada, a data e a fonte - reproduzível a partir dos dados.</p>
      </Panel>
      <Panel title={`Taxas registadas (${rows.length})`} actions={podeGerir && <Button size="sm" onClick={() => setNovo(true)}><Plus className="mr-1 h-4 w-4" />Registar taxa</Button>}>
        <DataTable rows={rows} columns={[
          { key: 'par', header: 'Par', render: (r) => <b>{r.fromCcy} → {r.toCcy}</b> },
          { key: 'rate', header: 'Taxa', render: (r) => r.rate },
          { key: 'source', header: 'Fonte', render: (r) => ({ MANUAL: 'Manual (auditada)', API: 'API externa', TRIP_TABLE: 'Tabela de viagem', BASE: 'Moeda base' }[r.source] ?? r.source) },
          { key: 'effectiveAt', header: 'Efectiva desde', render: (r) => fmtData(r.effectiveAt, true) },
          { key: 'note', header: 'Nota', render: (r) => r.note ?? '-', hideOnMobile: true },
        ]} />
      </Panel>
      <Modal open={novo} onOpenChange={setNovo} title="Registar taxa de câmbio" description="Operação crítica - alterações ficam auditadas com autor, data e valor."
        footer={<><Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button><Button onClick={criar}>Registar</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="De" required><Selecao value={form.fromCcy ?? 'USD'} onChange={(v) => setForm({ ...form, fromCcy: v })} opcoes={[{ value: 'USD', label: 'USD' }, { value: 'ZAR', label: 'ZAR' }, { value: 'ZWG', label: 'ZWG' }, { value: 'MWK', label: 'MWK' }, { value: 'ZMW', label: 'ZMW' }, { value: 'CDF', label: 'CDF' }]} /></Campo>
          <Campo label="Para" required><Selecao value={form.toCcy ?? 'MZN'} onChange={(v) => setForm({ ...form, toCcy: v })} opcoes={[{ value: 'MZN', label: 'MZN' }]} /></Campo>
          <Campo label="Taxa" required hint="Ex.: 63.85"><EntradaTexto value={form.rate ?? ''} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></Campo>
          <Campo label="Nota"><EntradaTexto value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Campo>
        </div>
      </Modal>
    </div>
  )
}
