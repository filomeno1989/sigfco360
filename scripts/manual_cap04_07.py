# -*- coding: utf-8 -*-
"""SIGFCO Manual - Capítulos 4 a 7."""
from manual_base import (S, bullets, caixa, codigo, h1, h2, h3, numerada,
                         p, tabela, alerta, PAUSE)
from reportlab.platypus import Spacer, Paragraph


def cap4(story):
    h1(story, 'Capítulo 4 — Painel e Mapa da frota')

    h2(story, '4.1 Painel (ecrã inicial do escritório)')
    p(story, 'O Painel cumprimenta com “Bom dia, {primeiro nome}” e mostra o '
             'resumo operacional da empresa. Actualiza-se sozinho a cada 45 '
             'segundos e o botão “Actualizar” refresca de imediato. São 8 '
             'cartões de indicadores (KPI) seguidos de três painéis: viagens '
             'activas, acesso rápido e qualidade dos indicadores.')
    tabela(story, [
        ['Indicador', 'Significado', 'Cor de aviso'],
        ['Frota disponível', 'Disponíveis / total; detalhe em trânsito, manutenção e bloqueados', 'Âmbar se houver bloqueados'],
        ['Viagens activas', 'Viagens em curso agora; detalhe “n motoristas activos”', 'Neutro'],
        ['Telemetria GPS', 'Pontos actuais; detalhe atrasados, sem comunicação e sem energia', 'Âmbar se houver sem comunicação'],
        ['Alertas abertos', 'Soma de críticos + altos + médios; detalhe por severidade', 'Vermelho se houver críticos'],
        ['Despesas aprovadas (30 d)', 'Total aprovado em moeda-base no último mês', 'Neutro'],
        ['Despesas pendentes (30 d)', 'Submetidas + em revisão; NÃO somam as aprovadas (SRS 15.3)', 'Âmbar'],
        ['Documentos a expirar (30 d)', 'Vencimentos no próximo mês; detalhe de bloqueantes já expirados', 'Vermelho se houver bloqueantes expirados'],
        ['Manutenção em aberto', 'Ordens de serviço activas', 'Neutro'],
    ], [0.26, 0.54, 0.20], caption='Tabela 4.1 — Os 8 indicadores do Painel')
    p(story, 'O painel “Viagens activas” lista as últimas viagens por partida '
             'com código, estado, rota, veículo e motorista; clicar abre o '
             'detalhe em Viagens. O painel “Acesso rápido” tem 4 botões: '
             '“Planear viagem”, “Ver mapa da frota”, “Fila de despesas” e '
             '“Documentos”. Por fim, o painel “Qualidade dos indicadores” '
             'declara, em texto visível, as quatro regras de honestidade '
             'estatística do sistema: despesas pendentes não somam às '
             'aprovadas; tempo sem telemetria não é contado como veículo '
             'parado; o consumo é indicado como estimado quando o método é '
             'estimado; e mostra quantos registos de sincronização offline '
             'aguardam processamento.')

    h2(story, '4.2 Mapa da frota')
    p(story, 'O mapa usa Leaflet com cartografia OpenStreetMap (atribuição '
             '“© OpenStreetMap” visível) e actualiza a cada 30 segundos. '
             'O subtítulo declara a promessa central: “Último ponto conhecido '
             'com frescura inequívoca — telemetria antiga nunca é apresentada '
             'como tempo real (GPS-012)”. O centro inicial é a primeira '
             'posição conhecida ou o centro de Moçambique (-19,2; 33,6), com '
             'zoom inicial 7.')
    p(story, 'Cada veículo aparece como um marcador circular cuja cor é a '
             'frescura do último ponto, e cuja forma indica a fonte: '
             'triângulo para rastreador dedicado (TRACKER), quadrado para o '
             'simulador DEMO (SIMULATOR). Ao clicar num marcador ou num '
             'cartão da lista lateral, abre-se o trajecto das últimas 24 h '
             'com até 120 pontos em tabela (Hora GNSS, velocidade, fonte e '
             'estado “em curso”/“histórico”).')
    tabela(story, [
        ['Frescura', 'Cor', 'Significado'],
        ['Actualizado (LIVE)', 'Verde', 'Ponto com menos de gps_delayed_minutes (5 min)'],
        ['Atrasado (DELAYED)', 'Âmbar', 'Ponto entre 5 e 20 min; pode haver falha temporária de rede'],
        ['Sem comunicação (NO_COMMUNICATION)', 'Vermelho', 'Mais de gps_stale_minutes (20 min) sem pontos'],
        ['Histórico (HISTORIC)', 'Cinza', 'Ponto antigo recebido atrasado (store-and-forward)'],
    ], [0.34, 0.14, 0.52], caption='Tabela 4.2 — Os 4 estados de frescura (GPS-012) e cores no mapa')
    p(story, 'As cercas geográficas activas aparecem como círculos: vermelho '
             'para zonas restritas, azul-acento para os restantes tipos '
             '(base, porto, cliente, posto, portagem, fronteira, descanso). '
             'Entradas e saídas de cercas geram alertas informativos '
             '(GPS-022). Em ambiente DEMO existe o botão “Gerar ponto DEMO” '
             'que avança o camião simulado no corredor Beira-Harare; quando '
             'simula perda de rede, o ponto chega atrasado com a hora '
             'original do dispositivo — exactamente como um rastreador real '
             'em store-and-forward.')

    h2(story, '4.3 Regras de honestidade do mapa')
    bullets(story, [
        'Sem dados recentes NÃO significa veículo parado, desligado ou avariado (GPS-027).',
        '“Sem comunicação” é distinto de “sem alimentação” — o estado do dispositivo '
        '(NO_POWER, TAMPER_ALERT) vê-se na ficha do rastreador.',
        'As linhas tracejadas são ligações visuais entre pontos, não telemetria observada.',
        'A hora apresentada é sempre a hora GNSS original do dispositivo, mesmo quando o '
        'ponto chega atrasado (NFR-012).',
        'Não existe ETA garantida: sem fonte de tráfego fiável, a estimativa é aproximada.',
    ])
    PAUSE(story)


def cap5(story):
    h1(story, 'Capítulo 5 — Viagens: ciclo de vida completo')

    h2(story, '5.1 Os 10 estados e as transições permitidas')
    p(story, 'A viagem é o coração do SIGFCO. O servidor valida cada '
             'transição de estado; uma transição ilegal devolve erro 409 com '
             'a mensagem “Transição X para Y não permitida”. Os estados '
             'activos (que ocupam veículo e motorista) são os 7 intermédios, '
             'de Planeada a A aguardar reconciliação.')
    tabela(story, [
        ['Estado (código)', 'Rótulo no ecrã', 'Transições permitidas'],
        ['DRAFT', 'Rascunho', 'Planeada; Cancelada'],
        ['PLANNED', 'Planeada', 'A aguardar checklist; Cancelada'],
        ['AWAITING_CHECKLIST', 'A aguardar checklist', 'Autorizada para partida; Cancelada; volta a Planeada'],
        ['AUTHORIZED_DEPARTURE', 'Autorizada para partida', 'Em trânsito; Cancelada'],
        ['IN_TRANSIT', 'Em trânsito', 'Em pausa; Chegada registada'],
        ['PAUSED', 'Em pausa / retida', 'Em trânsito; Chegada registada'],
        ['ARRIVED', 'Chegada registada', 'A aguardar reconciliação'],
        ['AWAITING_RECONCILIATION', 'A aguardar reconciliação', 'Fechada'],
        ['CLOSED', 'Fechada', 'Reabertura autorizada (para reconciliação)'],
        ['CANCELLED', 'Cancelada', 'Terminal (só reabertura financeira autorizada)'],
    ], [0.30, 0.26, 0.44], caption='Tabela 5.1 — Estados da viagem e transições validadas no servidor')

    h2(story, '5.2 Criar uma viagem, passo a passo')
    numerada(story, [
        'No ecrã “Viagens”, premir “Nova viagem” (botão escondido a motoristas).',
        'Preencher: Cliente/Expedidor, Referência da carga, Origem (pré-preenchida '
        '“Porto da Beira”), Destino, Motorista, Veículo, Reboque (opcional), '
        'Carga/descrição, Início previsto (obrigatório), Fim previsto e Distância estimada.',
        'Opcionalmente adicionar Orçamento por rubrica (FR-033/034): categoria '
        '(Combustível, Portagens, Per diem, Alfândega, Taxas, Manutenção de emergência, '
        'Comunicações, Estacionamento, Outros) + moeda + limite.',
        'Escolher “Guardar rascunho” (aceita sempre; devolve avisos de bloqueadores) '
        'ou “Validar e planear” (executa todas as verificações antes de confirmar).',
        'Se houver bloqueios, o ecrã mostra “Bloqueios detectados:” com a lista exacta; '
        'corrigir e voltar a validar.',
    ])
    p(story, 'Os selectores de motorista e veículo já marcam os problemáticos '
             'com “INELEGÍVEL” e “SEM RASTREADOR”, mas a decisão final é '
             'sempre do servidor (FR-032): é ele quem recusa o planeamento '
             'com a lista de bloqueadores ou erro 409 de conflito.')

    h2(story, '5.3 Bloqueadores de elegibilidade e conflitos')
    tabela(story, [
        ['Bloqueador (verificado no servidor)', 'Efeito'],
        ['Motorista inexistente / de outra empresa', 'Planeamento recusado'],
        ['Motorista INACTIVE ou SUSPENDED', 'Planeamento recusado (FR-021)'],
        ['Carta de condução do motorista expirada', 'Planeamento recusado'],
        ['Veículo inexistente / de outra empresa', 'Planeamento recusado'],
        ['Veículo em MAINTENANCE ou BLOCKED', 'Planeamento recusado'],
        ['Documento bloqueante expirado (veículo ou motorista)', 'Planeamento recusado (DOC-002, AT-017)'],
        ['Veículo sem rastreador GPS dedicado operacional', 'Planeamento recusado — fonte primária obrigatória (GPS-001)'],
        ['Ordem de serviço crítica em aberto no veículo', 'Planeamento recusado até libertação com prova (MNT-004)'],
    ], [0.58, 0.42], caption='Tabela 5.2 — Bloqueadores de elegibilidade (validados em “Validar e planear”)')
    p(story, 'Para além da elegibilidade individual, o sistema verifica '
             'conflitos de recursos (AT-016): o veículo OU o motorista já '
             'afectos a outra viagem activa com sobreposição de períodos '
             'recusam o planeamento com 409 e a indicação da viagem '
             'conflituante. Os estados considerados activos para conflito '
             'são os sete intermédios da Tabela 5.1.')

    h2(story, '5.4 Checklist pré-partida: o portão de segurança')
    p(story, 'Ao enviar a viagem planeada para checklist (“Enviar para '
             'checklist pré-partida”), o servidor instancia um ChecklistRun '
             'a partir do template activo da empresa. Sem template activo, a '
             'acção é recusada com explicação (FR-043). O motorista (ou o '
             'escritório) responde a cada item com Sim/Não e nota opcional; '
             'o botão “Submeter checklist” só activa depois de todos os '
             'itens terem resposta.')
    caixa(story, 'Três itens são sistémicos, bloqueantes e não removíveis — o '
                 'servidor repõe-os se faltarem: “Carregador de telemóvel '
                 'funcional e acessível (12/24V, USB compatível)” (REQUISITO '
                 'CRÍTICO), “Suporte seguro de telemóvel montado” e '
                 '“Rastreador GPS associado e operacional”. Qualquer item '
                 'bloqueante respondido Não deixa a checklist em estado '
                 'BLOQUEADA com a lista de razões. Não existe botão de '
                 '“continuar mesmo assim” — sem bypass (FR-044, AT-003).',
          'Regra crítica: o carregador obriga')
    p(story, 'A checklist aprovada (estado APROVADA) é condição obrigatória '
             'para o botão “Autorizar partida”: enquanto pendente, o botão '
             'aparece desactivado com a explicação “A autorização exige '
             'checklist aprovada (FR-035) — sem bypass (FR-044)”. Em caso de '
             'falha, corrige-se o item fisicamente e submete-se de novo; a '
             'excepção a um requisito de segurança exige procedimento formal '
             'fora da aplicação.')

    h2(story, '5.5 Partida, pausa e chegada')
    bullets(story, [
        '<b>Autorizar partida</b> — acção do escritório (ou despachante) com checklist aprovada e sem bloqueadores.',
        '<b>Registar partida</b> — o odómetro de partida é OBRIGATÓRIO e tem de ser maior ou igual ao odómetro '
        'actual do veículo (FR-015); a acção é transaccional: actualiza viagem, cria evento DEPARTURE, '
        'actualiza o odómetro do veículo e recalcula o estado dele.',
        '<b>Registar pausa</b> — motivo obrigatório (SRS 5.1); cria evento PAUSE_START e o estado passa a “Em pausa / retida”.',
        '<b>Retomar trânsito</b> — cria PAUSE_END e volta a “Em trânsito”.',
        '<b>Confirmar chegada</b> — odómetro de chegada (opcional no ecrã, obrigatório para fechar) e tem de ser '
        'maior ou igual ao de partida; cria evento ARRIVAL.',
    ])
    p(story, 'Regressão ou salto de odómetro superior a 5000 km na ficha do '
             'veículo exigem justificação (odoReason) que fica registada no '
             'motivo do estado e na auditoria — protecção contra erros de '
             'digitação e manipulação (FR-015).')

    h2(story, '5.6 Fecho, reconciliação e reabertura')
    p(story, 'Com a chegada registada, o escritório prima “Solicitar fecho / '
             'reconciliação”: o sistema calcula as pendências críticas e '
             'mostra a caixa âmbar “Pendências detectadas:”. São pendências '
             'críticas: quilometragem final em falta, despesas da viagem '
             'ainda pendentes de decisão e, quando configurado, POD (prova '
             'de entrega) não anexado (AT-023). Depois:')
    bullets(story, [
        '<b>Fechar viagem</b> — só conclui sem pendências críticas; o fecho é auditado e marca as despesas '
        'aprovadas como RECONCILIADA.',
        '<b>Fechar com excepção</b> — com pendências, apenas FINANCEIRO/ADMINISTRAÇÃO pode fechar com motivo '
        'auditado (force:true); outras tentativas recebem 403.',
        '<b>Reabrir</b> — de Fechada para “A aguardar reconciliação”, somente financeiro/administração e '
        'com motivo obrigatório que fica na auditoria.',
        '<b>Cancelar viagem</b> — possível em qualquer estado não terminal com motivo obrigatório '
        '(grava cancelReason).',
    ])

    h2(story, '5.7 Orçamento versus realizado')
    p(story, 'No detalhe da viagem, o painel “Orçamento vs realizado (FIN-010)” '
             'apresenta três valores por rubrica — Limite, Pendente (âmbar) e '
             'Aprovado (verde) — com barra de progresso: vermelha a 100% ou '
             'mais, âmbar a partir de 80% (parâmetro budget_alert_pct), '
             'verde abaixo. Pendentes e aprovados aparecem SEMPRE separados '
             '(SRS 15.3): a direcção vê o comprometido sem o confundir com o '
             'gasto. Ultrapassagens geram alertas HIGH tipo BUDGET_EXCEEDED.')

    h2(story, '5.8 Eventos de viagem e SOS')
    p(story, 'Ao longo da viagem registam-se eventos com hora do dispositivo. '
             'Cada evento tem um clientUuid; reenviar o mesmo UUID devolve o '
             'evento existente em vez de duplicar (idempotência OFF-003). Em '
             'viagens fechadas ou canceladas, novos eventos são recusados '
             '(exige reabertura autorizada).')
    tabela(story, [
        ['Grupo', 'Tipos de evento'],
        ['Marcos', 'DEPARTURE (partida), ARRIVAL (chegada), CHECKPOINT, BORDER (fronteira)'],
        ['Paragens', 'PAUSE_START, PAUSE_END, DELAY (atraso)'],
        ['Rota', 'DEVIATION (desvio), DRIVER_CHANGE (mudança de motorista), VEHICLE_CHANGE'],
        ['Carga', 'LOAD (carregamento), UNLOAD (descarregamento)'],
        ['Emergência', 'SOS — gera alerta CRÍTICO tipo SOS e notifica o escritório (GPS-026)'],
        ['Outros', 'OTHER — qualquer outro acontecimento relevante'],
    ], [0.18, 0.82], caption='Tabela 5.3 — Os 14 tipos de evento de viagem')
    PAUSE(story)


def cap6(story):
    h1(story, 'Capítulo 6 — Frota: veículos, motoristas, reboques, GPS e documentos')
    p(story, 'O ecrã “Frota” tem 5 separadores: Veículos, Motoristas, '
             'Reboques, Rastreadores GPS e Documentos. O menu “Documentos” '
             'abre directamente este último separador; o menu “Combustível” '
             'abre a vista de Manutenção no separador Combustível. Os botões '
             'de criação exigem permissão de gestão de frota (admin, gestor '
             'de frota ou gestor de filial).')

    h2(story, '6.1 Veículos')
    p(story, 'A lista mostra Matrícula, Marca/Modelo, Tipo, Odómetro, '
             'Rastreador (badge com série; verde se OPERATIONAL) e Estado '
             'com o motivo calculado. A matrícula é normalizada (maiúsculas, '
             'sem espaços nem travessões — ex.: AAH123MZ) e única na empresa '
             '(FR-010). No registo preenchem-se ainda: Modelo, Ano, VIN/Chassis, '
             'Capacidade do tanque (L), Consumo de referência (L/100km — usado '
             'na comparação esperado vs real, FUEL-002), Odómetro actual e '
             'Capacidade de carga (kg).')
    p(story, 'O estado do veículo não se escolhe: calcula-se a partir de '
             'eventos (FR-014) com esta prioridade: 1) viagem em trânsito ou '
             'em pausa = “Em trânsito”; 2) ordem de serviço crítica em aberto '
             '= “Bloqueado por segurança”; 3) viagem activa ou planeada = '
             '“Reservado”; 4) qualquer OS em aberto = “Manutenção”; 5) '
             'documento bloqueante expirado = “Bloqueado por segurança”; 6) '
             'caso contrário “Disponível”. Cada mudança fica auditada com o '
             'motivo no campo stateReason.')

    h2(story, '6.2 Motoristas')
    p(story, 'Para cada motorista registam-se Nome completo, Código interno '
             '(auto-gerado MTR-XXXX se vazio), Contacto, Contacto de '
             'emergência (apenas quando autorizado pela política, FR-020), '
             'Número e categoria da carta (C1/C/C2/D), Validade da carta '
             '(obrigatória) e País emissor. A coluna “Elegível” resume: '
             'activo E carta válida. Um motorista com carta expirada aparece '
             'a vermelho e é bloqueado em qualquer planeamento (FR-021). Os '
             'estados possíveis são Activo, Inactivo, Suspenso e “Em viagem”.')

    h2(story, '6.3 Reboques')
    p(story, 'Reboques registam-se separadamente (Matrícula/Identificação, '
             'Tipo: Atrelado/Cisterna/Dolly, Marca, Capacidade em kg) e '
             'associam-se opcionalmente a cada viagem (FR-012). A matrícula '
             'segue a mesma normalização e unicidade dos veículos.')

    h2(story, '6.4 Rastreadores GPS')
    p(story, 'O separador começa pelo painel “Integração de telemetria '
             '(GPS-008)” com três cartões: o endpoint de ingestão '
             '(POST /api/gps/ingest com autenticação Bearer por chave de '
             'dispositivo), os adaptadores (o genérico generic-json está '
             'activo; Teltonika e Queclink ficam como pontos de ligação '
             'após homologação, ARC-005) e a documentação viva '
             '(GET /api/gps/ingest devolve o contrato com exemplo de '
             'payload). Em DEMO existe “Copiar payload de teste”.')
    numerada(story, [
        '“Novo dispositivo”: N.º de série (único), IMEI, Fornecedor, N.º SIM/roaming.',
        'O sistema gera uma apiKey no formato gps_ + 48 caracteres hex e mostra-a UMA ÚNICA VEZ '
        'no modal “Nova chave de API gerada” — guardar em segurança (DEV-007).',
        'Associar o dispositivo ao veículo com o selector “Associar a...” — a associação anterior '
        'fica fechada com data (histórico DeviceAssignment).',
        'Se a chave se comprometer, “Rodar chave de API” (confirma digitando RODAR) gera chave nova; '
        'a antiga deixa de ser aceite de imediato e a operação fica auditada.',
    ])
    p(story, 'Estados de dispositivo: OPERATIONAL, NO_NETWORK (a guardar '
             'localmente e reenviando), NO_POWER (corte de alimentação gera '
             'alerta CRÍTICO), TAMPER_ALERT (violação), OFFLINE e INACTIVE.')

    h2(story, '6.5 Documentos com vencimentos')
    p(story, 'Cada documento associa-se a um veículo ou motorista e tem: Tipo '
             '(Seguro, Inspecção, Licença, Autorização transfronteiriça, '
             'Carta de condução, Documento aduaneiro, Certificado de carga, '
             'Outro), Número, Emissão, Validade (obrigatória), País emissor '
             'e a flag Bloqueante (“Sim — bloqueia partida”). Os estados '
             'calculam-se sozinhos: VÁLIDO; A EXPIRAR quando faltam 30 dias '
             'ou menos; EXPIRADO a vermelho. Um bloqueante expirado: 1) '
             'bloqueia o planeamento de qualquer viagem do veículo/motorista '
             '(AT-017); 2) contribui para o estado “Bloqueado por segurança” '
             'do veículo; 3) gera alerta CRÍTICO tipo DOC_EXPIRED (sem '
             'duplicar alertas já abertos). Os filtros “A expirar (30 dias)” '
             'e “Expirados” permitem trabalhar a fila de renovações.')
    PAUSE(story)


def cap7(story):
    h1(story, 'Capítulo 7 — Despesas')

    h2(story, '7.1 Submissão de uma despesa')
    p(story, 'Despesas entram pelo escritório (ecrã Despesas) ou pela App do '
             'Motorista (Cap. 10, com foto e offline). O servidor aplica, '
             'nesta ordem, todas as regras abaixo; qualquer falha devolve '
             'erro explicativo e nada é gravado a meio.')
    numerada(story, [
        '<b>Identidade offline</b> — cada despesa traz um clientUuid; o mesmo UUID reenviado devolve a '
        'despesa existente com idempotent:true — zero duplicações (AT-009).',
        '<b>Viagem válida</b> — tem de existir na empresa e não estar Fechada nem Cancelada (409: exige '
        'reabertura controlada).',
        '<b>Categoria válida</b> — uma de 13: combustível, portagens, per_diem, alfândega, estacionamento, '
        'manutencao_emergencia, pneus, lavagem, comunicacao, alojamento, alimentacao, taxas_locais, outros.',
        '<b>Valor</b> — inteiro positivo em cêntimos; moeda livre entre MZN, USD, ZAR, ZWG, MWK, ZMW, CDF.',
        '<b>Câmbio</b> — se a moeda difere da moeda-base, o sistema usa a taxa mais recente e guarda '
        'convertedMinor + taxa + fonte + data; sem taxa, recusa com “Registe a taxa antes de submeter” (FIN-003).',
        '<b>Comprovativo</b> — nas categorias exigentes por defeito (combustível, portagens, alfândega) '
        'é obrigatória a fotografia/talão OU uma justificação documentada (FR-060).',
        '<b>Deduplicação</b> — o detector sinaliza, nunca rejeita: pontuação (score) com pesos (valor/moeda 0.35, '
        'categoria 0.2, estabelecimento 0.15, hash de ficheiro idêntico 0.45, local 0.15, tempo 0.1); '
        'score maior ou igual a 0.5 marca POSSIBLE_DUPLICATE e cria alerta MEDIUM para decisão humana (AT-015).',
        '<b>Orçamento</b> — rubrica a 80% gera aviso; esgotada gera alerta HIGH BUDGET_EXCEEDED (FR-059).',
    ])

    h2(story, '7.2 A fila de aprovação')
    p(story, 'O ecrã abre por defeito no filtro “Fila de aprovação” '
             '(SUBMITTED + IN_REVIEW + RETURNED). Cada linha mostra código, '
             'data, viagem, motorista, categoria, valor (com segunda linha '
             '“≈ convertido (taxa x fonte)” quando estrangeira), talão '
             '(Anexo / Excepção / Falta), sinais (Duplicado n%, coordenadas '
             'GPS ou “GPS indisponível”) e estado. Os filtros superiores '
             'separam Todas, Aprovadas, Rejeitadas e Anuladas; motoristas veem '
             'apenas as próprias.')

    h2(story, '7.3 Decisões do aprovador (FIN-014)')
    tabela(story, [
        ['Acção', 'De estados', 'Exigências', 'Efeito'],
        ['Aprovar', 'SUBMITTED, IN_REVIEW, RETURNED', 'Confirmação com resumo', 'Estado APROVADA; notifica o autor'],
        ['Rejeitar', 'SUBMITTED, IN_REVIEW, RETURNED, APPROVED', 'Categoria do motivo + motivo com no mínimo 8 caracteres', 'REJEITADA; notifica o autor'],
        ['Devolver p/ correcção', 'Idem Rejeitar', 'Idem Rejeitar', 'RETURNED; aguarda nova submissão'],
        ['Anular (fluxo controlado)', 'APPROVED', 'Só financeiro/administração; motivo', 'VOID com autor e data'],
        ['Limpar sinal de duplicado', 'Qualquer com flag', 'Motivo “Revisão humana concluída”', 'Flag limpa; auditoria DUPLICATE_REVIEWED'],
    ], [0.20, 0.22, 0.30, 0.28], caption='Tabela 7.1 — Acções do aprovador de despesas')
    caixa(story, 'Ninguém aprova, rejeita ou devolve a própria despesa: o '
                 'servidor recusa com 403 (segregação de funções, SRS 4.1). '
                 'A rejeição exige categoria do motivo (Valor incorrecto, '
                 'Sem comprovativo válido, Categoria errada, Fora do '
                 'orçamento/política, Duplicado, Não relacionado com a '
                 'viagem, Outro) e texto de no mínimo 8 caracteres — o botão '
                 '“Confirmar decisão” fica desactivado até cumprir.',
          'Segregação e motivo obrigatório')

    h2(story, '7.4 Talões privados e integridade')
    p(story, 'As fotografias guardam-se fora da pasta pública, com nome '
             'interno aleatório e hash SHA-256. O acesso passa sempre pelo '
             'endpoint autorizado GET /api/files/{id}, com cabeçalho '
             'X-Integrity-Verified a confirmar a integridade a cada '
             'descarregamento (SEC-007, AT-001). O ecrã mostra os primeiros '
             'caracteres do hash ao lado da imagem — o talão de hoje é '
             'verificável daqui a anos. Tipos aceites: JPEG, PNG, WebP, HEIC '
             'e PDF; máximo 12 MB.')
    PAUSE(story)
