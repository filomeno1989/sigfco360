// SIGFCO - Painel inicial: viagens activas, frota, GPS,
// alertas críticos, despesas pendentes, manutenção e documentos a expirar
'use client'

import * as React from 'react'
import { useApp } from './root'
import { api, fmtMT, fmtData } from '@/lib/client/api'
import { Page, Kpi, Panel, StatusBadge, Carregando, ErroAlerta } from './ui-kit'
import { Button } from '@/components/ui/button'
import { RefreshCw, PlayCircle } from 'lucide-react'

type Dash = {
  serverTime: string
  vehiclesByStatus: Record<string, number>
  activeTrips: Array<{ id: string; code: string; status: string; origin: string; destination: string; vehicle: string; driver: string; departureAt: string | null; plannedStart: string }>
  expensesByStatus: Record<string, { count: number; totalMinor: number }>
  alertsBySeverity: Record<string, number>
  indicators: {
    docsExpiring30d: number; docsExpiredBlocking: number; workordersOpen: number
    pendingSyncRecords: number; unreadNotifications: number; activeDrivers: number
    gps: { live: number; delayed: number; noComm: number; noPower: number }
    expensesLast30d: Record<string, { count: number; totalMinor: number }>
  }
}

export function DashboardView() {
  const { sessao, setVista } = useApp()
  const [data, setData] = React.useState<Dash | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const carregar = React.useCallback(async () => {
    setBusy(true)
    try { setData(await api<Dash>('/api/reports/dashboard')); setErro(null) }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar painel.') }
    finally { setBusy(false) }
  }, [])

  React.useEffect(() => { carregar(); const t = setInterval(carregar, 45_000); return () => clearInterval(t) }, [carregar])

  if (erro) return <Page title="Painel"><ErroAlerta erro={erro} /></Page>
  if (!data) return <Page title="Painel"><Carregando /></Page>

  const v = data.vehiclesByStatus
  const exp = data.indicators.expensesLast30d
  const aprovado = exp['APPROVED']?.totalMinor ?? 0
  const pendente = (exp['SUBMITTED']?.totalMinor ?? 0) + (exp['IN_REVIEW']?.totalMinor ?? 0)
  const ccy = sessao.company?.currencyBase ?? 'MZN'

  return (
    <Page title={`Bom dia, ${sessao.user.name.split(' (')[0]}`} subtitle={`Resumo operacional - dados de ${sessao.company?.name}`}
      actions={<Button variant="outline" size="sm" onClick={carregar} disabled={busy}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Actualizar</Button>}
      demo={sessao.company?.isDemo}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Frota disponível" value={`${v['AVAILABLE'] ?? 0}/${Object.values(v).reduce((a, b) => a + b, 0)}`} hint={`${v['IN_TRANSIT'] ?? 0} em trânsito • ${v['MAINTENANCE'] ?? 0} em manutenção • ${v['BLOCKED'] ?? 0} bloqueados`} tone={(v['BLOCKED'] ?? 0) > 0 ? 'warn' : 'ok'} />
        <Kpi label="Viagens activas" value={data.activeTrips.length} hint={`${data.indicators.activeDrivers} motoristas activos`} tone="muted" />
        <Kpi label="Telemetria GPS" value={`${data.indicators.gps.live} actuais`} hint={`${data.indicators.gps.delayed} atrasados • ${data.indicators.gps.noComm} sem comunicação • ${data.indicators.gps.noPower} energia`} tone={data.indicators.gps.noComm > 0 ? 'warn' : 'ok'} />
        <Kpi label="Alertas abertos" value={(data.alertsBySeverity['CRITICAL'] ?? 0) + (data.alertsBySeverity['HIGH'] ?? 0) + (data.alertsBySeverity['MEDIUM'] ?? 0)} hint={`${data.alertsBySeverity['CRITICAL'] ?? 0} críticos • ${data.alertsBySeverity['HIGH'] ?? 0} altos`} tone={(data.alertsBySeverity['CRITICAL'] ?? 0) > 0 ? 'crit' : 'muted'} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Despesas aprovadas (30d)" value={fmtMT(aprovado, ccy)} hint={`${exp['APPROVED']?.count ?? 0} registos`} />
        <Kpi label="Despesas pendentes (30d)" value={fmtMT(pendente, ccy)} hint="Submetidas + em revisão - não somadas às aprovadas" tone="warn" />
        <Kpi label="Documentos a expirar (30d)" value={data.indicators.docsExpiring30d} hint={`${data.indicators.docsExpiredBlocking} bloqueantes já expirados`} tone={data.indicators.docsExpiredBlocking > 0 ? 'crit' : 'muted'} />
        <Kpi label="Manutenção em aberto" value={data.indicators.workordersOpen} hint="Ordens de serviço activas" tone="muted" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Viagens activas" description="Últimas por partida; clique para abrir" className="lg:col-span-2">
          {data.activeTrips.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem viagens activas neste momento.</p>
          ) : (
            <div className="divide-y">
              {data.activeTrips.map((t) => (
                <button key={t.id} onClick={() => setVista('viagens')} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-left text-sm hover:bg-muted/40 rounded px-1 -mx-1">
                  <span className="font-medium">{t.code}</span>
                  <StatusBadge estado={t.status} mapa={{}} />
                  <span className="text-muted-foreground">{t.origin} → {t.destination}</span>
                  <span className="text-muted-foreground">{t.vehicle} • {t.driver}</span>
                  <span className="ml-auto text-xs text-muted-foreground">Partida: {fmtData(t.departureAt ?? t.plannedStart, true)}</span>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Acesso rápido">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="justify-start" onClick={() => setVista('viagens')}><PlayCircle className="mr-2 h-4 w-4" />Planear viagem</Button>
            <Button variant="outline" className="justify-start" onClick={() => setVista('mapa')}>Ver mapa da frota</Button>
            <Button variant="outline" className="justify-start" onClick={() => setVista('despesas')}>Fila de despesas</Button>
            <Button variant="outline" className="justify-start" onClick={() => setVista('documentos')}>Documentos</Button>
          </div>
        </Panel>

        <Panel title="Qualidade dos indicadores" description="Transparência sobre fontes e limitações">
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>• Despesas pendentes <b>não</b> são somadas às aprovadas nos totais.</li>
            <li>• Tempo sem telemetria GPS <b>não</b> é contado como veículo parado.</li>
            <li>• Consumo indicado como <i>estimado</i> quando o método é estimado.</li>
            <li>• {data.indicators.pendingSyncRecords} registos de sincronização aguardam processamento.</li>
          </ul>
        </Panel>
      </div>
    </Page>
  )
}
