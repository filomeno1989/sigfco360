// SIGFCO - Rede de segurança: se qualquer ecrã falhar de forma inesperada,
// o utilizador vê esta mensagem clara com botão para tentar de novo, em vez
// da aplicação desaparecer. Os dados continuam guardados no servidor.
'use client'

export default function ErroGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-4 text-center border rounded-xl p-6 bg-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 text-xl font-bold">!</div>
        <h2 className="text-lg font-semibold">Ocorreu um erro inesperado neste ecrã</h2>
        <p className="text-sm text-muted-foreground">
          A operação foi interrompida, mas nenhum dado foi perdido. Tente novamente; se o problema
          continuar, recarregue a página ou volte a entrar na aplicação.
        </p>
        <button
          onClick={reset}
          className="inline-flex h-10 items-center justify-center rounded-md bg-teal-800 px-5 text-sm font-medium text-white hover:bg-teal-900"
        >
          Tentar novamente
        </button>
        {error?.digest && <p className="text-[11px] text-muted-foreground">Referência do erro: {error.digest}</p>}
      </div>
    </div>
  )
}
