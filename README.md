# SIGFCO — Sistema Integrado de Gestão de Frotas e Controles Operacionais

Implementação integral do SRS v1.0 (27-10-2026): painel Web de escritório + App do Motorista
(PWA offline-first) + camada de ingestão GPS autónoma com adaptadores por fornecedor.

**Âmbito operacional:** Porto da Beira • EN6 • rotas nacionais e transfronteiriças da África Austral
**Idioma:** Português de Moçambique (estrutura preparada para inglês) • Fuso Hora de Moçambique (CAT, UTC+2) • Moeda-base MZN
**Propriedade:** Filomeno Manuel Joaquim Alexandre — Beira, Moçambique

---

## 1. Requisitos do ambiente

- Node.js 20+ ou Bun 1.1+
- Base de dados PostgreSQL — produção hospedada no Supabase (projeto `sigfco360`);
  em desenvolvimento local pode apontar `DATABASE_URL` para a própria base na nuvem
  (decisão de migração documentada em `docs/DECISOES_TECNICAS.md`, DT-12)

## 2. Instalação e execução

```bash
# 1. dependências
bun install            # ou npm install

# 2. base de dados (aplica prisma/schema.prisma à base em DATABASE_URL)
bun run db:push

# 3. ambiente de desenvolvimento
bun run dev            # http://localhost:3000

# 4. testes das regras críticas
bun test tests/regras.test.ts

# 5. qualidade
bun run lint
```

### Ambiente de demonstração

O sistema inicia vazio (produção limpa, FR-004). Para criar a empresa de DEMONSTRAÇÃO
(dados fictícios claramente identificados como DEMO em todos os ecrãs — DEV-003):

1. Abra a aplicação e clique **"Preparar ambiente DEMO"**; ou
2. `curl -X POST http://localhost:3000/api/demo -H 'Content-Type: application/json' -d '{"action":"seed"}'`

**Credenciais DEMO** (palavra-passe de todas: `Sigfco2026!`):

| Perfil | Email |
|---|---|
| Director / Admin empresa | `director@demo.sigfco` |
| Gestor de frota | `frota@demo.sigfco` |
| Despachante | `despacho@demo.sigfco` |
| Financeiro | `financas@demo.sigfco` |
| Motorista (João Macuácua) | `motorista@demo.sigfco` |
| Mecânico | `mecanico@demo.sigfco` |
| Auditor | `auditor@demo.sigfco` |

> ⚠️ Produção: criar utilizadores reais pela Configuração → Utilizadores e desactivar/remover a empresa DEMO. Nunca use credenciais demo em produção (SEC-002, DEV-007).

## 3. Variáveis de ambiente

Ver `.env.example`. Em produção são obrigatórias: `DATABASE_URL` (PostgreSQL/Supabase,
via pooler na porta 6543) e, quando homologados, os segredos dos fornecedores.
Nenhum segredo vive no código cliente (DEV-007).

## 4. Arquitectura (resumo)

```
src/
  app/
    page.tsx                 → única rota visível (SPA com navegação interna)
    api/                     → backend: 30 endpoints documentados nos próprios ficheiros
      auth/                  → login/logout/sessões revogáveis/me
      trips/[id]/actions     → máquina de estados da viagem (§5.1)
      trips/[id]/checklist   → checklist pré-partida com bloqueio do carregador
      gps/ingest             → telemetria store-and-forward idempotente
      sync                   → fila offline do motorista com ACK por item
      demo                   → seed DEMO + simulador de telemetria (fonte SIMULATOR)
  lib/
    auth.ts rbac.ts api.ts   → sessões scrypt, matriz de permissões, guard de rotas
    viagem.ts veiculo.ts     → motor de estados, conflitos, elegibilidade
    gps.ts financeiro.ts     → ingestão, geofences, frescura, orçamentos, duplicados
    money.ts numeracao.ts    → centavos inteiros, câmbio auditado, contadores
  components/sigfco/         → vistas (login, painel, mapa, viagens, frota, despesas,
                               financeiro, manutenção, relatórios, auditoria, config,
                               app do motorista)
  lib/client/offline.ts      → IndexedDB, fila com UUID, reenvio idempotente, compressão de fotos
prisma/schema.prisma         → 36 modelos (SRS §13)
docs/                        → matriz de requisitos, decisões técnicas, manuais
public/sw.js manifest        → PWA (instalável; shell mínimo)
tests/regras.test.ts         → 20 testes das regras críticas
```

## 5. Integrações externas — pontos de ligação prontos

O sistema funciona SEM nenhum fornecedor contratado; todos os adaptadores estão isolados:

| Integração | Estado | Ponto de ligação |
|---|---|---|
| Rastreador GPS | **Pendente de homologação** (ARC-005) | `POST /api/gps/ingest` (contrato em `GET /api/gps/ingest`); acrescente o adapter em `src/lib/gps.ts → adapters` |
| Simulador de telemetria | Activo só no ambiente DEMO, fonte `SIMULATOR` | `POST /api/demo {"action":"simulator-tick"}` |
| Mapas | OpenStreetMap (visualização) | `src/components/sigfco/views-map.tsx`; mapa offline depende de fornecedor licenciado (ARC-004) |
| Câmbio automático | Manual auditado (FIN-003) | `src/lib/money.ts → setRate` (fonte `API` quando houver credenciais) |
| E-mail / SMS / WhatsApp | Inbox in-app activa | `src/lib/gps.ts → createAlert` (canal externo após fornecedor) |
| Contabilidade | Exports CSV verificáveis | `GET /api/reports/export?type=…` |

## 6. Segurança (resumo; detalhe em docs/DECISOES_TECNICAS.md)

- Sessões httpOnly com hash SHA-256 na BD, expiração por inactividade e revogação imediata por dispositivo
- RBAC verificado em **cada** chamada ao servidor; isolamento por empresa testado (AT-001)
- Auditoria de operações críticas com antes/depois (SEC-009)
- Ficheiros privados com hash SHA-256 e download autorizado (SEC-007)
- Rate limiting em login, ingestão GPS e sincronização (SEC-008)
- Palavras-passe com scrypt + política mínima; sem segredos no cliente (DEV-007)

## 7. Limitações conhecidas (declaração honesta — DEV-009)

1. **GPS:** nenhum equipamento real foi homologado; a telemetria disponível é `SIMULATOR` (DEMO) e está etiquetada como tal em toda a interface. A certificação exige teste com hardware real.
2. **Mapa offline:** OSM público não autoriza download em massa; activar apenas com fornecedor licenciado.
3. **PWA em segundo plano:** navegadores suspendem execução/geolocalização; o rastreio contínuo garantido é o do rastreador dedicado (REGRA FUNDAMENTAL do SRS).
4. **Notificações externas (email/SMS):** inbox in-app activa; canais externos exigem fornecedor e custos.
5. **Anexos em disco local:** os ficheiros privados vão para o disco do servidor; em hospedagem serverless (Vercel) o disco é efémero — migração para Supabase Storage prevista (ponto de ligação: `src/lib/files.ts`).
6. **Can bus/OBD, satélite, imobilização remota:** fora do âmbito inicial (§2.4 do SRS).
