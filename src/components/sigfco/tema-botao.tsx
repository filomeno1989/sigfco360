// Botão de alternância entre modo escuro e modo claro (a escolha fica no dispositivo)
'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function TemaBotao({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [montado, setMontado] = React.useState(false)
  React.useEffect(() => setMontado(true), [])
  const escuro = montado ? theme !== 'light' : true
  return (
    <Button variant="ghost" size="icon" className={className} aria-label="Alternar entre modo escuro e claro" title="Tema"
      onClick={() => setTheme(escuro ? 'light' : 'dark')}>
      {escuro ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  )
}
