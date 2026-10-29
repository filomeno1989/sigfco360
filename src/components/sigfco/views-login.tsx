// SIGFCO - Autenticação: credenciais, credenciais DEMO visíveis
// apenas no ambiente de demonstração
'use client'

import * as React from 'react'
import { api } from '@/lib/client/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Lock, Info } from 'lucide-react'
import { TemaBotao } from './tema-botao'

export function LoginView({ aoEntrar }: { aoEntrar: () => void }) {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [demo, setDemo] = React.useState<{ enabled: boolean; seeded: boolean } | null>(null)

  React.useEffect(() => {
    api<{ enabled: boolean; seeded: boolean }>('/api/demo').then(setDemo).catch(() => setDemo({ enabled: false, seeded: false }))
  }, [])

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null); setBusy(true)
    try {
      await api('/api/auth/login', { method: 'POST', body: { action: 'login', email, password } })
      aoEntrar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha de autenticação.')
    } finally { setBusy(false) }
  }

  const semearDemo = async () => {
    setBusy(true); setErro(null)
    try {
      await api('/api/demo', { method: 'POST', body: { action: 'seed' } })
      setDemo({ seeded: true })
    } catch (err) { setErro(err instanceof Error ? err.message : 'Falha ao criar ambiente DEMO.') }
    finally { setBusy(false) }
  }

  const entrarDemo = async (cred: { email: string; password: string }) => {
    setEmail(cred.email); setPassword(cred.password)
    setBusy(true); setErro(null)
    try {
      await api('/api/auth/login', { method: 'POST', body: { action: 'login', email: cred.email, password: cred.password } })
      aoEntrar()
    } catch (err) { setErro(err instanceof Error ? err.message : 'Falha de autenticação.') }
    finally { setBusy(false) }
  }

  const DEMO_CREDS = [
    { perfil: 'Director / Admin', email: 'director@demo.sigfco' },
    { perfil: 'Gestor de frota', email: 'frota@demo.sigfco' },
    { perfil: 'Despachante', email: 'despacho@demo.sigfco' },
    { perfil: 'Financeiro', email: 'financas@demo.sigfco' },
    { perfil: 'Motorista', email: 'motorista@demo.sigfco' },
    { perfil: 'Mecânico', email: 'mecanico@demo.sigfco' },
    { perfil: 'Auditor', email: 'auditor@demo.sigfco' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <div className="flex justify-end p-3">
        <TemaBotao className="text-zinc-300 hover:bg-zinc-800 hover:text-white" />
      </div>
      <div className="flex-1 flex items-start justify-center p-6 pt-0">
        <div className="grid w-full max-w-4xl gap-6 lg:grid-cols-2 items-start">
          <div className="space-y-6">
            <div className="space-y-4">
              <img src="/brand/logo-sigfco-frotas.png" alt="SIGFCO - Sistema Integrado de Gestão de Frotas e Controlos Operacionais" className="h-28 w-auto max-w-full" />
            </div>
            <p className="text-sm leading-relaxed text-zinc-400">
              Plataforma integrada para viagens, frota, motoristas, despesas, manutenção, documentos e rastreio autónomo por GPS dedicado - Porto da Beira, EN6 e corredores transfronteiriços da África Austral.
            </p>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li className="flex gap-2"><Lock className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" /> Rastreador dedicado no veículo como fonte primária de localização (não depende do telemóvel do motorista)</li>
              <li className="flex gap-2"><Lock className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" /> Operação offline-first: despesas e ocorrências guardadas no telemóvel e sincronizadas sem duplicação</li>
              <li className="flex gap-2"><Lock className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" /> Checklist pré-partida com bloqueio obrigatório do carregador e do rastreador</li>
              <li className="flex gap-2"><Lock className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" /> Trilha de auditoria completa e segregação de funções por perfil</li>
            </ul>
          </div>

          <div className="space-y-4">
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <CardHeader>
                <CardTitle>Entrar no sistema</CardTitle>
                <CardDescription className="text-zinc-400">Use as suas credenciais institucionais.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submeter} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-zinc-950 border-zinc-700" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Palavra-passe</Label>
                    <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-zinc-950 border-zinc-700" />
                  </div>
                  {erro && <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>}
                  <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-500" disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {demo?.enabled && (
            <Card className="bg-zinc-900/60 border-amber-600/40 border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-500"><Info className="h-4 w-4" /> Ambiente de demonstração</CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  {demo?.seeded
                    ? 'Dados fictícios claramente identificados. Credenciais indicadas no Manual de Operação.'
                    : 'O ambiente de demonstração ainda não foi preparado.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {demo?.seeded ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {DEMO_CREDS.map((c) => (
                      <button key={c.email} onClick={() => entrarDemo({ email: c.email, password: 'Sigfco2026!' })}
                        className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-left text-xs hover:border-teal-600 hover:bg-zinc-800 transition-colors">
                        <span className="block font-medium">{c.perfil}</span>
                        <span className="text-zinc-500">{c.email}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <Button variant="outline" onClick={semearDemo} disabled={busy} className="border-amber-600/60 text-amber-400 hover:bg-amber-950/40 hover:text-amber-300">
                    Preparar ambiente DEMO (empresa fictícia)
                  </Button>
                )}
              </CardContent>
            </Card>
            )}
          </div>
        </div>
      </div>
      <footer className="border-t border-zinc-800 px-6 py-3 text-xs text-zinc-500">
        SIGFCO v1.0 • Fuso horário de Moçambique (CAT, UTC+2) • Moeda-base MZN • Português de Moçambique
      </footer>
    </div>
  )
}
