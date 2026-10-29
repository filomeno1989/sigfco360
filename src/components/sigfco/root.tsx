// =====================================================================
// SIGFCO — Raiz da aplicação: sessão, shell de navegação e router de
// vistas. Idioma: Português de Moçambique (UX-001). Layout responsivo
// (§11.1) com footer fixo (min-h-screen flex).
// =====================================================================
'use client'

import * as React from 'react'
import { api } from '@/lib/client/api'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, MapPin, Truck, Route, Receipt, Landmark, Wrench, Fuel,
  FileCheck, BarChart3, ScrollText, BellRing, Settings, LogOut, Menu, User,
  Radio, AlertTriangle, ChevronsUpDown, Smartphone,
} from 'lucide-react'

import { LoginView } from './views-login'
import { DashboardView } from './views-dashboard'
import { MapaView } from './views-map'
import { FrotaView } from './views-fleet'
import { ViagensView } from './views-trips'
import { DespesasView } from './views-expenses'
import { FinanceiroView } from './views-finance'
import { ManutencaoView } from './views-maintenance'
import { RelatoriosView, AlertasView, AuditoriaView, ConfiguracaoView } from './views-misc'
import { MotoristaApp } from './views-driver'

// Moçambique tem um único fuso horário oficial (CAT, UTC+2). A base guarda o
// identificador IANA; apresentamos sempre o nome civil legível.
const FUSO_LABEL: Record<string, string> = { 'Africa/Maputo': 'Hora de Moçambique (CAT)' }
const fusoLegivel = (tz?: string | null) => FUSO_LABEL[tz ?? ''] ?? tz ?? FUSO_LABEL['Africa/Maputo']

export type Sessao = {
  user: { id: string; name: string; email: string; role: string; companyId: string | null; branchId: string | null; driverId: string | null }
  company: { id: string; name: string; currencyBase: string; timezone: string; locale: string; isDemo: boolean } | null
  driver: { id: string; name: string; code: string } | null
  unreadNotifications: number
}

type Ctx = {
  sessao: Sessao
  vista: string
  setVista: (v: string) => void
  recarregar: () => void
  logout: () => void
}
export const AppCtx = React.createContext<Ctx | null>(null)
export const useApp = () => React.useContext(AppCtx)!

type NavItem = { id: string; label: string; icon: React.ComponentType<{ className?: string }>; roles: string[] }

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Painel', icon: LayoutDashboard, roles: ['*'] },
  { id: 'mapa', label: 'Mapa da frota', icon: MapPin, roles: ['PLATFORM_ADMIN', 'COMPANY_ADMIN', 'FLEET_MANAGER', 'DISPATCHER', 'AUDITOR', 'BRANCH_MANAGER', 'FINANCE'] },
  { id: 'viagens', label: 'Viagens', icon: Route, roles: ['*'] },
  { id: 'frota', label: 'Frota', icon: Truck, roles: ['PLATFORM_ADMIN', 'COMPANY_ADMIN', 'FLEET_MANAGER', 'DISPATCHER', 'MECHANIC', 'AUDITOR', 'BRANCH_MANAGER', 'FINANCE'] },
  { id: 'despesas', label: 'Despesas', icon: Receipt, roles: ['*'] },
  { id: 'financeiro', label: 'Financeiro', icon: Landmark, roles: ['PLATFORM_ADMIN', 'COMPANY_ADMIN', 'FINANCE', 'AUDITOR'] },
  { id: 'manutencao', label: 'Manutenção & Pneus', icon: Wrench, roles: ['PLATFORM_ADMIN', 'COMPANY_ADMIN', 'FLEET_MANAGER', 'MECHANIC', 'DISPATCHER', 'AUDITOR', 'BRANCH_MANAGER'] },
  { id: 'combustivel', label: 'Combustível', icon: Fuel, roles: ['PLATFORM_ADMIN', 'COMPANY_ADMIN', 'FLEET_MANAGER', 'FINANCE', 'AUDITOR', 'MECHANIC', 'DISPATCHER', 'BRANCH_MANAGER'] },
  { id: 'documentos', label: 'Documentos', icon: FileCheck, roles: ['PLATFORM_ADMIN', 'COMPANY_ADMIN', 'FLEET_MANAGER', 'DISPATCHER', 'AUDITOR', 'BRANCH_MANAGER', 'FINANCE'] },
  { id: 'alertas', label: 'Alertas', icon: AlertTriangle, roles: ['PLATFORM_ADMIN', 'COMPANY_ADMIN', 'FLEET_MANAGER', 'DISPATCHER', 'FINANCE', 'AUDITOR', 'BRANCH_MANAGER'] },
  { id: 'relatorios', label: 'Relatórios', icon: BarChart3, roles: ['PLATFORM_ADMIN', 'COMPANY_ADMIN', 'FLEET_MANAGER', 'FINANCE', 'AUDITOR', 'DISPATCHER', 'BRANCH_MANAGER'] },
  { id: 'auditoria', label: 'Auditoria', icon: ScrollText, roles: ['PLATFORM_ADMIN', 'COMPANY_ADMIN', 'FINANCE', 'AUDITOR'] },
  { id: 'configuracao', label: 'Configuração', icon: Settings, roles: ['PLATFORM_ADMIN', 'COMPANY_ADMIN'] },
]

export function SigfcoApp() {
  const [sessao, setSessao] = React.useState<Sessao | null>(null)
  const [carregando, setCarregando] = React.useState(true)
  const [vista, setVistaRaw] = React.useState('dashboard')
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const carregar = React.useCallback(async () => {
    try {
      const me = await api<Sessao>('/api/auth/me')
      setSessao(me)
      setVistaRaw((v) => (v === 'login' ? (me.user.role === 'DRIVER' ? 'minha-viagem' : 'dashboard') : v))
    } catch {
      setSessao(null)
      setVistaRaw('login')
    } finally {
      setCarregando(false)
    }
  }, [])

  React.useEffect(() => { carregar() }, [carregar])

  // PWA: registo conservador do service worker (§8.3 — shell básico;
  // a persistência offline real vive no IndexedDB, não no SW)
  React.useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* sem SW: app continua funcional */ })
    }
  }, [])

  const setVista = (v: string) => { setVistaRaw(v); setMobileOpen(false) }
  const logout = async () => { await api('/api/auth/login', { method: 'POST', body: { action: 'logout' } }).catch(() => {}); setSessao(null); setVistaRaw('login') }

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal-800 text-white font-bold">SF</div>
          <p className="text-sm text-muted-foreground">A iniciar o SIGFCO…</p>
        </div>
      </div>
    )
  }

  if (!sessao || vista === 'login') return <LoginView aoEntrar={carregar} />

  const ctxValue: Ctx = { sessao, vista, setVista, recarregar: carregar, logout }
  const isDriverApp = sessao.user.role === 'DRIVER' || vista === 'minha-viagem'

  return (
    <AppCtx.Provider value={ctxValue}>
      {isDriverApp ? <MotoristaApp /> : (
        <div className="min-h-screen flex flex-col bg-background">
          <Topbar onMenu={() => setMobileOpen(true)} />
          <div className="flex flex-1">
            <Sidebar view={vista} setView={setVista} sessao={sessao} className="hidden md:flex" />
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild><span className="hidden" /></SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <SheetTitle className="sr-only">Navegação</SheetTitle>
                <Sidebar view={vista} setView={setVista} sessao={sessao} className="flex" />
              </SheetContent>
            </Sheet>
            <main className="flex-1 min-w-0 p-4 lg:p-6 pb-10">
              <VistaActual view={vista} />
            </main>
          </div>
          <footer className="mt-auto border-t py-3 px-6 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
            <span>SIGFCO — Sistema Integrado de Gestão de Frotas e Controles Operacionais</span>
            <span>{sessao.company?.name}{sessao.company?.isDemo ? ' • ambiente DEMO' : ''} • {fusoLegivel(sessao.company?.timezone)}</span>
          </footer>
        </div>
      )}
    </AppCtx.Provider>
  )
}

function VistaActual({ view }: { view: string }) {
  switch (view) {
    case 'dashboard': return <DashboardView />
    case 'mapa': return <MapaView />
    case 'viagens': return <ViagensView />
    case 'frota': return <FrotaView abaInicial="veiculos" />
    case 'despesas': return <DespesasView />
    case 'financeiro': return <FinanceiroView />
    case 'manutencao': return <ManutencaoView />
    case 'combustivel': return <ManutencaoView abaInicial="combustivel" />
    case 'documentos': return <FrotaView abaInicial="documentos" />
    case 'alertas': return <AlertasView />
    case 'relatorios': return <RelatoriosView />
    case 'auditoria': return <AuditoriaView />
    case 'configuracao': return <ConfiguracaoView />
    default: return <DashboardView />
  }
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const app = useApp()
  const { sessao } = app
  const [unread, setUnread] = React.useState(sessao.unreadNotifications)
  React.useEffect(() => {
    const t = setInterval(async () => {
      try { const me = await api<Sessao>('/api/auth/me'); setUnread(me.unreadNotifications); app.recarregar() } catch { /* silencioso */ }
    }, 60_000)
    return () => clearInterval(t)
  }, [])  

  return (
    <header className="sticky top-0 z-40 border-b bg-zinc-950 text-zinc-50">
      <div className="flex h-14 items-center gap-3 px-4">
        <Button variant="ghost" size="icon" className="md:hidden text-zinc-300 hover:bg-zinc-800 hover:text-white" onClick={onMenu}>
          <Menu className="h-5 w-5" />
        </Button>
        <a className="flex items-center gap-2.5 cursor-pointer" onClick={() => app.setVista('dashboard')}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 font-bold text-white text-sm">SF</span>
          <span className="font-semibold tracking-tight hidden sm:block">SIGFCO</span>
          {sessao.company?.isDemo && <span className="rounded border border-amber-500/60 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">DEMO</span>}
        </a>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="relative text-zinc-300 hover:bg-zinc-800 hover:text-white" onClick={() => app.setVista(sessao.user.role === 'DRIVER' ? 'minha-viagem' : 'alertas')} aria-label="Notificações">
            <BellRing className="h-5 w-5" />
            {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-zinc-950">{unread}</span>}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 text-zinc-200 hover:bg-zinc-800 hover:text-white">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline text-sm">{sessao.user.name.split(' (')[0]}</span>
                <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <div className="text-sm font-semibold">{sessao.user.name}</div>
                <div className="text-xs text-muted-foreground">{sessao.user.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {sessao.user.role !== 'DRIVER' && (
                <DropdownMenuItem onClick={() => app.setVista('minha-viagem')}>
                  <Smartphone className="mr-2 h-4 w-4" /> Abrir App do Motorista (pré-visualizar)
                </DropdownMenuItem>
              )}
              {sessao.user.role === 'DRIVER' && (
                <DropdownMenuItem onClick={() => app.setVista('dashboard')}>
                  <LayoutDashboard className="mr-2 h-4 w-4" /> Modo escritório
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={app.logout} className="text-red-600 focus:text-red-600">
                <LogOut className="mr-2 h-4 w-4" /> Terminar sessão
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

function Sidebar({ view, setView, sessao, className }: { view: string; setView: (v: string) => void; sessao: Sessao; className?: string }) {
  const itens = NAV.filter((n) => n.roles.includes('*') || n.roles.includes(sessao.user.role))
  return (
    <nav className={cn('w-64 shrink-0 flex-col border-r bg-zinc-950 text-zinc-300 py-3', className)} aria-label="Navegação principal">
      <div className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Operação</div>
      {itens.slice(0, 9).map((n) => (
        <NavBtn key={n.id} item={n} activo={view === n.id} onClick={() => setView(n.id)} />
      ))}
      <div className="mt-3 px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Gestão</div>
      {itens.slice(9).map((n) => (
        <NavBtn key={n.id} item={n} activo={view === n.id} onClick={() => setView(n.id)} />
      ))}
      <div className="mt-auto px-4 pt-4 text-[10px] leading-relaxed text-zinc-600">
        v1.0 • Fuso {fusoLegivel(sessao.company?.timezone)}
        <br />Base {sessao.company?.currencyBase ?? 'MZN'}
      </div>
    </nav>
  )
}

function NavBtn({ item, activo, onClick }: { item: NavItem; activo: boolean; onClick: () => void }) {
  const Icon = item.icon
  return (
    <button onClick={onClick}
      className={cn('flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors text-left',
        activo ? 'bg-zinc-800 text-white font-medium border-r-2 border-teal-500' : 'hover:bg-zinc-900 hover:text-white')}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  )
}
