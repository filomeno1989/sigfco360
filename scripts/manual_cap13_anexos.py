# -*- coding: utf-8 -*-
"""SIGFCO Manual - Capítulos 13-15 e Anexos."""
from manual_base import (S, bullets, caixa, codigo, h1, h2, h3, numerada,
                         p, tabela, alerta, PAUSE)
from reportlab.platypus import Spacer, Paragraph


def cap13(story):
    h1(story, 'Capítulo 13 — Arranque na Beira: do zero com dados reais')
    p(story, 'Este capítulo é o procedimento acordado para a operação real. '
             'Após a migração para a nuvem (Cap. 14), a base começa VAZIA: '
             'sem dados DEMO, sem viagens de teste. Siga a sequência abaixo '
             'com rigor — cada passo prepara o seguinte e evita bloqueios '
             'evitáveis (ex.: criar viagens antes de associar rastreadores '
             'resulta em recusa automática).', 'lead')
    alerta(story, 'Não misture ambiente DEMO com operação real. A empresa DEMO '
                  '“Transportadora Corredor DEMO” é fictícia e deve ser '
                  'ignorada (ou evitada) na base de produção. Todos os dados '
                  'reais devem nascer na empresa verdadeira criada no passo 1.',
           'Antes de começar')

    h2(story, '13.1 Sequência de registos (ordem recomendada)')
    numerada(story, [
        '<b>Empresa</b> (Configuração — Empresa): nome legal, NUIT, telefone, morada na Beira, '
        'moeda-base MZN.',
        '<b>Filiais</b> (se existirem): ex. Beira-Sede, Porto da Beira, com coordenadas.',
        '<b>Utilizadores</b> (Configuração — Utilizadores): criar contas reais por perfil, com '
        'palavras-passe fortes; ligar contas de motoristas ao registo de motorista correspondente.',
        '<b>Motoristas</b> (Frota — Motoristas): nome, contacto, carta (número, categoria, validade, '
        'país MZ). Verificar a coluna “Elegível”.',
        '<b>Veículos</b> (Frota — Veículos): matrícula normalizada (ex. AAH123MZ), tanque, '
        'consumo de referência L/100km, odómetro actual REAL do painel.',
        '<b>Rastreadores</b> (Frota — Rastreadores GPS): registar dispositivo, GUARDAR a apiKey '
        'na primeira exibição, configurar o equipamento com ela, e “Associar a...” o veículo.',
        '<b>Verificar telemetria</b>: com o veículo ligado, aguardar pontos e confirmar no Mapa que '
        'o marcador aparece verde (Actualizado).',
        '<b>Documentos</b> (Frota — Documentos): seguro, inspecção, licenças e autorizações '
        'transfronteiriças com validades reais; marcar Bloqueante onde a política exigir.',
        '<b>Checklist template</b>: confirmar que o template activo contém os 3 itens sistémicos '
        '(carregador, suporte, rastreador) e os itens da frota (pneus, travões, luzes, combustível, '
        'documentos a bordo, extintor, telemóvel carregado).',
        '<b>Taxas de câmbio</b> (Financeiro — Taxas de câmbio): registar USD, ZAR, ZWG e as demais '
        'moedas do corredor, com nota da fonte e data.',
        '<b>Per diem</b> (Financeiro — Per diem): taxas diárias por país do corredor.',
        '<b>Planos preventivos</b> (Manutenção — Planos): óleo, filtros, travões por veículo, com '
        'intervalos e alertas antecipados.',
        '<b>Cercas geográficas</b> (Configuração — Cercas): Porto da Beira, Base, postos, fronteiras '
        'e clientes habituais com raios realistas.',
        '<b>Parâmetros</b> (Configuração — Parâmetros): rever os 6 parâmetros (Cap. 12.2) e ajustar '
        'à realidade da operação.',
        '<b>Primeira viagem piloto</b>: planear uma viagem curta (ex. Beira-Inchope), percorrer o '
        'ciclo completo (checklist, partida, chegada, despesas, fecho) e validar cada ecrã.',
    ])

    h2(story, '13.2 Regras para os primeiros dias')
    bullets(story, [
        'Registar odómetros reais na partida e chegada — são a base do consumo e da auditoria.',
        'Recolher o talão de TODA a despesa exigente (combustível, portagens, alfândega); '
        'se impossível, justificar no campo próprio e aguardar revisão.',
        'Registar a taxa de câmbio ANTES de autorizar viagens em moeda estrangeira.',
        'Tratar os alertas abertos todos os dias: reconhecer (ACK) o que está em seguimento e '
        'encerrar com motivo o que foi resolvido.',
        'Encerrar a semana com a reconciliação das viagens chegadas (adiantamentos vs despesas '
        'aprovadas) e os fechos pendentes.',
    ])
    PAUSE(story)


def cap14(story):
    h1(story, 'Capítulo 14 — Migração para a nuvem (GitHub + Supabase + Vercel)')
    p(story, 'Conforme acordado, a colocação online segue o modelo '
             'profissional: código no GitHub, base de dados PostgreSQL '
             'gerida no Supabase e aplicação publicada na Vercel. Este '
             'capítulo define o que cabe a cada parte e os passos exactos, '
             'para que a migração seja curta e segura.', 'lead')

    h2(story, '14.1 O que o Sr. cria (do seu lado)')
    tabela(story, [
        ['Serviço', 'O que criar', 'O que partilhar comigo'],
        ['GitHub', 'Repositório privado (ex. sigfco)', 'URL da repo + token com permissão de push (Contents: Read/Write)'],
        ['Supabase', 'Projecto novo (região mais próxima: Europa funciona bem para MZ)', 'URL do projecto + chave anon + service_role + palavra-passe da base'],
        ['Vercel', 'Conta/equipa', 'Token de deploy + nome do projecto (ou convite para a equipa)'],
    ], [0.16, 0.42, 0.42], caption='Tabela 14.1 — Divisão de tarefas do lado do cliente')
    alerta(story, 'Trate os tokens como senhas: serão usados UMA vez, '
                  'guardados apenas como variáveis de ambiente do servidor de '
                  'build e nunca escritos no código nem em ficheiros do '
                  'repositório. Após a migração, recomenda-se revogar e '
                  'regenerar os tokens por rotina de segurança.', 'Segurança dos tokens')

    h2(story, '14.2 O que eu executo (do lado técnico)')
    numerada(story, [
        'Auditoria final do código: lint, testes de regras (20/20) e verificação de segredos no repositório.',
        'Push inicial para a repo GitHub (branch main) com README de operação.',
        'Conversão da base: schema Prisma para PostgreSQL (Supabase) e migração de estrutura com prisma migrate.',
        'Configuração das variáveis de ambiente na Vercel (DATABASE_URL do Supabase, ambiente de produção).',
        'Primeiro deploy na Vercel + teste de fumo (login, criar viagem, despesa, mapa).',
        'Activação do ambiente DEMO na nuvem para formação, com dados fictícios marcados.',
        'Entrega do domínio/URL de produção e do checklist de verificação final.',
    ])

    h2(story, '14.3 O que muda (e o que não muda)')
    bullets(story, [
        '<b>Muda</b>: a base de dados passa de SQLite local a PostgreSQL gerido (backups diários '
        'automáticos do Supabase); o acesso passa a ser por HTTPS público; os uploads privados '
        'passam a considerar o armazenamento persistente do ambiente.',
        '<b>Não muda</b>: regras de negócio, perfis, estados, numeração, auditoria — o código é o mesmo.',
        '<b>Nota GPS</b>: os rastreadores passam a enviar para o endpoint público '
        'https://(domínio)/api/gps/ingest com a mesma apiKey por dispositivo; a rotação de chave '
        'continua disponível no ecrã.',
        '<b>Mapa offline</b>: continua dependente de fornecedor licenciado (ARC-004); na nuvem, '
        'o mapa usa tiles OpenStreetMap online como hoje.',
    ])
    p(story, 'Custos e limites: o plano gratuito do Supabase serve a fase de '
             'arranque (com pausa por inactividade); a Vercel gratuita '
             'acoberta o uso inicial. Quando a operação crescer, a '
             'recomendação é migrar para planos pagos ANTES de sentir '
             'limites — os dois serviços permitem upgrade sem '
             'reimplementação.')
    PAUSE(story)


def cap15(story):
    h1(story, 'Capítulo 15 — Resolução de problemas e bugs conhecidos')

    h2(story, '15.1 Comportamentos actuais declarados (sem simulação)')
    p(story, 'Estes comportamentos são conhecidos e assumidos na versão 1.0. '
             'Não são erros ocultos: estão no código, foram verificados e '
             'farão parte da fila de correcções 1 a 1 acordada.')
    tabela(story, [
        ['N', 'Comportamento actual', 'Impacto', 'Plano'],
        ['1', 'Eventos recusados em viagens fechadas/canceladas mesmo para o sistema', 'Baixo', 'Avaliar excepção formal em correcção'],
        ['2', 'Alertas antecipados de plano preventivo (MNT-002) ainda não computados na rota de manutenção', 'Médio', 'Implementar cálculo na fila de alertas'],
        ['3', 'Gestor de filial não aparece na lista interna de libertação de OS crítica', 'Baixo', 'Incluir GF na lista interna'],
        ['4', 'Financeiro, auditor e mecânico não podem carregar anexos', 'Baixo (por desenho de permissões)', 'Confirmar política com o proprietário'],
        ['5', 'Leitura de ficheiros e notificações exige apenas sessão (sem permissão extra)', 'Baixo', 'Restringir a perfis relevantes'],
        ['6', 'Sementeira DEMO e documentação do ingest são rotas públicas (com rate limit)', 'Baixo', 'Restringir seed em produção'],
        ['7', 'Código de despesa no sync offline gerado em linha (mesmo formato final)', 'Nenhum funcional', 'Unificar pelo gerador central'],
        ['8', 'Modelo Incident ainda sem campo code (INC-...)', 'Baixo', 'Adicionar campo + retroactivo'],
        ['9', 'Alerta DOC_EXPIRED deduplicado por alerta aberto idêntico', 'Desejado', 'Manter'],
        ['10', 'Exportações CSV com BOM UTF-8 e separador ;', 'Desejado (Excel PT)', 'Manter'],
    ], [0.05, 0.47, 0.20, 0.28], centro=[0],
        caption='Tabela 15.1 — Fila inicial de conhecimento técnico (base para as correcções 1 a 1)')

    h2(story, '15.2 Limitações declaradas (pendentes de recursos externos)')
    bullets(story, [
        '<b>Homologação GPS</b> (ARC-005): adaptadores Teltonika/Queclink ficam prontos após teste '
        'com equipamento real; até lá, o generic-json cobre integrações.',
        '<b>Notificações EMAIL/SMS</b>: canais previstos no modelo, envio real pendente de '
        'fornecedor (ex.: provedor de SMS moçambicano).',
        '<b>Câmbio automático</b> (FIN-003): fonte API só activa após credenciais e teste; '
        'enquanto isso, registo manual auditado.',
        '<b>Mapa offline</b> (ARC-004): exige fornecedor de cartografia licenciado; hoje o mapa '
        'funciona com internet.',
        '<b>Restauro formal (AT-020)</b> e <b>dispositivos reais (AT-025)</b>: ensaios de restauro '
        'de backup e piloto com rastreadores físicos ficam para a fase pós-migração.',
    ])

    h2(story, '15.3 Como reportar um bug com conhecimento de causa')
    p(story, 'Com este manual em mão, cada reporte pode já vir com o '
             'diagnóstico técnico. Formato acordado (1 bug de cada vez, sem '
             'atacar todos de uma vez):')
    numerada(story, [
        '<b>O que estava a fazer</b> — ecrã e acção exacta (ex.: “Viagens — Fechar com excepção”).',
        '<b>O que esperava</b> — o comportamento segundo este manual (cite o capítulo/regra se souber).',
        '<b>O que aconteceu</b> — mensagem exacta do erro (copiar o texto vermelho do ecrã).',
        '<b>Identificadores</b> — código da viagem (VIA-...), despesa (DESP-...) ou OS, e a hora aproximada.',
        '<b>Perfil usado</b> — ex. financeiro ou motorista, e dispositivo (escritório/telemóvel).',
        '<b>Captura de ecrã</b> — se possível, incluindo a mensagem de erro.',
    ])
    p(story, 'Com estes seis pontos, a maioria dos casos é reproduzível em '
             'minutos no ambiente de teste e a correcção entra no ciclo 1 a '
             '1: um bug por commit, com verificação no ambiente real antes '
             'de fechar. Os códigos de estado HTTP ajudam o diagnóstico: '
             '400 dado inválido, 401 sessão expirada, 403 sem permissão, '
             '404 não existe/outra empresa, 409 conflito de estado, 413 '
             'demasiado grande, 429 ritmo excedido.')
    PAUSE(story)


def anexo_a(story):
    h1(story, 'Anexo A — Referência dos endpoints da API')
    p(story, 'Lista completa das rotas do servidor (prefixo /api/). Perfis: '
             'PA = Admin de plataforma, CA = Admin de empresa, GM = Gestor de '
             'frota, DP = Despachante, FIN = Financeiro, MOT = Motorista, '
             'MEC = Mecânico, AUD = Auditor, GF = Gestor de filial. Todas '
             'exigem sessão excepto onde indicado. Erros sempre no formato '
             '{"error": "mensagem"}.')
    tabela(story, [
        ['Método e caminho', 'Função', 'Quem pode'],
        ['POST /api/auth/login', 'Login (action: login) e Logout (action: logout); ritmo 10/min', 'Público / autenticado'],
        ['GET /api/auth/me', 'Perfil corrente + empresa + não lidas (sondagem 60 s)', 'Autenticado'],
        ['GET/POST /api/auth/sessions', 'Listar / revogar sessões (REVOKE_SESSIONS auditado)', 'Próprio; CA/PA para outros'],
        ['GET/POST/PATCH /api/users', 'Listar, criar e editar utilizadores', 'user.read / user.manage'],
        ['GET/PATCH/POST /api/company', 'Ficha da empresa, parâmetros, criar/editar filial', 'company.read / company.manage'],
        ['GET/POST/PATCH /api/vehicles', 'Frota de veículos; odómetro justificado (FR-015)', 'fleet.read / fleet.manage'],
        ['GET/POST/PATCH /api/drivers', 'Motoristas com elegibilidade calculada', 'fleet.read / fleet.manage'],
        ['GET/POST/PATCH /api/trailers', 'Reboques', 'fleet.read / fleet.manage'],
        ['GET/POST /api/tires', 'Pneus e movimentos (action: event)', 'maintenance.manage para escrita'],
        ['GET/POST /api/trips', 'Listar / criar viagens (DRAFT ou PLANNED com validações)', 'trip.read | trip.own | trip.manage'],
        ['GET /api/trips/{id}', 'Detalhe: despesas, ocorrências, orçamento, GPS, POD', 'trip.read | trip.own'],
        ['POST /api/trips/{id}/actions', 'plan, send_to_checklist, authorize, depart, pause, resume, arrive, request_close, close, reopen, cancel', 'trip.manage (+ regras internas)'],
        ['GET/POST /api/trips/{id}/checklist', 'Consultar / submeter checklist (carregador crítico)', 'checklist.submit | trip.manage'],
        ['GET/POST /api/trips/{id}/events', 'Eventos de viagem (idempotentes por clientUuid)', 'trip.read | trip.own | trip.manage'],
        ['GET/POST /api/expenses', 'Fila de despesas / submissão com todas as regras FIN', 'expense.read | expense.own | expense.submit'],
        ['POST /api/expenses/{id}/actions', 'approve, reject, return, review, void, clear-duplicate-flag', 'expense.approve (FIN/CA/PA)'],
        ['GET/POST /api/advances', 'Adiantamentos e liquidação', 'finance.read / finance.manage'],
        ['GET/POST/PATCH /api/perdiem-rules', 'Regras de per diem + cálculo (action: calculate)', 'finance.read / finance.manage'],
        ['GET/POST /api/exchange-rates', 'Taxas de câmbio (RATE_CHANGE auditado)', 'finance.read / finance.manage'],
        ['GET/POST/PATCH /api/maintenance', 'OS, planos (create-plan), libertação (release)', 'maintenance.read / maintenance.manage'],
        ['GET/POST /api/fuel', 'Abastecimentos com anomalias sinalizadas', 'fuel.read | fuel.manage | expense.submit'],
        ['GET/POST /api/incidents', 'Ocorrências (idempotentes por clientUuid)', 'trip.read | trip.own | trip.manage'],
        ['GET/POST /api/documents', 'Documentos e vencimentos (filtros expiring/expired)', 'fleet.read | doc.manage'],
        ['POST /api/attachments', 'Upload privado (base64, máx. 12 MB, SHA-256)', 'Motorista, DP, GM, GF, CA, PA'],
        ['GET /api/files/{id}', 'Descarregamento autorizado com verificação de integridade', 'Autenticado (isolamento por empresa)'],
        ['GET/POST/PATCH /api/gps/devices', 'Registar, associar, rodar chave (rotate-key), desactivar', 'gps.view / gps.manage'],
        ['GET /api/gps/fleet', 'Mapa da frota com frescura inequívoca', 'gps.view'],
        ['GET /api/gps/points', 'Histórico paginado de pontos (50-2000)', 'gps.view'],
        ['GET/POST/PATCH /api/gps/geofences', 'Cercas geográficas', 'gps.view / gps.manage'],
        ['POST /api/gps/ingest', 'Ingestão store-and-forward (Bearer apiKey, máx. 2000 pontos)', 'Dispositivo (sem sessão)'],
        ['GET /api/gps/ingest', 'Documentação viva do contrato de ingestão', 'Público'],
        ['GET/PATCH /api/alerts', 'Fila de alertas; ack e close (motivo em graves)', 'alert.handle'],
        ['GET/PATCH /api/notifications', 'Inbox in-app; marcar lida (individual ou tudo)', 'Autenticado'],
        ['GET /api/audit', 'Trilha de auditoria paginada (50/página; consulta auditada)', 'audit.read (FIN/CA/PA/AUD)'],
        ['GET /api/reports/dashboard', 'Indicadores do painel (SRS 15.1/15.3)', 'report.read | trip.read'],
        ['GET /api/reports/export', 'CSV auditado: expenses, fuel, trips, documents', 'report.export (+ financeira p/ despesas)'],
        ['GET/POST /api/sync', 'Sincronização offline item a item (máx. 100/lote; 60/min)', 'Autenticado (motorista em campo)'],
        ['GET/POST /api/demo', 'Estado e sementeira DEMO; simulador-tick; ritmo 3/5 min', 'Público (ambiente demo)'],
        ['GET /api', 'Rota de saúde (“Hello, world!”)', 'Público'],
    ], [0.30, 0.47, 0.23], caption='Tabela A.1 — 39 rotas do servidor com função e acesso')
    PAUSE(story)


def anexo_b(story):
    h1(story, 'Anexo B — Modelos de dados (Prisma)')
    p(story, '34 modelos na base de dados. Estados são gravados como texto '
             'controlado por constantes tipadas (SQLite não suporta enums); '
             'campos estruturados (itens de checklist, waypoints, flags) '
             'ficam em JSON serializado.')
    tabela(story, [
        ['Modelo', 'Objectivo'],
        ['Company / Branch / Setting', 'Empresa (moeda-base, fuso, isDemo), filiais e parâmetros por empresa'],
        ['User / Session', 'Utilizadores (perfil, ligação a motorista) e sessões revogáveis (hash do token)'],
        ['Driver / Vehicle / Trailer', 'Motoristas (carta, elegibilidade), veículos (odómetro, estado calculado) e reboques'],
        ['GpsDevice / DeviceAssignment', 'Rastreadores (apiKey, protocolo, lastPointAt) e histórico de associação'],
        ['GpsPoint / Geofence', 'Pontos de telemetria (únicos por deviceId+seq; fonte; isHistoric) e cercas'],
        ['Trip / TripBudgetLine / TripEvent', 'Viagens (10 estados, rota aprovada, POD), orçamento por rubrica e eventos'],
        ['ChecklistTemplate / ChecklistRun', 'Template com itens bloqueantes e instância por viagem'],
        ['Expense / Attachment', 'Despesas (valor original + conversão + sinais) e anexos privados (SHA-256)'],
        ['Advance / PerDiemRule / ExchangeRate', 'Adiantamentos, regras de per diem e taxas de câmbio (histórico)'],
        ['MaintenancePlan / WorkOrder', 'Planos preventivos e ordens de serviço (crítica + blocksVehicle + prova de libertação)'],
        ['Tire / TireEvent', 'Pneus (série, estado, posição) e movimentos'],
        ['FuelLog / Incident', 'Abastecimentos (flags de anomalia) e ocorrências (6 tipos)'],
        ['Alert / Notification', 'Alertas (14 tipos, severidades, OPEN/ACK/CLOSED) e notificações in-app'],
        ['AuditLog / SyncRecord / Counter', 'Auditoria (antes/depois), fila/ACK offline e contadores de numeração'],
    ], [0.34, 0.66], caption='Tabela B.1 — 34 modelos agrupados por domínio')
    PAUSE(story)


def anexo_c(story):
    h1(story, 'Anexo C — Glossário de estados e constantes')
    tabela(story, [
        ['Família', 'Valores (código — rótulo no ecrã)'],
        ['Viagem', 'DRAFT Rascunho; PLANNED Planeada; AWAITING_CHECKLIST A aguardar checklist; '
         'AUTHORIZED_DEPARTURE Autorizada para partida; IN_TRANSIT Em trânsito; PAUSED Em pausa / retida; '
         'ARRIVED Chegada registada; AWAITING_RECONCILIATION A aguardar reconciliação; CLOSED Fechada; '
         'CANCELLED Cancelada'],
        ['Veículo', 'AVAILABLE Disponível; RESERVED Reservado; IN_TRANSIT Em trânsito; MAINTENANCE Manutenção; '
         'INACTIVE Inactivo; BLOCKED Bloqueado por segurança'],
        ['Despesa', 'SUBMITTED Submetida; IN_REVIEW Em revisão; APPROVED Aprovada; REJECTED Rejeitada; '
         'RETURNED Devolvida; RECONCILED Reconciliada; VOID Anulada'],
        ['Alerta — severidade', 'CRITICAL Crítico; HIGH Alto; MEDIUM Médio; INFO Informativo'],
        ['Alerta — estado', 'OPEN Aberto; ACK Reconhecido; CLOSED Encerrado'],
        ['GPS — fonte', 'TRACKER Rastreador dedicado; MOBILE Telemóvel (secundária); SIMULATOR Simulador DEMO'],
        ['GPS — frescura', 'LIVE Actualizado; DELAYED Atrasado; NO_COMMUNICATION Sem comunicação; HISTORIC Histórico'],
        ['GPS — dispositivo', 'OPERATIONAL; NO_NETWORK (a guardar localmente); NO_POWER; TAMPER_ALERT; OFFLINE; INACTIVE'],
        ['Motorista', 'ACTIVE Activo; INACTIVE Inactivo; SUSPENDED Suspenso; ON_TRIP Em viagem'],
        ['Documento', 'VALID Válido; EXPIRING A expirar (30 d); EXPIRED Expirado'],
        ['Pneu', 'IN_STOCK Em stock; INSTALLED Instalado; REPAIR Em reparação; RETIRED Reformado'],
        ['Ocorrência', 'ACIDENTE; AVARIA; RETENCAO; ROUBO; PERDA_CARGA; OUTRO'],
        ['Moedas', 'MZN (base); USD; ZAR; ZWG; MWK; ZMW; CDF'],
        ['Sincronização (servidor)', 'RECEIVED Recebido; PROCESSED Processado; ERROR Erro'],
        ['Fila local (telemóvel)', 'GUARDADO; A_ENVIAR; SINCRONIZADO; ERRO'],
        ['Numeração', 'VIA-AAAA-NNNNN viagem; DESP-AAAA-NNNNN despesa; OS-AAAA-NNNNN ordem de serviço; '
         'MTR-XXXX motorista'],
    ], [0.22, 0.78], caption='Tabela C.1 — Glossário completo de estados e constantes')
    p(story, 'Fim do manual. Este documento acompanha a versão 1.0 do SIGFCO '
             'e será actualizado a cada ciclo de correcções acordado, de '
             'modo a que a documentação e o sistema avancem sempre juntos.')
