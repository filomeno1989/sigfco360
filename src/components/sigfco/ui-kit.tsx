// SIGFCO - Kit de componentes partilhados (: tabelas com pesquisa,
// estados visíveis, confirmação para operações destrutivas, DEMO visível)
'use client'

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Search, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

export { Button } from '@/components/ui/button'

export function Page({ title, subtitle, actions, children, demo }: {
  title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; demo?: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            {title}
            {demo && <Badge variant="outline" className="border-amber-500 text-amber-600">DEMO</Badge>}
          </h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

export function Panel({ title, description, actions, children, className }: {
  title?: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return (
    <Card className={className}>
      {(title || actions) && (
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              {title && <CardTitle className="text-base">{title}</CardTitle>}
              {description && <CardDescription>{description}</CardDescription>}
            </div>
            {actions}
          </div>
        </CardHeader>
      )}
      <CardContent className={cn(!title && 'pt-6')}>{children}</CardContent>
    </Card>
  )
}

export function Kpi({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: 'ok' | 'warn' | 'crit' | 'muted' }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn('mt-1 text-2xl font-semibold tabular-nums',
          tone === 'ok' && 'text-emerald-700', tone === 'warn' && 'text-amber-600',
          tone === 'crit' && 'text-red-600', tone === 'muted' && 'text-muted-foreground')}>
          {value}
        </div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  )
}

export type Coluna<T> = { key: string; header: string; render?: (row: T) => React.ReactNode; className?: string; hideOnMobile?: boolean }

export function DataTable<T extends { id?: string }>({ columns, rows, empty, onRowClick, filtro, filtroPlaceholder }: {
  columns: Coluna<T>[]; rows: T[]; empty?: string; onRowClick?: (row: T) => void
  filtro?: (row: T, q: string) => boolean; filtroPlaceholder?: string
}) {
  const [q, setQ] = React.useState('')
  const visiveis = React.useMemo(() => {
    if (!filtro || !q.trim()) return rows
    const needle = q.toLowerCase()
    return rows.filter((r) => filtro(r, needle))
  }, [rows, q, filtro])

  return (
    <div className="space-y-3">
      {filtro && (
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={filtroPlaceholder ?? 'Pesquisar…'} className="pl-8" />
        </div>
      )}
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              {columns.map((c) => (
                <th key={c.key} className={cn('px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap', c.hideOnMobile && 'hidden md:table-cell')}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 && (
              <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">{empty ?? 'Sem registos.'}</td></tr>
            )}
            {visiveis.map((row, i) => (
              <tr key={row.id ?? i} onClick={() => onRowClick?.(row)}
                className={cn('border-b last:border-0 transition-colors', onRowClick && 'cursor-pointer hover:bg-muted/50')}>
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-3 py-2.5 align-top', c.className, c.hideOnMobile && 'hidden md:table-cell')}>
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtro && <div className="text-xs text-muted-foreground">{visiveis.length} de {rows.length} registos</div>}
    </div>
  )
}

export function StatusBadge({ estado, mapa }: { estado: string; mapa: Record<string, string> }) {
  const cores: Record<string, string> = {
    // viagens
    DRAFT: 'bg-zinc-100 text-zinc-700 border-zinc-200', PLANNED: 'bg-sky-50 text-sky-800 border-sky-200',
    AWAITING_CHECKLIST: 'bg-amber-50 text-amber-800 border-amber-200', AUTHORIZED_DEPARTURE: 'bg-teal-50 text-teal-800 border-teal-200',
    IN_TRANSIT: 'bg-teal-600/10 text-teal-800 border-teal-300', PAUSED: 'bg-orange-50 text-orange-800 border-orange-200',
    ARRIVED: 'bg-lime-50 text-lime-800 border-lime-200', AWAITING_RECONCILIATION: 'bg-amber-50 text-amber-800 border-amber-200',
    CLOSED: 'bg-zinc-100 text-zinc-600 border-zinc-200', CANCELLED: 'bg-red-50 text-red-700 border-red-200',
    // veículos
    AVAILABLE: 'bg-emerald-50 text-emerald-800 border-emerald-200', RESERVED: 'bg-teal-50 text-teal-800 border-teal-200',
    IN_TRANSIT_: '', MAINTENANCE: 'bg-orange-50 text-orange-800 border-orange-200', INACTIVE: 'bg-zinc-100 text-zinc-600 border-zinc-200',
    BLOCKED: 'bg-red-50 text-red-700 border-red-200',
    // despesas
    SUBMITTED: 'bg-amber-50 text-amber-800 border-amber-200', IN_REVIEW: 'bg-teal-50 text-teal-800 border-teal-200',
    APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-200', REJECTED: 'bg-red-50 text-red-700 border-red-200',
    RETURNED: 'bg-orange-50 text-orange-800 border-orange-200', RECONCILED: 'bg-zinc-100 text-zinc-700 border-zinc-200', VOID: 'bg-zinc-100 text-zinc-500 border-zinc-200',
    // alertas
    CRITICAL: 'bg-red-100 text-red-800 border-red-300', HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
    MEDIUM: 'bg-amber-50 text-amber-800 border-amber-200', INFO: 'bg-zinc-100 text-zinc-600 border-zinc-200',
    // gps
    LIVE: 'bg-emerald-50 text-emerald-800 border-emerald-200', DELAYED: 'bg-amber-50 text-amber-800 border-amber-200',
    NO_COMMUNICATION: 'bg-red-50 text-red-700 border-red-200', HISTORIC: 'bg-zinc-100 text-zinc-600 border-zinc-200',
    OPERATIONAL: 'bg-emerald-50 text-emerald-800 border-emerald-200', NO_NETWORK: 'bg-amber-50 text-amber-800 border-amber-200',
    NO_POWER: 'bg-red-100 text-red-800 border-red-300', TAMPER_ALERT: 'bg-red-100 text-red-800 border-red-300',
    OFFLINE: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  }
  return <Badge variant="outline" className={cn('whitespace-nowrap', cores[estado])}>{mapa[estado] ?? estado}</Badge>
}

export function Campo({ label, children, hint, required, erro }: { label: string; children: React.ReactNode; hint?: string; required?: boolean; erro?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}{required && <span className="text-red-600"> *</span>}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  )
}

export function EntradaTexto(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <Input {...props} />
}

// O Radix Select nao aceita <SelectItem value=""> (lanca erro em runtime).
// Traduzimos internamente o estado "sem escolha" para um valor sentinela,
// mantendo a API publica do componente com '' (vazio) para as vistas.
const SEM_ESCOLHA = '__sem_escolha__'

export function Selecao({ value, onChange, opcoes, placeholder }: {
  value?: string; onChange: (v: string) => void
  opcoes: Array<{ value: string; label: string }>; placeholder?: string
}) {
  const valorInterno = value == null || value === '' ? SEM_ESCOLHA : value
  const escolher = (v: string) => onChange(v === SEM_ESCOLHA ? '' : v)
  return (
    <Select value={valorInterno} onValueChange={escolher}>
      <SelectTrigger className="w-full"><SelectValue placeholder={placeholder ?? 'Seleccionar…'} /></SelectTrigger>
      <SelectContent>
        {opcoes.map((o) => <SelectItem key={o.value} value={o.value === '' ? SEM_ESCOLHA : o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

export function TextoLongo(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <Textarea {...props} />
}

export function Modal({ open, onOpenChange, title, description, children, footer, wide }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string; description?: string
  children: React.ReactNode; footer?: React.ReactNode; wide?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(wide && 'max-w-3xl lg:max-w-4xl', 'max-h-[90vh] overflow-y-auto')}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4">{children}</div>
        {footer && <DialogFooter className="gap-2">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}

export function Confirmacao({ open, onOpenChange, titulo, mensagem, onConfirm, perigo, exigirTexto, pedirMotivo }: {
  open: boolean; onOpenChange: (v: boolean) => void; titulo: string; mensagem: string
  onConfirm: (texto?: string) => void; perigo?: boolean; exigirTexto?: string; pedirMotivo?: boolean
}) {
  const [texto, setTexto] = React.useState('')
  const [motivo, setMotivo] = React.useState('')
  React.useEffect(() => { if (!open) { setTexto(''); setMotivo('') } }, [open])
  const bloqueado = exigirTexto ? texto.trim().toUpperCase() !== exigirTexto.toUpperCase() : false
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={titulo} description={mensagem}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant={perigo ? 'destructive' : 'default'} disabled={bloqueado} onClick={() => { onConfirm(motivo || texto); onOpenChange(false) }}>
            Confirmar
          </Button>
        </>
      }>
      {exigirTexto && (
        <div className="space-y-1.5">
          <Label>Digite <b>{exigirTexto}</b> para confirmar</Label>
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
      )}
      {pedirMotivo && (
        <div className="space-y-1.5">
          <Label>Motivo</Label>
          <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Descreva o motivo…" />
        </div>
      )}
    </Modal>
  )
}

export function ErroAlerta({ erro }: { erro?: string | null }) {
  if (!erro) return null
  return (
    <Alert variant="destructive">
      <TriangleAlert className="h-4 w-4" />
      <AlertDescription>{erro}</AlertDescription>
    </Alert>
  )
}

export function Carregando() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

export function AProcessar({ label }: { label?: string }) {
  return <span className="inline-flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" />{label ?? 'A processar…'}</span>
}
