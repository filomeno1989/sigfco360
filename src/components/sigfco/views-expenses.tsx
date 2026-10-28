// =====================================================================
// SIGFCO — Despesas: fila financeira (FIN-013), aprovação/rejeição com
// motivo obrigatório (FIN-014), duplicados (AT-015), comprovativo
// privado com hash (SEC-007), segregação de funções (§4.1)
// =====================================================================
'use client'

import * as React from 'react'
import { useApp } from './root'
import { api, fmtData, fmtMT } from '@/lib/client/api'
import { Page, Panel, DataTable, StatusBadge, Campo, EntradaTexto, Selecao, TextoLongo, Modal, Button, ErroAlerta, Confirmacao } from './ui-kit'
import { Badge } from '@/components/ui/badge'
import { Check, X, Undo2, Ban, FileSearch, Download } from 'lucide-react'

type Expense = {
  id: string; code: string; category: string; amountMinor: number; currency: string
  convertedMinor?: number | null; rateApplied?: string | null; rateSource?: string | null
  status: string; expenseDate: string; vendor?: string | null; description?: string | null
  rejectReason?: string | null; rejectCategory?: string | null
  duplicateFlag?: string | null; duplicateScore?: number | null; noReceiptReason?: string | null
  lat?: number | null; lng?: number | null; locStatus?: string | null
  trip?: { code: string } | null; driver?: { name: string } | null
  attachments: Array<{ id: string; hash: string; mime: string; size: number }>
  voidReason?: string | null
}

const CAT_LABEL: Record<string, string> = {
  combustivel: 'Combustível', portagens: 'Portagens', per_diem: 'Per diem', alfandega: 'Alfândega',
  estacionamento: 'Estacionamento', manutencao_emergencia: 'Manutenção emerg.', pneus: 'Pneus',
  lavagem: 'Lavagem', comunicacao: 'Comunicação', alojamento: 'Alojamento', alimentacao: 'Alimentação',
  taxas_locais: 'Taxas locais', outros: 'Outros',
}

const REJECT_CATS = [
  { value: 'valor_incorreto', label: 'Valor incorrecto' },
  { value: 'sem_comprovativo', label: 'Sem comprovativo válido' },
  { value: 'categoria_errada', label: 'Categoria errada' },
  { value: 'fora_do_orcamento', label: 'Fora do orçamento/política' },
  { value: 'duplicado', label: 'Duplicado' },
  { value: 'nao_relacionado', label: 'Não relacionado com a viagem' },
  { value: 'outro', label: 'Outro' },
]

export function DespesasView() {
  const { sessao } = useApp()
  const isDriver = sessao.user.role === 'DRIVER'
  const podeAprovar = ['FINANCE', 'COMPANY_ADMIN', 'PLATFORM_ADMIN', 'FLEET_MANAGER'].includes(sessao.user.role)
  const [rows, setRows] = React.useState<Expense[]>([])
  const [erro, setErro] = React.useState<string | null>(null)
  const [filtroEstado, setFiltroEstado] = React.useState(isDriver ? '' : 'SUBMITTED,IN_REVIEW,RETURNED')
  const [sel, setSel] = React.useState<Expense | null>(null)
  const [decisao, setDecisao] = React.useState<{ tipo: 'approve' | 'reject' | 'return' | 'void' } | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const [catMotivo, setCatMotivo] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const carregar = React.useCallback(async () => {
    try {
      const qs = new URLSearchParams()
      if (filtroEstado) qs.set('status', filtroEstado)
      if (isDriver) qs.set('driverId', sessao.user.driverId ?? '')
      setRows((await api<{ expenses: Expense[] }>(`/api/expenses?${qs}`)).expenses)
      setErro(null)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar despesas.') }
  }, [filtroEstado, isDriver, sessao.user.driverId])
  React.useEffect(() => { carregar() }, [carregar])

  const decidir = async () => {
    if (!sel || !decisao) return
    setBusy(true)
    try {
      await api(`/api/expenses/${sel.id}/actions`, {
        method: 'POST',
        body: { action: decisao.tipo, reason: motivo || undefined, rejectCategory: catMotivo || undefined },
      })
      setDecisao(null); setMotivo(''); setCatMotivo(''); setSel(null)
      carregar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha na decisão.') }
    finally { setBusy(false) }
  }

  const limparDuplicado = async (e: Expense) => {
    try { await api(`/api/expenses/${e.id}/actions`, { method: 'POST', body: { action: 'clear-duplicate-flag', reason: 'Revisão humana concluída' } }); carregar() }
    catch (err) { setErro(err instanceof Error ? err.message : 'Falha.') }
  }

  const FILTROS = [
    { k: 'SUBMITTED,IN_REVIEW,RETURNED', l: 'Fila de aprovação' },
    { k: '', l: 'Todas' },
    { k: 'APPROVED,RECONCILED', l: 'Aprovadas' },
    { k: 'REJECTED', l: 'Rejeitadas' },
    { k: 'VOID', l: 'Anuladas' },
  ]

  return (
    <Page title="Despesas" subtitle={isDriver ? 'As suas despesas e estados de sincronização (OFF-006)' : 'Fila financeira com filtros por pendente, duplicado, sem talão, moeda e viagem (FIN-013)'}
      demo={sessao.company?.isDemo}>
      <ErroAlerta erro={erro} />
      {!isDriver && (
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <Button key={f.k} size="sm" variant={filtroEstado === f.k ? 'default' : 'outline'} onClick={() => setFiltroEstado(f.k)}>{f.l}</Button>
          ))}
          {podeAprovar && (
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => window.open('/api/reports/export?type=expenses', '_blank')}>
              <Download className="mr-1.5 h-3.5 w-3.5" />Exportar CSV (auditado)
            </Button>
          )}
        </div>
      )}

      <Panel>
        <DataTable
          rows={rows} filtro={(e, q) => [e.code, e.vendor, e.trip?.code, e.driver?.name, e.category].some((s) => s?.toLowerCase().includes(q))}
          filtroPlaceholder="Código, viagem, motorista…" onRowClick={(e) => setSel(e)}
          columns={[
            { key: 'code', header: 'Código', render: (e) => <span className="font-medium">{e.code}</span> },
            { key: 'date', header: 'Data', render: (e) => fmtData(e.expenseDate, true), hideOnMobile: true },
            { key: 'trip', header: 'Viagem', render: (e) => e.trip?.code ?? '—' },
            { key: 'driver', header: 'Motorista', render: (e) => e.driver?.name ?? '—', hideOnMobile: !isDriver },
            { key: 'cat', header: 'Categoria', render: (e) => CAT_LABEL[e.category] ?? e.category },
            { key: 'valor', header: 'Valor', render: (e) => <div><b>{fmtMT(e.amountMinor, e.currency)}</b>{e.currency !== 'MZN' && e.convertedMinor != null && <div className="text-xs text-muted-foreground">≈ {fmtMT(e.convertedMinor)} (taxa {e.rateApplied} {e.rateSource})</div>}</div> },
            { key: 'talao', header: 'Talão', render: (e) => e.attachments.length > 0 ? <Badge variant="outline" className="border-emerald-400 text-emerald-700">Anexo</Badge> : e.noReceiptReason ? <Badge variant="outline" className="border-amber-400 text-amber-700">Excepção</Badge> : <span className="text-red-600">Falta</span> },
            { key: 'flags', header: 'Sinais', render: (e) => (
              <div className="space-y-0.5">
                {e.duplicateFlag && <Badge variant="outline" className="border-amber-500 text-amber-700">Duplicado {Math.round((e.duplicateScore ?? 0) * 100)}%</Badge>}
                {e.lat != null && <span className="text-[10px] text-muted-foreground block">GPS: {e.lat.toFixed(4)}, {(e.lng ?? 0).toFixed(4)}</span>}
                {e.locStatus === 'UNAVAILABLE' && <Badge variant="outline" className="text-[10px]">GPS indisponível</Badge>}
              </div>
            ), hideOnMobile: true },
            { key: 'status', header: 'Estado', render: (e) => <StatusBadge estado={e.status} mapa={{}} /> },
          ]} />
      </Panel>

      {/* Detalhe */}
      <Modal open={!!sel} onOpenChange={(v) => !v && setSel(null)} title={sel ? `Despesa ${sel.code}` : ''} description={sel ? `${CAT_LABEL[sel.category]} • ${fmtMT(sel.amountMinor, sel.currency)}` : ''}>
        {sel && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Viagem:</span> {sel.trip?.code ?? '—'}</div>
              <div><span className="text-muted-foreground">Motorista:</span> {sel.driver?.name ?? '—'}</div>
              <div><span className="text-muted-foreground">Data/hora:</span> {fmtData(sel.expenseDate, true)}</div>
              <div><span className="text-muted-foreground">Estabelecimento:</span> {sel.vendor ?? '—'}</div>
              {sel.lat != null && <div className="col-span-2"><span className="text-muted-foreground">GPS:</span> {sel.lat.toFixed(5)}, {(sel.lng ?? 0).toFixed(5)} <a className="text-teal-700 underline ml-1" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${sel.lat}&mlon=${sel.lng}#map=16/${sel.lat}/${sel.lng}`}><FileSearch className="inline h-3 w-3" /> ver no mapa</a></div>}
              {sel.noReceiptReason && <div className="col-span-2 rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">Excepção sem comprovativo: {sel.noReceiptReason}</div>}
              {sel.rejectReason && <div className="col-span-2 rounded border border-red-300 bg-red-50 p-2 text-red-900">Rejeição ({sel.rejectCategory}): {sel.rejectReason}</div>}
              {sel.duplicateFlag && <div className="col-span-2 rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">Possível duplicado ({Math.round((sel.duplicateScore ?? 0) * 100)}%) — decisão final cabe ao aprovador (AT-015).</div>}
            </div>
            {sel.attachments.length > 0 ? (
              <div>
                <b className="block mb-1.5">Comprovativo (acesso privado e auditado):</b>
                <a href={`/api/files/${sel.attachments[0].id}`} target="_blank" rel="noreferrer">
                  { }
                  <img src={`/api/files/${sel.attachments[0].id}`} alt="Comprovativo da despesa" className="max-h-64 rounded border" />
                </a>
                <p className="mt-1 text-xs text-muted-foreground">SHA-256: {sel.attachments[0].hash.slice(0, 24)}…</p>
              </div>
            ) : !sel.noReceiptReason && <p className="text-muted-foreground">Sem comprovativo anexado.</p>}

            {podeAprovar && ['SUBMITTED', 'IN_REVIEW', 'RETURNED'].includes(sel.status) && (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button size="sm" className="bg-emerald-700 hover:bg-emerald-600" onClick={() => setDecisao({ tipo: 'approve' })}><Check className="mr-1 h-4 w-4" />Aprovar</Button>
                <Button size="sm" variant="outline" className="text-red-700" onClick={() => setDecisao({ tipo: 'reject' })}><X className="mr-1 h-4 w-4" />Rejeitar</Button>
                <Button size="sm" variant="outline" onClick={() => setDecisao({ tipo: 'return' })}><Undo2 className="mr-1 h-4 w-4" />Devolver p/ correcção</Button>
              </div>
            )}
            {podeAprovar && ['APPROVED'].includes(sel.status) && (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button size="sm" variant="outline" className="text-red-700" onClick={() => setDecisao({ tipo: 'void' })}><Ban className="mr-1 h-4 w-4" />Anular (fluxo controlado)</Button>
              </div>
            )}
            {sel.duplicateFlag && podeAprovar && (
              <Button size="sm" variant="ghost" onClick={() => limparDuplicado(sel)}>Revisão concluída — limpar sinal de duplicado</Button>
            )}
          </div>
        )}
      </Modal>

      {/* Decisão com motivo obrigatório (FIN-014) */}
      <Modal open={!!decisao} onOpenChange={(v) => !v && setDecisao(null)}
        title={decisao?.tipo === 'approve' ? 'Aprovar despesa' : decisao?.tipo === 'void' ? 'Anular despesa (fluxo controlado)' : 'Rejeitar/devolver despesa'}
        description={decisao?.tipo === 'approve'
          ? 'Confirme imagem, valor, moeda, geolocalização, orçamento e possíveis duplicados (FR-056).'
          : 'A rejeição/devolução exige categoria de motivo e nota; o motorista é notificado (FIN-014).'}
        footer={
          <>
            <Button variant="outline" onClick={() => setDecisao(null)}>Cancelar</Button>
            <Button disabled={busy || (decisao?.tipo !== 'approve' && (motivo.length < 8 || !catMotivo))} onClick={decidir}>
              {busy ? 'A processar…' : decisao?.tipo === 'approve' ? 'Confirmar aprovação' : 'Confirmar decisão'}
            </Button>
          </>
        }>
        {decisao && decisao.tipo !== 'approve' && (
          <div className="space-y-3">
            <Campo label="Categoria do motivo" required><Selecao value={catMotivo} onChange={setCatMotivo} opcoes={[{ value: '', label: 'Seleccionar…' }, ...REJECT_CATS]} /></Campo>
            <Campo label="Motivo explicativo" required hint="Mínimo 8 caracteres; fica no histórico para auditoria"><TextoLongo value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} /></Campo>
          </div>
        )}
        {decisao?.tipo === 'approve' && sel && (
          <div className="space-y-2 text-sm">
            <p>Aprovar <b>{fmtMT(sel.amountMinor, sel.currency)}</b> da viagem <b>{sel.trip?.code}</b> ({CAT_LABEL[sel.category]}).</p>
            <p className="text-xs text-muted-foreground">Operação financeira — resumo do impacto registado em auditoria (UX-004, §4.1).</p>
          </div>
        )}
      </Modal>
    </Page>
  )
}
