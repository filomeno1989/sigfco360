# SIGFCO — Registo de Decisões Técnicas (DEV-008)
# Cada decisão: opções consideradas → escolha → limitações/riscos → impacto nos requisitos

## DT-01 · Stack de aplicação

**Escolha:** Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui + Prisma/SQLite.
**Alternativas:** Laravel/Django monólito; React+FastAPI separados; Supabase.
**Porquê:** single deploy, SSR leve, componentes acessíveis prontos, ORM com migrações versionadas. O ambiente de entrega já opera Node/Bun.
**Limitações:** SQLite não suporta Row Level Security nem enums — isolamento garantido na camada de servidor (SEC-004 alternativa aceitável para piloto; AT-001 testado).
**Impacto:** migração a PostgreSQL é portável (schema Prisma sem alterações estruturais). RLS deve ser activada na migração de produção.

## DT-02 · Dinheiro e câmbio

**Escolha:** montantes em **unidades menores inteiras** (centavos) + taxa como string decimal; conversão guardada (valor original nunca substituído).
**Alternativas:** float (rejeitado — FIN-004 proíbe aritmética binária); Decimal do Prisma (não suportado em SQLite).
**Verificação:** testes unitários + AT-013 (300 ZAR × 3,48 = 1.044,00 MZN reproduzível).

## DT-03 · Autenticação e sessões

**Escolha:** auth próprio com scrypt + token opaco (cookie httpOnly) + tabela Session (hash SHA-256, janela de inactividade, revogação por dispositivo).
**Alternativas:** NextAuth (adicionaria camada sobre requisitos de revogação imediata por dispositivo que o SRS exige de forma explícita — §4.1, MOB-002).
**Riscos:** manter rotação de SESSION_SECRET e HTTPS obrigatório em produção (SEC-001/005).

## DT-04 · GPS — fonte primária e adaptadores

**Escolha:** interface `ProviderAdapter` (parse → NormalizedPoint) + endpoint único de ingestão autenticado por apiKey **por dispositivo** (rotação suportada). Deduplicação por (deviceId, seq). Store-and-forward com gnssTime original + isHistoric.
**Alternativas:** integração direta por fornecedor (rejeitada — GPS-008/ARC-002 exigem troca sem tocar módulos).
**Simulador DEMO:** corre pela MESMA via do adaptador com fonte `SIMULATOR`; nunca apresentado como real (DEV-003). A produção não o activa.
**Pendência (ARC-005):** homologação de fabricante/protocolo (Teltonika/Queclink/etc.), memória offline 30 dias, bateria de reserva, SIM/roaming — checklist nos manuais.

## DT-05 · Mapa

**Escolha:** Leaflet + tiles OpenStreetMap para visualização; linhas tracejadas representam apenas ligação visual entre pontos (§7.4).
**Alternativas:** Google Maps (custo/licença); Mapbox (custo por carga).
**Limitação:** mapa **offline** exige fornecedor com licença explícita de cache/download (AT-022) — NÃO activado (ARC-004, §19).

## DT-06 · Offline do motorista

**Escolha:** IndexedDB (persistência real) + fila com clientUuid (UUID) + reenvio com backoff + ACK do servidor antes de limpar + fotos comprimidas em canvas (max 1280 px, JPEG 0,72).
**Alternativas:** localStorage (rejeitado — limites e frágil); background sync API (suporte irregular — usado apenas como optimização via evento online).
**Limitação declarada (§8.3):** navegadores suspendem SW/geolocalização; o rastreio contínuo garantido é o do rastreador dedicado — nunca do telemóvel (DEV-005).

## DT-07 · Rota visível única (SPA)

**Escolha:** aplicação num único `/` com navegação interna; backend em `/api/*`.
**Alternativas:** multi-página (interferia com o ambiente de publicação escolhido).
**Impacto:** nenhum requisito funcional afectado; rotas de API permanecem REST.

## DT-08 · Estados como strings + constantes tipadas

**Escolha:** SQLite sem enums → constantes TypeScript em `src/lib/constantes.ts` com rótulos PT-MZ.
**Risco controlado:** validação de valores nos endpoints (ex.: tipos de evento, categorias).

## DT-09 · Numeração única

**Escolha:** tabela Counter por empresa/chave dentro de transacção (`nextCode`) → sem colisões multiutilizador (FR-005).

## DT-10 · Alertas e notificações

**Escolha:** tabela Alert (gravidades §15.2) + Notification in-app; conectores email/SMS ficam atrás de `createAlert` para activação futura sem alterar módulos.
**Pendência §19:** fornecedor/custos por país.

## DT-11 · Testes

**Escolha:** bun test para regras puras (20 testes: estados, checklist bloqueante, câmbio, haversine, frescura) + verificação e2e por browser dos fluxos críticos + testes de API dos cenários AT executados com evidência no worklog.
**Pendência AT-004/007/020/021/022/025:** hardware real / restauro controlado — execução do operador.

## DT-12 · Migração de produção — PostgreSQL (Supabase) + Vercel

**Escolha:** para a entrada em operação real (Beira, 2026) a base migra de SQLite para PostgreSQL hospedado no Supabase; a aplicação é publicada na Vercel. O schema Prisma não muda de estrutura (era portável por desenho — ver DT-01).
**Razões:** disponibilidade a partir de qualquer escritório/telemóvel, backups automáticos, ligação futura de RLS (DT-01), pooler PgBouncer para funções serverless.
**Ajustes aplicados:** datasource `postgresql`; ligação de runtime via pooler (porta 6543); DDL aplicado uma única vez com `prisma db push` a partir de ligação directa; `prisma generate` no postinstall; `output: standalone` apenas fora da Vercel.
**Riscos controlados:** estados continuam strings com validação no servidor (DT-08); dinheiro continua em centavos inteiros (DT-02); `contains` passa a sensível a maiúsculas por omissão no PostgreSQL — queries de pesquisa mantêm comportamento aceitável porque os códigos são normalizados em maiúsculas na entrada.
**Pendência declarada:** anexos ainda em disco local do runtime (efémero em serverless) — migração para Supabase Storage pendente (ver README §7).
