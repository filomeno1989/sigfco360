// SIGFCO - Relatórios, alertas, auditoria e configuração
'use client'

import * as React from 'react'
import { useApp } from './root'
import { api, fmtData } from '@/lib/client/api'
import { Page, Panel, DataTable, StatusBadge, Campo, EntradaTexto, Selecao, TextoLongo, Modal, Button, ErroAlerta, Confirmacao } from './ui-kit'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Download, Check, X } from 'lucide-react'

export function RelatoriosView() {
  const { sessao } = useApp()
  const podeExportar = ['FINANCE', 'COMPANY_ADMIN', 'PLATFORM_ADMIN', 'AUDITOR', 'FLEET_MANAGER', 'DISPATCHER', 'BRANCH_MANAGER'].includes(sessao.user.role)
  const EXPS = [
    { type: 'expenses', label: 'Despesas (com moedas e taxas)', nota: 'Permissão financeira exigida; exportação auditada.' },
    { type: 'fuel', label: 'Abastecimentos', nota: 'Litros, custos, odómetro e anomalias.' },
    { type: 'trips', label: 'Viagens', nota: 'Ciclo de vida, quilometragens e orçamento.' },
    { type: 'documents', label: 'Documentos', nota: 'Vencimentos, bloqueantes e estados.' },
  ]
  return (
    <Page title="Relatórios e exportações" subtitle="Formato CSV; toda a exportação sensível é registada na auditoria" demo={sessao.company?.isDemo}>
      <div className="grid gap-3 sm:grid-cols-2">
        {EXPS.map((e) => (
          <Panel key={e.type} title={e.label} description={e.nota}
            actions={podeExportar && <Button size="sm" variant="outline" onClick={() => window.open(`/api/reports/export?type=${e.type}`, '_blank')}><Download className="mr-1.5 h-3.5 w-3.5" />CSV</Button>}>
            <p className="text-xs text-muted-foreground">Filtros de período podem ser adicionados ao link de exportação (from/to). O ficheiro não é público - acesso exige sessão com permissão.</p>
          </Panel>
        ))}
      </div>
      <Panel title="Fiabilidade dos indicadores">
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Cada indicador declara período, unidade, moeda, filtros e fontes.</li>
          <li>Custo por quilómetro não é calculado quando faltam despesas ou quilometragem.</li>
          <li>Despesas pendentes não são somadas como aprovadas - relatórios distinguem estados.</li>
          <li>Tempo sem GPS não é contado como tempo parado.</li>
        </ul>
      </Panel>
    </Page>
  )
}

export function AlertasView() {
  const { sessao } = useApp()
  const [rows, setRows] = React.useState<Array<{ id: string; severity: string; type: string; title: string; message: string; status: string; createdAt: string; closeReason?: string | null }>>([])
  const [erro, setErro] = React.useState<string | null>(null)
  const [filtro, setFiltro] = React.useState('OPEN')
  const [fechar, setFechar] = React.useState<{ id: string; title: string; severity: string } | null>(null)
  const [motivo, setMotivo] = React.useState('')

  const carregar = React.useCallback(async () => {
    try { setRows((await api<{ alerts: typeof rows }>(`/api/alerts${filtro ? `?status=${filtro}` : ''}`)).alerts); setErro(null) }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar alertas.') }
  }, [filtro])
  React.useEffect(() => { carregar(); const t = setInterval(carregar, 30_000); return () => clearInterval(t) }, [carregar])

  const ack = async (id: string) => { try { await api('/api/alerts', { method: 'PATCH', body: { id, action: 'ack' } }); carregar() } catch (e) { setErro(e instanceof Error ? e.message : 'Falha.') } }
  const encerrar = async () => {
    if (!fechar) return
    try { await api('/api/alerts', { method: 'PATCH', body: { id: fechar.id, action: 'close', reason: motivo } }); setFechar(null); setMotivo(''); carregar() }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao encerrar.') }
  }

  const FILTROS = [{ k: 'OPEN', l: 'Abertos' }, { k: 'ACK', l: 'Reconhecidos' }, { k: 'CLOSED', l: 'Encerrados' }, { k: '', l: 'Todos' }]

  return (
    <Page title="Alertas" subtitle="Gravidades: crítico (impede acção), alto (notifica), médio (fila de trabalho), informativo (histórico) -" demo={sessao.company?.isDemo}>
      <ErroAlerta erro={erro} />
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => <Button key={f.k} size="sm" variant={filtro === f.k ? 'default' : 'outline'} onClick={() => setFiltro(f.k)}>{f.l}</Button>)}
      </div>
      <Panel>
        <DataTable rows={rows} columns={[
          { key: 'sev', header: 'Gravidade', render: (a) => <StatusBadge estado={a.severity} mapa={{}} /> },
          { key: 'title', header: 'Alerta', render: (a) => <div><b>{a.title}</b><div className="text-xs text-muted-foreground">{a.message}</div></div> },
          { key: 'when', header: 'Quando', render: (a) => fmtData(a.createdAt, true), hideOnMobile: true },
          { key: 'status', header: 'Estado', render: (a) => <StatusBadge estado={a.status} mapa={{ OPEN: 'Aberto', ACK: 'Reconhecido', CLOSED: 'Encerrado' }} /> },
          { key: 'actions', header: '', render: (a) => a.status === 'OPEN' && (
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => ack(a.id)}><Check className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="outline" className="text-red-700" onClick={() => setFechar({ id: a.id, title: a.title, severity: a.severity })}><X className="h-3.5 w-3.5" /></Button>
            </div>
          ) },
        ]} />
      </Panel>
      <Modal open={!!fechar} onOpenChange={(v) => !v && setFechar(null)} title="Encerrar alerta"
        description={fechar?.severity === 'CRITICAL' || fechar?.severity === 'HIGH' ? 'Gravidade alta/crítica exige motivo registado.' : 'Motivo opcional.'}
        footer={
          <>
            <Button variant="outline" onClick={() => setFechar(null)}>Cancelar</Button>
            <Button disabled={(fechar?.severity === 'CRITICAL' || fechar?.severity === 'HIGH') && motivo.length < 5} onClick={encerrar}>Encerrar</Button>
          </>
        }>
        <Campo label="Motivo do encerramento" required={fechar?.severity === 'CRITICAL' || fechar?.severity === 'HIGH'}><TextoLongo rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
      </Modal>
    </Page>
  )
}

export function AuditoriaView() {
  const [rows, setRows] = React.useState<Array<{ id: string; userName?: string | null; action: string; entity: string; entityId?: string | null; reason?: string | null; ip?: string | null; createdAt: string; afterJson?: string | null }>>([])
  const [erro, setErro] = React.useState<string | null>(null)
  const [filtro, setFiltro] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)

  const carregar = React.useCallback(async () => {
    try {
      const r = await api<{ logs: typeof rows; total: number }>(`/api/audit?page=${page}${filtro ? `&entity=${encodeURIComponent(filtro)}` : ''}`)
      setRows(r.logs); setTotal(r.total); setErro(null)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar auditoria.') }
  }, [page, filtro])
  React.useEffect(() => { carregar() }, [carregar])

  return (
    <Page title="Trilha de auditoria" subtitle="Quem fez o quê, quando, sobre que registo - com valores antes/depois quando relevante">
      <ErroAlerta erro={erro} />
      <div className="flex flex-wrap gap-2">
        {[{ k: '', l: 'Tudo' }, { k: 'Trip', l: 'Viagens' }, { k: 'Expense', l: 'Despesas' }, { k: 'ExchangeRate', l: 'Câmbio' }, { k: 'User', l: 'Utilizadores' }, { k: 'GpsDevice', l: 'GPS' }, { k: 'Alert', l: 'Alertas' }].map((f) => (
          <Button key={f.k} size="sm" variant={filtro === f.k ? 'default' : 'outline'} onClick={() => { setFiltro(f.k); setPage(1) }}>{f.l}</Button>
        ))}
      </div>
      <Panel description={`${total} eventos`}>
        <DataTable rows={rows} columns={[
          { key: 'when', header: 'Quando', render: (a) => fmtData(a.createdAt, true) },
          { key: 'user', header: 'Utilizador', render: (a) => a.userName ?? 'sistema' },
          { key: 'action', header: 'Acção', render: (a) => <Badge variant="outline">{a.action}</Badge> },
          { key: 'entity', header: 'Entidade', render: (a) => `${a.entity}${a.entityId ? ` · ${a.entityId.slice(0, 10)}…` : ''}` },
          { key: 'reason', header: 'Motivo', render: (a) => a.reason ?? '-', hideOnMobile: true },
          { key: 'after', header: 'Detalhe', render: (a) => a.afterJson ? <code className="text-[10px] break-all">{a.afterJson.slice(0, 90)}</code> : '-', hideOnMobile: true },
          { key: 'ip', header: 'IP', render: (a) => a.ip ?? '-', hideOnMobile: true },
        ]} />
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span className="text-sm text-muted-foreground">Página {page} de {Math.max(1, Math.ceil(total / 50))}</span>
          <Button size="sm" variant="outline" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(page + 1)}>Seguinte</Button>
        </div>
      </Panel>
    </Page>
  )
}

export function ConfiguracaoView() {
  const { sessao, recarregar } = useApp()
  const [company, setCompany] = React.useState<Record<string, unknown>>({})
  const [settings, setSettings] = React.useState<Record<string, unknown>>({})
  const [users, setUsers] = React.useState<Array<{ id: string; name: string; email: string; role: string; active: boolean; isDemo?: boolean; lastLoginAt?: string | null }>>([])
  const [sessions, setSessions] = React.useState<Array<{ id: string; device?: string | null; ip?: string | null; lastSeenAt: string }>>([])
  const [fences, setFences] = React.useState<Array<{ id: string; name: string; type: string; lat: number; lng: number; radiusM: number; active: boolean }>>([])
  const [erro, setErro] = React.useState<string | null>(null)
  const [msg, setMsg] = React.useState<string | null>(null)
  const [novoUser, setNovoUser] = React.useState(false)
  const [formU, setFormU] = React.useState<Record<string, string>>({})
  const [novaFence, setNovaFence] = React.useState(false)
  const [formF, setFormF] = React.useState<Record<string, string>>({})
  const [revogarTodos, setRevogarTodos] = React.useState(false)

  const carregar = React.useCallback(async () => {
    try {
      const [c, u, s, g] = await Promise.all([
        api<{ company: Record<string, unknown>; settings: Record<string, unknown> }>('/api/company'),
        api<{ users: typeof users }>('/api/users'),
        api<{ sessions: typeof sessions }>('/api/auth/sessions'),
        api<{ geofences: typeof fences }>('/api/gps/geofences'),
      ])
      setCompany(c.company); setSettings(c.settings); setUsers(u.users); setSessions(s.sessions); setFences(g.geofences); setErro(null)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar configuração.') }
  }, [])
  React.useEffect(() => { carregar() }, [carregar])

  const guardarEmpresa = async () => {
    try { await api('/api/company', { method: 'PATCH', body: { company: { name: company.name, legalName: company.legalName, nuit: company.nuit, address: company.address, phone: company.phone, email: company.email, currencyBase: company.currencyBase, timezone: company.timezone } } }); setMsg('Empresa actualizada.'); recarregar() }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao guardar.') }
  }
  const guardarParam = async (key: string, value: unknown) => {
    try { await api('/api/company', { method: 'PATCH', body: { settings: { [key]: value } } }); setMsg(`Parâmetro ${key} actualizado.`) }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao guardar parâmetro.') }
  }
  const criarUser = async () => {
    try { await api('/api/users', { method: 'POST', body: formU }); setNovoUser(false); setFormU({}); carregar() }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao criar utilizador.') }
  }
  const alterarUser = async (id: string, patch: Record<string, unknown>) => {
    try { await api('/api/users', { method: 'PATCH', body: { id, ...patch } }); carregar() }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao alterar utilizador.') }
  }
  const revogar = async () => {
    try { const r = await api<{ revoked: number }>('/api/auth/sessions', { method: 'POST', body: { all: true } }); setMsg(`${r.revoked} sessões revogadas (excepto a actual).`); setRevogarTodos(false); carregar() }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao revogar.') }
  }
  const criarFence = async () => {
    try { await api('/api/gps/geofences', { method: 'POST', body: { name: formF.name, type: formF.type ?? 'BASE', lat: Number(formF.lat), lng: Number(formF.lng), radiusM: Number(formF.radiusM ?? 300) } }); setNovaFence(false); setFormF({}); carregar() }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao criar cerca.') }
  }

  const ROLES = [
    { value: 'COMPANY_ADMIN', label: 'Administrador da empresa' }, { value: 'FLEET_MANAGER', label: 'Gestor de frota' },
    { value: 'DISPATCHER', label: 'Despachante' }, { value: 'FINANCE', label: 'Financeiro' },
    { value: 'MECHANIC', label: 'Mecânico' }, { value: 'AUDITOR', label: 'Auditor' }, { value: 'BRANCH_MANAGER', label: 'Gestor de filial' }, { value: 'DRIVER', label: 'Motorista' },
  ]

  return (
    <Page title="Configuração" subtitle="Empresa, parâmetros operacionais, utilizadores e permissões, sessões e cercas geográficas" demo={sessao.company?.isDemo}>
      <ErroAlerta erro={erro} />
      {msg && <div className="rounded-md border border-teal-300 bg-teal-50 px-3 py-2 text-sm text-teal-900">{msg}</div>}
      <Tabs defaultValue="empresa">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="parametros">Parâmetros</TabsTrigger>
          <TabsTrigger value="utilizadores">Utilizadores</TabsTrigger>
          <TabsTrigger value="sessoes">Sessões & dispositivos</TabsTrigger>
          <TabsTrigger value="cercas">Cercas geográficas</TabsTrigger>
        </TabsList>
        <TabsContent value="empresa">
          <Panel title="Dados da empresa">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Nome"><EntradaTexto value={String(company.name ?? '')} onChange={(e) => setCompany({ ...company, name: e.target.value })} /></Campo>
              <Campo label="Nome legal"><EntradaTexto value={String(company.legalName ?? '')} onChange={(e) => setCompany({ ...company, legalName: e.target.value })} /></Campo>
              <Campo label="NUIT"><EntradaTexto value={String(company.nuit ?? '')} onChange={(e) => setCompany({ ...company, nuit: e.target.value })} /></Campo>
              <Campo label="Telefone"><EntradaTexto value={String(company.phone ?? '')} onChange={(e) => setCompany({ ...company, phone: e.target.value })} /></Campo>
              <Campo label="Morada"><EntradaTexto value={String(company.address ?? '')} onChange={(e) => setCompany({ ...company, address: e.target.value })} /></Campo>
              <Campo label="Moeda-base" hint="MZN por defeito"><Selecao value={String(company.currencyBase ?? 'MZN')} onChange={(v) => setCompany({ ...company, currencyBase: v })} opcoes={[{ value: 'MZN', label: 'MZN' }]} /></Campo>
              <Campo label="Fuso horário" hint="Hora de Moçambique (CAT, UTC+2) por defeito"><Selecao value={String(company.timezone ?? 'Africa/Maputo')} onChange={(v) => setCompany({ ...company, timezone: v })} opcoes={[{ value: 'Africa/Maputo', label: 'Hora de Moçambique (CAT)' }]} /></Campo>
            </div>
            <Button className="mt-3" onClick={guardarEmpresa}>Guardar</Button>
          </Panel>
        </TabsContent>
        <TabsContent value="parametros">
          <Panel title="Parâmetros operacionais" description="Alteráveis por empresa sem alteração de código">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { k: 'gps_stale_minutes', l: 'GPS "sem comunicação" após (min)' },
                { k: 'gps_delayed_minutes', l: 'GPS "atrasado" após (min)' },
                { k: 'long_stop_minutes', l: 'Paragem prolongada após (min)' },
                { k: 'route_deviation_km', l: 'Tolerância de desvio de rota (km)' },
                { k: 'budget_alert_pct', l: 'Alerta de orçamento (%)' },
                { k: 'duplicate_window_minutes', l: 'Janela de duplicados (min)' },
              ].map((p) => (
                <Campo key={p.k} label={p.l}>
                  <div className="flex gap-2">
                    <EntradaTexto type="number" value={String(settings[p.k] ?? '')} onChange={(e) => setSettings({ ...settings, [p.k]: Number(e.target.value) })} />
                    <Button variant="outline" onClick={() => guardarParam(p.k, settings[p.k])}>OK</Button>
                  </div>
                </Campo>
              ))}
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="utilizadores">
          <Panel title={`Utilizadores (${users.length})`} description="Permissões verificadas em cada chamada ao servidor - esconder botões não é segurança"
            actions={<Button size="sm" onClick={() => setNovoUser(true)}>Novo utilizador</Button>}>
            <DataTable rows={users} columns={[
              { key: 'name', header: 'Nome', render: (u) => <span className="font-medium">{u.name}{u.isDemo && <Badge variant="outline" className="ml-1.5 border-amber-500 text-amber-600">DEMO</Badge>}</span> },
              { key: 'email', header: 'Email' },
              { key: 'role', header: 'Perfil', render: (u) => (
                <Selecao value={u.role} onChange={(v) => alterarUser(u.id, { role: v })} opcoes={ROLES} />
              ) },
              { key: 'active', header: 'Activo', render: (u) => (
                <Switch checked={u.active} onCheckedChange={(v) => alterarUser(u.id, { active: v })} />
              ) },
              { key: 'last', header: 'Último acesso', render: (u) => fmtData(u.lastLoginAt, true), hideOnMobile: true },
            ]} />
          </Panel>
          <Modal open={novoUser} onOpenChange={setNovoUser} title="Novo utilizador"
            description="Palavra-passe: mínimo 8 caracteres com letras e números."
            footer={<><Button variant="outline" onClick={() => setNovoUser(false)}>Cancelar</Button><Button onClick={criarUser}>Criar</Button></>}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Nome" required><EntradaTexto value={formU.name ?? ''} onChange={(e) => setFormU({ ...formU, name: e.target.value })} /></Campo>
              <Campo label="Email" required><EntradaTexto type="email" value={formU.email ?? ''} onChange={(e) => setFormU({ ...formU, email: e.target.value })} /></Campo>
              <Campo label="Perfil" required><Selecao value={formU.role ?? 'DISPATCHER'} onChange={(v) => setFormU({ ...formU, role: v })} opcoes={ROLES} /></Campo>
              <Campo label="Palavra-passe" required><EntradaTexto type="password" value={formU.password ?? ''} onChange={(e) => setFormU({ ...formU, password: e.target.value })} /></Campo>
            </div>
          </Modal>
        </TabsContent>
        <TabsContent value="sessoes">
          <Panel title="Sessões activas" description="Revogação imediata em caso de perda de telemóvel ou saída de trabalhador"
            actions={<Button size="sm" variant="outline" className="text-red-700" onClick={() => setRevogarTodos(true)}>Revogar outras sessões</Button>}>
            <DataTable rows={sessions} columns={[
              { key: 'device', header: 'Dispositivo', render: (s) => <span className="text-xs">{(s.device ?? '-').slice(0, 70)}</span> },
              { key: 'ip', header: 'IP', render: (s) => s.ip ?? '-' },
              { key: 'last', header: 'Visto', render: (s) => fmtData(s.lastSeenAt, true) },
            ]} />
          </Panel>
          <Confirmacao open={revogarTodos} onOpenChange={setRevogarTodos} perigo exigirTexto="REVOGAR"
            titulo="Revogar sessões" mensagem="Todas as sessões (excepto a actual) serão terminadas imediatamente. Operação auditada."
            onConfirm={revogar} />
        </TabsContent>
        <TabsContent value="cercas">
          <Panel title={`Cercas geográficas (${fences.length})`} description="Entradas/saídas geram eventos no mapa e alertas informativos"
            actions={<Button size="sm" onClick={() => setNovaFence(true)}>Nova cerca</Button>}>
            <DataTable rows={fences} columns={[
              { key: 'name', header: 'Nome', render: (f) => <span className="font-medium">{f.name}</span> },
              { key: 'type', header: 'Tipo', render: (f) => ({ BASE: 'Base', PORT: 'Porto', CUSTOMER: 'Cliente', FUEL: 'Posto', TOLL: 'Portagem', BORDER: 'Fronteira', RESTRICTED: 'Restrita', REST: 'Descanso' }[f.type] ?? f.type) },
              { key: 'coords', header: 'Coordenadas', render: (f) => `${f.lat.toFixed(4)}, ${f.lng.toFixed(4)} (±${f.radiusM} m)` },
              { key: 'active', header: 'Activa', render: (f) => f.active ? 'Sim' : 'Não' },
            ]} />
          </Panel>
          <Modal open={novaFence} onOpenChange={setNovaFence} title="Nova cerca geográfica"
            footer={<><Button variant="outline" onClick={() => setNovaFence(false)}>Cancelar</Button><Button onClick={criarFence}>Criar</Button></>}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Nome" required><EntradaTexto value={formF.name ?? ''} onChange={(e) => setFormF({ ...formF, name: e.target.value })} /></Campo>
              <Campo label="Tipo"><Selecao value={formF.type ?? 'BASE'} onChange={(v) => setFormF({ ...formF, type: v })} opcoes={[{ value: 'BASE', label: 'Base' }, { value: 'PORT', label: 'Porto' }, { value: 'CUSTOMER', label: 'Cliente' }, { value: 'FUEL', label: 'Posto de combustível' }, { value: 'BORDER', label: 'Fronteira' }, { value: 'RESTRICTED', label: 'Zona restrita' }, { value: 'REST', label: 'Descanso' }]} /></Campo>
              <Campo label="Latitude" required><EntradaTexto value={formF.lat ?? ''} onChange={(e) => setFormF({ ...formF, lat: e.target.value })} /></Campo>
              <Campo label="Longitude" required><EntradaTexto value={formF.lng ?? ''} onChange={(e) => setFormF({ ...formF, lng: e.target.value })} /></Campo>
              <Campo label="Raio (m)"><EntradaTexto type="number" value={formF.radiusM ?? '300'} onChange={(e) => setFormF({ ...formF, radiusM: e.target.value })} /></Campo>
            </div>
          </Modal>
        </TabsContent>
      </Tabs>
    </Page>
  )
}
