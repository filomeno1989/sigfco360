# Worklog — SIGFCO

Projecto: SIGFCO — Sistema Integrado de Gestão de Frotas e Controles Operacionais
Base legal: SRS v1.0 (upload/SIGFCO_Especificacao_Requisitos_SRS_v1_0 (2).pdf)
Stack: Next.js 16 (App Router) · TypeScript · Tailwind 4 · shadcn/ui · Prisma + SQLite

---
Task ID: 1
Agent: main (arquitecto/lead)
Task: Ler SRS integral (29 páginas), classificar tarefa (Tipo 3 — web fullstack), inicializar ambiente (DEV-002).

Work Log:
- PDF extraído integralmente para upload/sigfco_srs.txt (pdftotext) — 1956 linhas, 100% dos requisitos lidos
- Ambiente fullstack inicializado (init-fullstack.sh) — Next.js 16 + Prisma/SQLite + shadcn/ui
- Inspecção: scaffold limpo, schema Prisma default (User/Post a substituir), db em db/custom.db
- Decisões de arquitectura registadas (serão detalhadas em docs/DECISOES_TECNICAS.md):
  * Dinheiro em unidades menores inteiras (FIN-004) + taxa de câmbio como string decimal
  * Sem enums Prisma (SQLite) — estados como strings com constantes TS tipadas
  * Auth próprio com sessões revogáveis por dispositivo (SEC-002/MOB-002) — scrypt, sem segredos no cliente
  * GPS: camada de adaptadores + endpoint de ingestão idempotente (deviceId+seq único) + simulador DEMO identificado (DEV-003/ARC-005)
  * Mapa: Leaflet + OSM (ARC-004: sem download em massa de tiles; mapa offline fica pendente de fornecedor licenciado)
  * Isolamento multiempresa verificado no servidor em todas as consultas (SEC-004/AT-001)
  * A rota visível é "/" (SPA com navegação interna); backend em /api/*

Stage Summary:
- Ambiente a correr na porta 3000; pronto para schema + código

---
Task ID: 2-12 (entrega completa)
Agent: main (equipa de desenvolvimento)
Task: Construção integral do SIGFCO conforme SRS v1.0 — sistema completo em fases.

Work Log:
- ETAPA 1: Schema Prisma com 36 modelos (SRS §13) — migrações aplicadas com db:push iterativo
- ETAPA 2: Núcleo servidor — auth scrypt com sessões revogáveis por dispositivo, RBAC de 9 perfis
  (segregação: despachante não aprova; motorista só o seu escopo), auditoria antes/depois,
  numeração transaccional, moeda em centavos + câmbio auditado, rate limiting, adaptadores GPS
- ETAPAS 3-7: 30 endpoints /api/*: auth, empresa/parâmetros/filiais, utilizadores, sessões,
  motoristas, veículos (+elegibilidade/odómetro justificado), reboques, dispositivos GPS
  (+rotação de chave), ingestão store-and-forward idempotente (deviceId+seq), pontos com
  paginação, frota com frescura, geofences com eventos entrada/saída, documentos com
  vencimentos bloqueantes, viagens (10 estados validados no servidor), checklist com
  carregador sistémico bloqueante, eventos (13 tipos, idempotentes), despesas idempotentes
  com detecção de duplicados (hash+valor+local+tempo), aprovação com motivo obrigatório e
  segregação, anulação controlada, anexos privados com SHA-256, adiantamentos, per diem,
  câmbio, sync offline item-a-item, manutenção (OS crítica bloqueia + libertação com prova),
  pneus, combustível com anomalias, ocorrências, alertas 4 gravidades, notificações, auditoria,
  dashboard, exports CSV auditados, seed DEMO + simulador fonte=SIMULATOR
- ETAPA 8: Painel Web PT-MZ: login com credenciais DEMO visíveis só no ambiente demo, shell
  escuro teal, painel com KPIs e regras de fiabilidade §15.3, mapa Leaflet/OSM com frescura
  inequívoca e regras visíveis (sem dados ≠ parado), viagens com acções condicionais ao estado
  (sem controlos mortos), frota em 5 abas, fila financeira com filtros, financeiro
  (adiantamentos/per diem/câmbio), manutenção/pneus/combustível, alertas, relatórios,
  auditoria paginada, configuração completa
- ETAPA 9: App do Motorista PWA: viagem activa, checklist, partida/pausa/chegada, despesas
  com câmara+compressão canvas, SOS com confirmação digitada, fila offline em IndexedDB
  (4 estados legíveis, backoff, ACK antes de limpar), service worker conservador + manifest
  + ícones; simulador DEMO no mapa
- ETAPA 10: Verificação — bun test 20/20 PASS (estados, carregador, câmbio, haversine,
  frescura); lint limpo; testes AT executados:
  * AT-001 PASS (empresa B criada, fuga de tenant NEGADA e auditada)
  * AT-003 PASS (carregador falho → bloqueio; autorização sem checklist → negada; sem bypass)
  * AT-005 PASS (mesma seq reenviada → deduplicada; pontos atrasados com hora original)
  * AT-008/010 PASS (despesa offline guardada, sobrevive a reload, sincroniza sozinha)
  * AT-009 PASS (3 envios do mesmo UUID → 1 registo)
  * AT-012/FIN-014 PASS (aprovação/rejeição com motivo ≥8 chars + categoria + notificação)
  * AT-013 PASS (300 ZAR × 3.48 = 1044,00 MZN reproduzível com fonte registada)
  * AT-015 PASS (duplicado sinalizado 1; decisão fica para o aprovador)
  * AT-016 PASS (veículo sobreposto rejeitado com explicação)
  * AT-017/018 PASS (doc bloqueante expirado + OS crítica bloqueiam planeamento)
  * AT-024 PASS (exports CSV com auditoria)
- Bugs corrigidos durante a verificação: isDemo no Trailer (seed), PHONE_HOLDER_KEY não
  importado, relações Prisma em falta (Expense/FuelLog/Incident/WorkOrder/Plan/Advance/Attachment),
  campo code do Expense, clientUuid no sync, secondDriverRel→secondDriver, colisão de nome
  libertar, registo do service worker, email uppercase no tenant de teste
- ETAPA 11: Documentação: README.md (instalação, credenciais, integrações, limitações),
  docs/MATRIZ_REQUISITOS.md (requisito→ficheiro→evidência), docs/DECISOES_TECNICAS.md (11 decisões),
  docs/MANUAIS.md (7 perfis + operação + homologação GPS), .env.example, tests/regras.test.ts

Stage Summary:
- SIGFCO v1.0 funcional de ponta a ponta com base de dados real, permissões correctas,
  offline verificado no browser, auditoria e testes aprovados
- Pendências declaradas sem simulação: homologação de hardware GPS, mapa offline licenciado,
  canais de notificação externos, câmbio automático, restauro formal (AT-020) e dispositivos
  reais (AT-025) — todos com caminhos de ligação prontos e documentados
- Ambiente: Next.js 16 + Prisma/SQLite + Tailwind 4 + shadcn/ui + Leaflet; Bun test; ESLint limpo

---
Task ID: 13 (manual PDF)
Agent: main (documentacao)
Task: Manual completo do SIGFCO em PDF (pedido do Sr. Filomeno Manuel Joaquim Alexandre, Beira) antes da migracao GitHub+Supabase+Vercel.

Work Log:
- 2 exploradores paralelos mapearam 100% do sistema: 39 rotas /api, 34 modelos Prisma, 12 vistas, PWA, offline, DEMO
- Skill PDF carregado; briefs/report.md + typesetting (cover, overflow, pagination, palette, typography, fill-engine, cover-backgrounds, geometry, charts) lidos integralmente
- Paleta cascade --intent cold --seed 26 (azul-aco/teal, coerente com a identidade SIGFCO)
- Capa Template 01 HUD (html2poster.js 794px) validada com poster_validate + cover_validate (corrigido hero 64pt->46pt e span aninhado)
- Corpo ReportLab: TocDocTemplate + multiBuild, TOC clicavel 2 niveis, FreeSerif/DejaVu, install_font_fallback, tabelas Paragraph/colWidths verificadas, caixas criticas/alertas, CondPageBreak 25%
- Conteudo reescrito com acentuacao correcta PT-MZ pre-AO90 (mapa automatico insuficiente por 'e/esta' contextuais)
- Numeracao: capa oculta, TOC romano i-iii, corpo arabico reinicia em 1 (fix: beforeDocument reset por passada + decoracao em afterPage)
- QA: pdf_qa 11 passed / 0 errors (warnings de pontuacao '"' em inicio de linha = regra CJK, aceitavel em latim); font.check 0; pages.clean 0; sem texto em Helvetica (só recurso de pagina)
- 34 paginas, 275 KB; acentos verificados; Beira (nunca Maputo) e nome do proprietario na capa e ficha tecnica

Stage Summary:
- Entregues: download/SIGFCO_Manual_Completo_v1.0_Beira_2026.pdf (34 pag) + download/SIGFCO_Manual_Capa_fonte.html
- Estrutura: 15 capitulos (incl. arranque do zero na Beira e migracao nuvem) + anexos A/B/C (39 endpoints, 34 modelos, glossario)
- Scripts persistentes em scripts/manual_*.py para regeracao e actualizacao futura
- Proximo passo acordado: Sr. cria repo GitHub + token, projecto Supabase + credenciais, token Vercel; migracao segue Cap. 14
