// =====================================================================
// SIGFCO — App do Motorista (§8, MOB-001..005, OFF-001..010)
// Offline-first: registos em IndexedDB com UUID; estados visíveis
// ("Guardado neste telemóvel" → "Sincronizado" — OFF-006); fotos
// comprimidas (AT-011); reenvio idempotente (AT-009); SOS discreto com
// confirmação (GPS-026); aviso de não usar o telemóvel em movimento
// (MOB-005). Limitações de PWA declaradas sem falsas promessas (§8.3).
// =====================================================================
'use client'

import * as React from 'react'
import { useApp } from './root'
import { api, fmtData, fmtMT, parseMT } from '@/lib/client/api'
import {
  filaListar, filaGuardar, filaMarcar, filaRemover, novoUuid, comprimirImagem, obterPosicao,
  iniciarAutoSync, type FilaItem,
} from '@/lib/client/offline'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ErroAlerta, Confirmacao } from './ui-kit'
import {
  Route, Camera, AlertTriangle, Wifi, WifiOff, RefreshCw, CheckCircle2, Clock,
  CloudUpload, Siren, MapPin, ChevronRight, ShieldAlert,
} from 'lucide-react'

type Trip = { id: string; code: string; origin: string; destination: string; status: string; client?: string; cargoDesc?: string; plannedStart: string; departureAt?: string | null }
type ChecklistRun = { id: string; itemsJson: string; status: string }
type ExpenseStatus = { id: string; code: string; category: string; amountMinor: number; currency: string; status: string; expenseDate: string }
type Detail = { trip: Trip; expenses: ExpenseStatus[]; checklist: ChecklistRun | null }

const CATS = [
  { value: 'combustivel', label: 'Combustível' }, { value: 'portagens', label: 'Portagens' },
  { value: 'alfandega', label: 'Alfândega' }, { value: 'per_diem', label: 'Per diem' },
  { value: 'estacionamento', label: 'Estacionamento' }, { value: 'alimentacao', label: 'Alimentação' },
  { value: 'alojamento', label: 'Alojamento' }, { value: 'comunicacao', label: 'Comunicação' },
  { value: 'manutencao_emergencia', label: 'Manutenção emerg.' }, { value: 'outros', label: 'Outros' },
]

export function MotoristaApp() {
  const { sessao, logout } = useApp()
  const [detail, setDetail] = React.useState<Detail | null>(null)
  const [fila, setFila] = React.useState<FilaItem[]>([])
  const [online, setOnline] = React.useState(true)
  const [gpsOk, setGpsOk] = React.useState<'ok' | 'negado' | 'indisponivel' | 'verificando'>('verificando')
  const [erro, setErro] = React.useState<string | null>(null)
  const [vista, setVista] = React.useState<'viagem' | 'despesas' | 'fila'>('viagem')

  const carregar = React.useCallback(async () => {
    try {
      const list = await api<{ trips: Trip[] }>('/api/trips')
      const activa = list.trips.find((t) => ['AWAITING_CHECKLIST', 'AUTHORIZED_DEPARTURE', 'IN_TRANSIT', 'PAUSED', 'ARRIVED'].includes(t.status))
      if (activa) {
        const det = await api<Detail>(`/api/trips/${activa.id}`)
        setDetail(det); setErro(null)
      } else setDetail(null)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar viagem.') }
  }, [])

  const refrescarFila = React.useCallback(() => { filaListar().then(setFila) }, [])

  React.useEffect(() => {
    carregar(); refrescarFila()
    setOnline(navigator.onLine)
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    const limpar = iniciarAutoSync(refrescarFila)
    // FR-052: estado da localização no momento do registo
    if ('geolocation' in navigator) {
      navigator.permissions?.query({ name: 'geolocation' as PermissionName }).then((p) => {
        setGpsOk(p.state === 'granted' ? 'ok' : p.state === 'denied' ? 'negado' : 'indisponivel')
      }).catch(() => setGpsOk('indisponivel'))
    } else setGpsOk('indisponivel')
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); limpar() }
  }, [carregar, refrescarFila])

  const pendentes = fila.filter((f) => f.estadoLocal !== 'SINCRONIZADO')

  return (
    <div className="min-h-screen flex flex-col bg-zinc-100 pb-16">
      {/* Cabeçalho compacto (MOB-004: uso com uma mão) */}
      <header className="sticky top-0 z-20 bg-zinc-950 text-zinc-100 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-sm font-bold">SF</span>
            <div>
              <div className="text-sm font-semibold leading-tight">{sessao.driver?.name ?? sessao.user.name.split(' (')[0]}</div>
              <div className="text-[11px] text-zinc-400">App do Motorista • DEMO</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {online ? <Badge className="bg-emerald-700 text-white gap-1"><Wifi className="h-3 w-3" />Online</Badge> : <Badge className="bg-amber-600 text-white gap-1"><WifiOff className="h-3 w-3" />Sem internet</Badge>}
            <Button size="sm" variant="ghost" className="text-zinc-300 hover:bg-zinc-800" onClick={logout}>Sair</Button>
          </div>
        </div>
      </header>

      {/* Aviso de segurança (MOB-005) */}
      <div className="bg-amber-100 border-b border-amber-300 px-4 py-1.5 text-[11px] text-amber-900 text-center">
        <ShieldAlert className="inline h-3 w-3 mr-1" />Nunca use o telemóvel enquanto conduz. Interaja apenas com o veículo parado em local seguro.
      </div>

      <main className="flex-1 mx-auto w-full max-w-lg px-3 py-3 space-y-3">
        <ErroAlerta erro={erro} />

        {/* Indicadores precisos de GPS e rede (§11.2) */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-white border p-2.5 flex items-center gap-2">
            <MapPin className={`h-4 w-4 ${gpsOk === 'ok' ? 'text-emerald-600' : 'text-amber-600'}`} />
            <span>{gpsOk === 'ok' ? 'GPS disponível' : gpsOk === 'negado' ? 'GPS sem permissão' : 'GPS sem fixação'}</span>
          </div>
          <div className="rounded-lg bg-white border p-2.5 flex items-center gap-2">
            <CloudUpload className={`h-4 w-4 ${pendentes.length ? 'text-amber-600' : 'text-emerald-600'}`} />
            <span>{pendentes.length ? `${pendentes.length} registo(s) pendente(s)` : 'Tudo sincronizado'}</span>
          </div>
        </div>

        {vista === 'viagem' && (detail
          ? <ViagemActiva detail={detail} aoMudar={carregar} gpsOk={gpsOk} />
          : <SemViagem />)}
        {vista === 'despesas' && <DespesasMotorista detail={detail} aoMudar={carregar} refrescarFila={refrescarFila} gpsOk={gpsOk} online={online} />}
        {vista === 'fila' && <FilaSincronizacao fila={fila} refrescar={refrescarFila} />}
      </main>

      {/* Navegação inferior — alvos tácteis ≥44px (MOB-004) */}
      <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t grid grid-cols-3">
        {[
          { id: 'viagem', label: 'Viagem', icon: Route },
          { id: 'despesas', label: 'Despesas', icon: Camera },
          { id: 'fila', label: `Fila${pendentes.length ? ` (${pendentes.length})` : ''}`, icon: RefreshCw },
        ].map((n) => (
          <button key={n.id} onClick={() => setVista(n.id as typeof vista)}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] min-h-[48px] ${vista === n.id ? 'text-teal-700 font-semibold' : 'text-zinc-500'}`}>
            <n.icon className="h-5 w-5" />{n.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

function SemViagem() {
  return (
    <Card>
      <CardContent className="pt-6 text-center text-sm text-muted-foreground space-y-2">
        <Route className="mx-auto h-10 w-10 text-zinc-300" />
        <p className="font-medium text-foreground">Sem viagem activa</p>
        <p>Quando o despacho lhe atribuir uma viagem, ela aparecerá aqui com checklist, despesas e ocorrências.</p>
      </CardContent>
    </Card>
  )
}

function ViagemActiva({ detail, aoMudar, gpsOk }: { detail: Detail; aoMudar: () => void; gpsOk: string }) {
  const { trip } = detail
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState<string | null>(null)
  const [odo, setOdo] = React.useState('')
  const [sos, setSos] = React.useState(false)
  const [sosNota, setSosNota] = React.useState('')

  const checklist = detail.checklist ? (JSON.parse(detail.checklist.itemsJson) as Array<{ key: string; label: string; blocking: boolean; ok?: boolean }>) : []
  const [respostas, setRespostas] = React.useState<Record<string, boolean>>({})
  React.useEffect(() => {
    if (detail.checklist) {
      const inicial: Record<string, boolean> = {}
      for (const i of checklist) if (i.ok !== undefined) inicial[i.key] = i.ok
      setRespostas(inicial)
    }
  }, [detail.checklist?.itemsJson])  

  const agir = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true); setMsg(null)
    try {
      await api(`/api/trips/${trip.id}/actions`, { method: 'POST', body: { action, ...extra } })
      aoMudar()
      setMsg('Registado no sistema.')
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Falha na acção.') }
    finally { setBusy(false) }
  }

  const submeterChecklist = async () => {
    if (!detail.checklist) return
    setBusy(true); setMsg(null)
    try {
      const r = await api<{ passed: boolean; message: string }>(`/api/trips/${trip.id}/checklist`, {
        method: 'POST', body: { items: checklist.map((i) => ({ key: i.key, ok: respostas[i.key] })) },
      })
      setMsg(r.message); aoMudar()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Falha ao submeter checklist.') }
    finally { setBusy(false) }
  }

  const enviarSos = async () => {
    setBusy(true)
    try {
      const pos = gpsOk === 'ok' ? await obterPosicao() : null
      const uuid = novoUuid()
      // SOS funciona OFFLINE: entra na fila com hora original do dispositivo (OFF-001)
      await filaGuardar({
        clientUuid: uuid, type: 'TRIP_EVENT', deviceTime: new Date().toISOString(),
        payload: { tripId: trip.id, type: 'SOS', note: sosNota || 'Pedido de ajuda (SOS)', lat: pos?.lat, lng: pos?.lng, locSource: pos ? 'BROWSER' : 'NONE', locStatus: pos ? 'OK' : 'UNAVAILABLE' },
        estadoLocal: 'GUARDADO', tentativas: 0, resumo: `SOS — ${trip.code}`,
      })
      setSos(false); setSosNota('')
      setMsg('SOS registado. Será enviado assim que houver internet.')
    } finally { setBusy(false) }
  }

  const STATUS: Record<string, string> = {
    AWAITING_CHECKLIST: 'A aguardar checklist', AUTHORIZED_DEPARTURE: 'Autorizada para partida',
    IN_TRANSIT: 'Em trânsito', PAUSED: 'Em pausa / retida', ARRIVED: 'Chegada registada',
  }

  return (
    <>
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs text-muted-foreground">Viagem activa</div>
              <div className="text-lg font-bold">{trip.code}</div>
            </div>
            <Badge className="bg-teal-700 text-white">{STATUS[trip.status] ?? trip.status}</Badge>
          </div>
          <div className="text-sm">{trip.origin} <ChevronRight className="inline h-4 w-4 text-zinc-400" /> {trip.destination}</div>
          {trip.cargoDesc && <div className="text-xs text-muted-foreground">Carga: {trip.cargoDesc}{trip.client ? ` • Cliente: ${trip.client}` : ''}</div>}
          {msg && <div className="rounded-md border border-teal-300 bg-teal-50 px-3 py-2 text-sm text-teal-900">{msg}</div>}
        </CardContent>
      </Card>

      {/* Accões rápidas (§11.2: despesa, foto, incidente, checklist, SOS) */}
      {trip.status === 'AWAITING_CHECKLIST' && (
        <Card>
          <CardContent className="pt-5 space-y-2.5">
            <div className="font-semibold text-sm">Checklist pré-partida — confirme cada item</div>
            <p className="text-xs text-muted-foreground">O carregador de telemóvel é obrigatório: sem ele a viagem não é autorizada (requisito crítico).</p>
            {checklist.map((i) => (
              <label key={i.key} className={`flex items-start gap-2.5 rounded-lg border p-3 text-sm ${respostas[i.key] === false && i.blocking ? 'border-red-300 bg-red-50' : ''}`}>
                <Checkbox className="mt-0.5" checked={respostas[i.key] ?? false} onCheckedChange={(v) => setRespostas({ ...respostas, [i.key]: v === true })} />
                <span>{i.label}{i.blocking && <b className="ml-1 text-red-700 text-xs">(obrigatório)</b>}</span>
              </label>
            ))}
            <Button className="w-full min-h-[48px] bg-teal-700 hover:bg-teal-600" disabled={busy || checklist.some((i) => respostas[i.key] === undefined)} onClick={submeterChecklist}>
              Submeter checklist
            </Button>
          </CardContent>
        </Card>
      )}

      {trip.status === 'AUTHORIZED_DEPARTURE' && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="font-semibold text-sm">Registar partida</div>
            <div className="space-y-1.5">
              <Label htmlFor="odo">Odómetro de partida (km)</Label>
              <Input id="odo" type="number" inputMode="numeric" value={odo} onChange={(e) => setOdo(e.target.value)} className="min-h-[48px] text-lg" />
            </div>
            <Button className="w-full min-h-[48px] bg-teal-700 hover:bg-teal-600" disabled={busy || !odo} onClick={() => agir('depart', { departureOdometerKm: Number(odo) })}>
              Confirmar partida
            </Button>
          </CardContent>
        </Card>
      )}

      {['IN_TRANSIT', 'PAUSED'].includes(trip.status) && (
        <Card>
          <CardContent className="pt-5 grid grid-cols-2 gap-2">
            {trip.status === 'IN_TRANSIT' ? (
              <Button variant="outline" className="min-h-[48px]" disabled={busy} onClick={() => { const motivo = window.prompt('Motivo da paragem:'); if (motivo) agir('pause', { reason: motivo }) }}>Registar pausa</Button>
            ) : (
              <Button className="min-h-[48px] bg-teal-700 hover:bg-teal-600" disabled={busy} onClick={() => agir('resume')}>Retomar viagem</Button>
            )}
            <Button variant="outline" className="min-h-[48px]" disabled={busy} onClick={() => { const odoC = window.prompt('Odómetro de chegada (km):'); if (odoC) agir('arrive', { arrivalOdometerKm: Number(odoC) }) }}>Chegada ao destino</Button>
          </CardContent>
        </Card>
      )}

      {trip.status === 'ARRIVED' && (
        <Card><CardContent className="pt-5 text-sm text-muted-foreground">Chegada registada. Aguarde a revisão do escritório — o fecho é feito pela equipa após conferência de despesas (FR-038).</CardContent></Card>
      )}

      <Button variant="outline" className="w-full min-h-[48px] border-red-300 text-red-700 hover:bg-red-50" onClick={() => setSos(true)}>
        <Siren className="mr-2 h-4 w-4" />SOS — pedir ajuda
      </Button>
      <Confirmacao open={sos} onOpenChange={setSos} perigo exigirTexto="SOS"
        titulo="Confirmar SOS"
        mensagem="Serão enviados a viagem, coordenadas disponíveis e a hora do dispositivo. Confirme apenas em situação real — uso acidental mobiliza resposta (GPS-026)."
        onConfirm={enviarSos} />
    </>
  )
}

function DespesasMotorista({ detail, aoMudar, refrescarFila, gpsOk, online }: {
  detail: Detail | null; aoMudar: () => void; refrescarFila: () => void; gpsOk: string; online: boolean
}) {
  const [aberto, setAberto] = React.useState(false)
  const [form, setForm] = React.useState({ categoria: 'combustivel', valor: '', moeda: 'MZN', litros: '', preco: '', posto: '', descricao: '', semComprovativo: '' })
  const [foto, setFoto] = React.useState<{ dataUrl: string; width: number; height: number } | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState<string | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)

  const guardar = async (enviar: boolean) => {
    if (!detail) return
    setBusy(true); setErro(null); setMsg(null)
    try {
      const valorMinor = parseMT(form.valor)
      if (valorMinor <= 0) throw new Error('Indique o valor da despesa.')
      const pos = gpsOk === 'ok' ? await obterPosicao() : null
      const uuid = novoUuid()
      const agora = new Date().toISOString()
      await filaGuardar({
        clientUuid: uuid, type: 'EXPENSE', deviceTime: agora,
        payload: {
          tripId: detail.trip.id, category: form.categoria, amountMinor: valorMinor, currency: form.moeda,
          expenseDate: agora, vendor: form.posto || undefined, description: form.descricao || undefined,
          liters: form.litros ? Number(form.litros) : undefined,
          pricePerLiterMinor: form.preco ? Math.round(Number(form.preco.replace(',', '.')) * 100) : undefined,
          station: form.posto || undefined,
          lat: pos?.lat, lng: pos?.lng, locPrecisionM: pos?.accuracyM,
          locSource: pos ? 'BROWSER' : 'NONE',
          locStatus: pos ? 'OK' : 'UNAVAILABLE',
          locNote: pos ? undefined : (gpsOk === 'negado' ? 'Permissão de localização negada' : 'Localização indisponível no momento do registo'),
          noReceiptReason: form.semComprovativo || undefined,
          dataUrl: foto?.dataUrl, width: foto?.width, height: foto?.height, capturedAt: agora,
        },
        estadoLocal: 'GUARDADO', tentativas: 0,
        resumo: `${CATS.find((c) => c.value === form.categoria)?.label}: ${fmtMT(valorMinor, form.moeda)}`,
      })
      // tentar sincronizar imediatamente quando há rede (OFF-005)
      if (online && enviar) {
        const { sincronizar } = await import('@/lib/client/offline')
        await sincronizar()
      }
      setForm({ categoria: 'combustivel', valor: '', moeda: 'MZN', litros: '', preco: '', posto: '', descricao: '', semComprovativo: '' })
      setFoto(null); setAberto(false)
      setMsg(online ? 'Despesa guardada e submetida.' : 'Despesa guardada NESTE TELEMÓVEL — será enviada automaticamente quando houver internet.')
      refrescarFila(); aoMudar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao guardar despesa.') }
    finally { setBusy(false) }
  }

  const pegarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await comprimirImagem(file)
      setFoto(compressed)
    } catch { setErro('Não foi possível comprimir a fotografia.') }
  }

  const detalhes = detail?.expenses ?? []

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Button className="min-h-[48px] bg-teal-700 hover:bg-teal-600" onClick={() => setAberto(true)}><Camera className="mr-2 h-4 w-4" />Nova despesa + foto</Button>
        <Button variant="outline" className="min-h-[48px]" onClick={() => setAberto(true)}>Despesa sem câmara</Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="font-semibold text-sm mb-2">Despesas desta viagem</div>
          {detalhes.length === 0 && <p className="text-sm text-muted-foreground py-3 text-center">Sem despesas sincronizadas ainda.</p>}
          <div className="divide-y">
            {detalhes.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-medium">{fmtMT(e.amountMinor, e.currency)}</div>
                  <div className="text-xs text-muted-foreground">{CATS.find((c) => c.value === e.category)?.label ?? e.category} • {fmtData(e.expenseDate)}</div>
                </div>
                <Badge variant="outline" className={e.status === 'APPROVED' || e.status === 'RECONCILED' ? 'border-emerald-400 text-emerald-700' : e.status === 'REJECTED' ? 'border-red-400 text-red-700' : 'border-amber-400 text-amber-700'}>
                  {e.status === 'SUBMITTED' ? 'Pendente aprovação' : e.status === 'APPROVED' ? 'Aprovada' : e.status === 'RECONCILED' ? 'Reconciliada' : e.status === 'REJECTED' ? 'Rejeitada' : e.status === 'RETURNED' ? 'Devolver' : e.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Formulário de despesa: poucos campos por etapa (MOB-004) */}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registar despesa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <ErroAlerta erro={erro} />
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {CATS.map((c) => (
                  <button key={c.value} onClick={() => setForm({ ...form, categoria: c.value })}
                    className={`rounded-lg border px-2 py-2.5 text-xs min-h-[44px] ${form.categoria === c.value ? 'border-teal-600 bg-teal-50 font-semibold text-teal-800' : ''}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Valor</Label>
                <Input inputMode="decimal" placeholder="0,00" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="min-h-[48px] text-lg" />
              </div>
              <div className="space-y-1.5">
                <Label>Moeda</Label>
                <div className="grid grid-cols-4 gap-1">
                  {['MZN', 'USD', 'ZAR', 'ZWG'].map((m) => (
                    <button key={m} onClick={() => setForm({ ...form, moeda: m })}
                      className={`rounded border py-2 text-xs min-h-[44px] ${form.moeda === m ? 'border-teal-600 bg-teal-50 font-bold' : ''}`}>{m}</button>
                  ))}
                </div>
              </div>
            </div>
            {form.categoria === 'combustivel' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5"><Label>Litros</Label><Input inputMode="decimal" value={form.litros} onChange={(e) => setForm({ ...form, litros: e.target.value })} className="min-h-[48px]" /></div>
                <div className="space-y-1.5"><Label>Preço/litro</Label><Input inputMode="decimal" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} className="min-h-[48px]" /></div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Estabelecimento / posto</Label>
              <Input value={form.posto} onChange={(e) => setForm({ ...form, posto: e.target.value })} className="min-h-[48px]" />
            </div>
            <div className="space-y-1.5">
              <Label>Fotografia do talão</Label>
              <label className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-teal-500/60 bg-teal-50/50 px-4 text-sm text-teal-800">
                <Camera className="h-4 w-4" />{foto ? 'Fotografia pronta (comprimida no telemóvel)' : 'Tirar foto / escolher imagem'}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pegarFoto} />
              </label>
              {foto && { }}
              {foto && <img src={foto.dataUrl} alt="Pré-visualização do talão" className="max-h-40 rounded border" />}
            </div>
            {!foto && (
              <div className="space-y-1.5">
                <Label>Sem comprovativo — justificação (se autorizada pela política)</Label>
                <Input value={form.semComprovativo} onChange={(e) => setForm({ ...form, semComprovativo: e.target.value })} placeholder="Ex.: posto sem máquina fiscal" className="min-h-[48px]" />
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              {gpsOk === 'ok' ? 'A localização será anexada ao registo (FR-052).' : gpsOk === 'negado' ? 'GPS sem permissão — a despesa será sinalizada para revisão (motivo exigido).' : 'Sem fixação GPS — será registado o motivo e sinalizado para revisão.'}
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button className="w-full min-h-[48px] bg-teal-700 hover:bg-teal-600" disabled={busy} onClick={() => guardar(true)}>
              {busy ? 'A guardar…' : online ? 'Guardar e enviar' : 'Guardar no telemóvel'}
            </Button>
            <Button variant="outline" className="w-full min-h-[44px]" onClick={() => setAberto(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {msg && <div className="rounded-md border border-teal-300 bg-teal-50 px-3 py-2 text-sm text-teal-900">{msg}</div>}
    </>
  )
}

function FilaSincronizacao({ fila, refrescar }: { fila: FilaItem[]; refrescar: () => void }) {
  const [busy, setBusy] = React.useState(false)
  const sincronizarAgora = async () => {
    setBusy(true)
    try {
      const { sincronizar } = await import('@/lib/client/offline')
      await sincronizar(); refrescar()
    } finally { setBusy(false) }
  }
  const apagarSincronizados = async () => {
    for (const i of fila.filter((f) => f.estadoLocal === 'SINCRONIZADO')) await filaRemover(i.clientUuid)
    refrescar()
  }

  const ESTADO_UI: Record<string, { label: string; cor: string; icon: React.ComponentType<{ className?: string }> }> = {
    GUARDADO: { label: 'Guardado neste telemóvel', cor: 'border-zinc-300 text-zinc-600', icon: Clock },
    A_ENVIAR: { label: 'A sincronizar…', cor: 'border-teal-400 text-teal-700', icon: RefreshCw },
    SINCRONIZADO: { label: 'Sincronizado (confirmado pelo servidor)', cor: 'border-emerald-400 text-emerald-700', icon: CheckCircle2 },
    ERRO: { label: 'Erro que exige acção', cor: 'border-red-400 text-red-700', icon: AlertTriangle },
  }

  return (
    <>
      <Card>
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-sm">Fila de sincronização (OFF-006)</div>
            <Button size="sm" variant="outline" disabled={busy} onClick={sincronizarAgora}><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />Tentar agora</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Registos guardados no armazenamento permanente do telemóvel — sobrevivem a fecho da aplicação ou reinício (AT-010).
            O envio é automático quando a internet regressa; cada registo só é marcado como enviado após confirmação do servidor (OFF-004).
          </p>
        </CardContent>
      </Card>
      {fila.length === 0 && <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground">Fila vazia.</CardContent></Card>}
      <div className="space-y-2">
        {fila.map((item) => {
          const ui = ESTADO_UI[item.estadoLocal]
          const Icon = ui.icon
          return (
            <div key={item.clientUuid} className={`rounded-lg border bg-white p-3 ${ui.cor}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4" />{item.resumo}</div>
                {item.estadoLocal === 'SINCRONIZADO' && (
                  <button className="text-xs text-zinc-400 underline" onClick={apagarSincronizados}>limpar</button>
                )}
              </div>
              <div className="mt-1 text-xs">{ui.label} • hora do dispositivo: {fmtData(item.deviceTime, true)}</div>
              {item.erro && <div className="mt-1 text-xs text-red-700">{item.erro}</div>}
              {item.tentativas > 0 && <div className="text-xs text-zinc-400">tentativas: {item.tentativas}</div>}
              <div className="text-[10px] text-zinc-400 mt-0.5">UUID: {item.clientUuid.slice(0, 18)}…</div>
            </div>
          )
        })}
      </div>
    </>
  )
}
