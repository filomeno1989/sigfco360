// =====================================================================
// SIGFCO — Mapa operacional (§7.3, GPS-012/020/021/022, AT-006, AT-021)
// Regras visíveis: frescura inequívoca do último ponto; linha entre
// pontos é apenas representação visual, claramente distinta de telemetria
// observada (§7.4); telemetria antiga NUNCA apresentada como tempo real.
// Tiles: OpenStreetMap (ARC-004 — sem download em massa; mapa offline
// dependerá de fornecedor licenciado, ver DECISOES_TECNICAS.md).
// =====================================================================
'use client'

import * as React from 'react'
import dynamicImport from 'next/dynamic'
import { useApp } from './root'
import { api, fmtData, idadeMin } from '@/lib/client/api'
import { Page, Panel, StatusBadge, Button, Carregando, ErroAlerta, Modal, Campo, EntradaTexto, Selecao } from './ui-kit'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, PlayCircle, Layers, Bot, CircleDot } from 'lucide-react'
import type * as LeafletNS from 'leaflet'
import type { DivIcon } from 'leaflet'

const MapContainer = dynamicImport(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false })
const TileLayer = dynamicImport(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false })
const Marker = dynamicImport(() => import('react-leaflet').then((m) => m.Marker), { ssr: false })
const Popup = dynamicImport(() => import('react-leaflet').then((m) => m.Popup), { ssr: false })
const Polyline = dynamicImport(() => import('react-leaflet').then((m) => m.Polyline), { ssr: false })
const Circle = dynamicImport(() => import('react-leaflet').then((m) => m.Circle), { ssr: false })
const LayersControl = dynamicImport(() => import('react-leaflet').then((m) => m.LayersControl), { ssr: false })
const LayersControlBase = dynamicImport(() => import('react-leaflet').then((m) => m.LayersControl.Base), { ssr: false })

type FleetItem = {
  deviceId: string; serial: string; deviceStatus: string; freshness: string
  vehicle: { id: string; plate: string; status: string } | null
  driver: { name: string } | null
  trip: { code: string; status: string } | null
  lastPoint: { lat: number; lng: number; speedKmh: number | null; gnssTime: string; source: string; ageMinutes: number } | null
}

type Geofence = { id: string; name: string; type: string; lat: number; lng: number; radiusM: number; active: boolean }

const CORES_FRESH: Record<string, string> = {
  LIVE: '#059669', DELAYED: '#d97706', NO_COMMUNICATION: '#dc2626', HISTORIC: '#71717a',
}

function makeIcon(cor: string, fonte: string, L: typeof LeafletNS | null): DivIcon | undefined {
  if (!L) return undefined
  const icone = fonte === 'SIMULATOR' ? '■' : '▲'
  return L.divIcon({
    className: '',
    html: `<div style="background:${cor};width:26px;height:26px;border-radius:50%;border:3px solid white;box-shadow:0 1px 6px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold">${icone}</div>`,
    iconSize: [26, 26], iconAnchor: [13, 13],
  })
}

export function MapaView() {
  const { sessao } = useApp()
  const [L, setL] = React.useState<typeof LeafletNS | null>(null)
  const [fleet, setFleet] = React.useState<FleetItem[]>([])
  const [fences, setFences] = React.useState<Geofence[]>([])
  const [erro, setErro] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [sel, setSel] = React.useState<FleetItem | null>(null)
  const [historico, setHistorico] = React.useState<Array<{ lat: number; lng: number; gnssTime: string; isHistoric: boolean; source: string; speedKmh: number | null }>>([])
  const [simMsg, setSimMsg] = React.useState<string | null>(null)
  const isDemo = sessao.company?.isDemo

  const carregar = React.useCallback(async () => {
    setBusy(true)
    try {
      const [f, g] = await Promise.all([
        api<{ fleet: FleetItem[] }>('/api/gps/fleet'),
        api<{ geofences: Geofence[] }>('/api/gps/geofences'),
      ])
      setFleet(f.fleet); setFences(g.geofences); setErro(null)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar frota.') }
    finally { setBusy(false) }
  }, [])

  React.useEffect(() => { carregar(); const t = setInterval(carregar, 30_000); return () => clearInterval(t) }, [carregar])
  React.useEffect(() => { import('leaflet').then((m) => setL(m.default ?? (m as unknown as typeof LeafletNS))) }, [])

  const abrirHistorico = async (item: FleetItem) => {
    setSel(item)
    setHistorico([])
    try {
      const res = await api<{ points: typeof historico }>(`/api/gps/points?deviceId=${item.deviceId}&pageSize=800&from=${encodeURIComponent(new Date(Date.now() - 24 * 3600_000).toISOString())}`)
      setHistorico(res.points)
    } catch { /* histórico indisponível */ }
  }

  const tickSimulador = async () => {
    try {
      const r = await api<{ point: { local: string; isHistoric: boolean } }>('/api/demo', { method: 'POST', body: { action: 'simulator-tick' } })
      setSimMsg(`Ponto DEMO gerado em ${r.point.local}${r.point.isHistoric ? ' (com atraso — sem rede simulada)' : ''}. Fonte: SIMULATOR.`)
      carregar()
    } catch (e) { setSimMsg(e instanceof Error ? e.message : 'Falha no simulador.') }
  }

  const comPosicao = fleet.filter((f) => f.lastPoint)
  const centro: [number, number] = comPosicao.length
    ? [comPosicao[0].lastPoint!.lat, comPosicao[0].lastPoint!.lng]
    : [-19.2, 33.6]

  return (
    <Page title="Mapa da frota" subtitle="Último ponto conhecido com frescura inequívoca — telemetria antiga nunca é apresentada como tempo real (GPS-012)"
      actions={
        <>
          {isDemo && (
            <Button variant="outline" size="sm" onClick={tickSimulador} className="border-amber-500/60 text-amber-600 hover:bg-amber-50">
              <Bot className="mr-1.5 h-4 w-4" /> Gerar ponto DEMO
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={carregar} disabled={busy}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Actualizar</Button>
        </>
      }
      demo={isDemo}>
      <ErroAlerta erro={erro} />
      {simMsg && <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">⚠ {simMsg}</div>}

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Panel className="overflow-hidden p-0">
          <div className="h-[480px] w-full" style={{ zIndex: 0 }}>
            <MapContainer center={centro} zoom={7} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {fences.filter((f) => f.active).map((f) => (
                <Circle key={f.id} center={[f.lat, f.lng]} radius={f.radiusM}
                  pathOptions={{ color: f.type === 'RESTRICTED' ? '#dc2626' : '#0f766e', fillColor: f.type === 'RESTRICTED' ? '#dc2626' : '#0f766e', fillOpacity: 0.06, weight: 1.5 }}>
                  <Popup>{f.name} ({f.type}) — cerca geográfica</Popup>
                </Circle>
              ))}
              {historico.length > 1 && (
                <Polyline positions={historico.map((h) => [h.lat, h.lng])}
                  pathOptions={{ color: '#0f766e', weight: 2, dashArray: '6 6', opacity: 0.6 }} />
              )}
              {comPosicao.map((f) => (
                <Marker key={f.deviceId} position={[f.lastPoint!.lat, f.lastPoint!.lng]}
                  icon={makeIcon(CORES_FRESH[f.freshness] ?? '#71717a', f.lastPoint!.source, L)}
                  eventHandlers={{ click: () => abrirHistorico(f) }}>
                  <Popup>
                    <div className="text-xs space-y-1">
                      <b>{f.vehicle?.plate ?? f.serial}</b>
                      <div>Frescura: <b>{f.freshness === 'LIVE' ? 'Actualizado' : f.freshness === 'DELAYED' ? 'Atrasado' : f.freshness === 'NO_COMMUNICATION' ? 'Sem comunicação' : 'Histórico'}</b></div>
                      <div>Último ponto: {fmtData(f.lastPoint!.gnssTime, true)} ({f.lastPoint!.ageMinutes} min atrás)</div>
                      <div>Fonte: {f.lastPoint!.source === 'SIMULATOR' ? 'Simulador — DEMO' : f.lastPoint!.source === 'TRACKER' ? 'Rastreador dedicado' : 'Telemóvel'}</div>
                      {f.trip && <div>Viagem: {f.trip.code}</div>}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t px-4 py-2.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" /> Actualizado</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-600" /> Atrasado</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" /> Sem comunicação</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-zinc-400" /> Histórico</span>
            <span className="flex items-center gap-1.5"><CircleDot className="h-3 w-3" /> ▲ rastreador • ■ simulador DEMO</span>
            <span className="ml-auto">Linhas tracejadas = ligação visual entre pontos, não telemetria observada (§7.4)</span>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Frota rastreada" description={`${comPosicao.length} dispositivos com veículo associado`}>
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {fleet.length === 0 && <p className="text-sm text-muted-foreground">Sem dispositivos GPS associados a veículos.</p>}
              {fleet.map((f) => (
                <button key={f.deviceId} onClick={() => abrirHistorico(f)} className="w-full rounded-lg border p-2.5 text-left hover:bg-muted/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{f.vehicle?.plate ?? f.serial}</span>
                    <StatusBadge estado={f.freshness} mapa={{}} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {f.trip ? `Viagem ${f.trip.code} • ${f.driver?.name ?? ''}` : 'Sem viagem activa'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {f.lastPoint ? `${fmtData(f.lastPoint.gnssTime, true)} • ${f.lastPoint.ageMinutes} min • fonte: ${f.lastPoint.source === 'SIMULATOR' ? 'DEMO' : f.lastPoint.source === 'TRACKER' ? 'rastreador' : 'telemóvel'}` : 'Nunca comunicou'}
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Regras do mapa" description="Transparência (§15.3)">
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li>• Sem dados recentes <b>não significa</b> veículo parado, desligado ou avariado (GPS-027).</li>
              <li>• &quot;Sem comunicação&quot; é distinto de &quot;sem alimentação&quot; — ver estado do dispositivo na ficha.</li>
              <li>• ETA apenas aproximada; sem fonte de tráfego fiável (GPS-024).</li>
            </ul>
          </Panel>
        </div>
      </div>

      <Modal open={!!sel} onOpenChange={(v) => !v && setSel(null)} title={`Trajecto — ${sel?.vehicle?.plate ?? sel?.serial ?? ''}`}
        description="Últimas 24 h. Pontos recebidos em atraso mantêm a hora original do dispositivo (NFR-012)." wide>
        <div className="space-y-3">
          {sel && <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Dispositivo: {sel.serial}</Badge>
            <StatusBadge estado={sel.deviceStatus} mapa={{}} />
            <StatusBadge estado={sel.freshness} mapa={{}} />
            {sel.trip && <Badge variant="outline">Viagem {sel.trip.code}</Badge>}
          </div>}
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem pontos nas últimas 24 h.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded border">
              <table className="w-full text-xs">
                <thead><tr className="border-b bg-muted/50 text-left"><th className="p-2">Hora GNSS</th><th className="p-2">Recepção</th><th className="p-2">Vel.</th><th className="p-2">Fonte</th><th className="p-2">Estado</th></tr></thead>
                <tbody>
                  {[...historico].reverse().slice(0, 120).map((h, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="p-2">{fmtData(h.gnssTime, true)}</td>
                      <td className="p-2 text-muted-foreground">—</td>
                      <td className="p-2">{h.speedKmh != null ? `${Math.round(h.speedKmh)} km/h` : '—'}</td>
                      <td className="p-2">{h.source === 'SIMULATOR' ? 'DEMO' : h.source === 'TRACKER' ? 'rastreador' : 'telemóvel'}</td>
                      <td className="p-2">{h.isHistoric ? <span className="text-amber-600">histórico/atrasado</span> : <span className="text-emerald-700">em curso</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </Page>
  )
}
