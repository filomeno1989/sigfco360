# -*- coding: utf-8 -*-
"""SIGFCO Manual - Capítulos 8 a 12."""
from manual_base import (S, bullets, caixa, codigo, h1, h2, h3, numerada,
                         p, tabela, alerta, PAUSE)
from reportlab.platypus import Spacer, Paragraph


def cap8(story):
    h1(story, 'Capítulo 8 — Financeiro: adiantamentos, per diem e câmbio')
    p(story, 'O ecrã “Financeiro” tem 3 separadores: Adiantamentos, Per diem '
             'e Taxas de câmbio. A gestão (conceder, registar, alterar) é '
             'reservada ao financeiro e à administração; o auditor vê tudo em '
             'leitura.')

    h2(story, '8.1 Adiantamentos e reconciliação da viagem (FR-065/067)')
    p(story, 'Um adiantamento associa-se a uma viagem e leva Valor, Moeda '
             '(MZN/USD/ZAR/ZWG), Método (Dinheiro, Transferência, Mobile '
             'money/MoMo) e Referência de autorização. O campo “Liquidado” '
             'permite registar, mais tarde, o valor efectivamente entregue. '
             'O painel “Reconciliação da viagem” calcula, por moeda: saldo = '
             'adiantamentos − despesas aprovadas. Saldo positivo = o '
             'motorista deve devolver; negativo = a empresa deve reembolsar. '
             'Abaixo, “Pendências” conta as despesas ainda sem decisão e as '
             'rejeitadas. Nunca se misturam moedas sem taxa (FIN-015).')

    h2(story, '8.2 Per diem (FR-066)')
    p(story, 'As regras definem taxa diária por país (Moçambique, Zimbabwe, '
             'Malawi, Zâmbia, RD Congo, África do Sul) e opcionalmente por '
             'cidade, com moeda MZN/USD e flag Activa. A calculadora '
             '“Calcular per diem” pede país e número de dias e devolve o '
             'total com a explicação textual da regra usada '
             '(“diária × dias = total”) — o cálculo é sempre legível e '
             'auditable. Alterar o montante de uma regra exige motivo e fica '
             'com antes/depois na auditoria.')

    h2(story, '8.3 Taxas de câmbio')
    p(story, 'A regra FIN-003 está escrita no próprio ecrã: “Toda a taxa tem '
             'origem explícita. Fonte API/automática só é activada após '
             'credenciais e teste real — enquanto isso, registo manual '
             'auditado.” O registo manual pede De (USD/ZAR/ZWG/MWK/ZMW/CDF), '
             'Para (MZN), Taxa (ex.: 63.85) e Nota. Cada taxa cria um NOVO '
             'registo (o histórico nunca se perde) e grava auditoria '
             'RATE_CHANGE com autor, data e valores. A conversão de cada '
             'despesa é reproduzível a partir dos dados guardados (AT-013).')
    PAUSE(story)


def cap9(story):
    h1(story, 'Capítulo 9 — Manutenção, pneus e combustível')
    p(story, 'A vista “Manutenção e Pneus” agrupa 4 separadores: Ordens de '
             'serviço, Planos preventivos, Pneus e Combustível. Gere quem tem '
             'permissão de manutenção (admin, gestor de frota/filial, '
             'mecânico); abastecimentos podem ser registados também por '
             'motoristas e despachantes.')

    h2(story, '9.1 Ordens de serviço (OS) e bloqueio crítico (MNT-003/004)')
    p(story, 'Abrir OS pede Veículo, Tipo (Correctiva/Preventiva), Prioridade '
             '(Baixa/Normal/Alta/Crítica), Oficina e Sintoma/avaria. A flag '
             '“Crítica (bloqueia despacho)” é o interruptor de segurança: OS '
             'crítica não concluída põe o veículo em “Bloqueado por '
             'segurança” e recusa qualquer novo planeamento (AT-018). A OS '
             'crítica mostra um cadeado vermelho na lista até ser '
             'libertada.')
    caixa(story, 'A libertação de um bloqueio crítico (“Concluir/libertar”) '
                 'exige Diagnóstico/serviço executado E Motivo/prova da '
                 'libertação; o botão só activa com prova de pelo menos 5 '
                 'caracteres. Fica registado quem libertou, quando e com que '
                 'prova (MNT-004). Sem prova, o veículo não volta à '
                 'operação.', 'Libertação com prova obrigatória')
    p(story, 'OS normais aceitam edição de sintoma, diagnóstico, prioridade e '
             'custos (mão-de-obra + peças); concluir preenche a data de '
             'fecho e recalcula o estado do veículo.')

    h2(story, '9.2 Planos preventivos (MNT-001/002)')
    p(story, 'Cada plano associa veículo + serviço (Óleo, Filtros, Travões, '
             'Pneus, Suspensão, Inspecção) a um intervalo em km e/ou dias, '
             'com alerta antecipado configurável (“km antes”). Os planos '
             'alimentam os alertas de manutenção preventiva; a lista mostra '
             'a última execução e o estado activo.')

    h2(story, '9.3 Pneus (MNT-010)')
    p(story, 'Cada pneu tem número de série único, marca e medida. Os '
             'movimentos possíveis são 5: Instalação (com veículo, posição '
             'ex.: E1, E2, DI, DE, T1, e odómetro), Remoção (volta ao stock), '
             'Rotação, Reparação e Reforma (RETIRED). O histórico completo de '
             'movimentos fica listado com data, pneu, posição e nota.')

    h2(story, '9.4 Combustível (FUEL-001/002/003)')
    p(story, 'O registo de abastecimento pede Veículo, Litros, Preço por '
             'litro, Odómetro e Posto. O total calcula-se em cêntimos '
             '(litros × preço) e o odómetro do veículo avança com o máximo '
             'recebido. O painel “Consumo esperado vs real” compara o '
             'consumo real com o de referência do veículo (L/100km), com os '
             'pressupostos do cálculo declarados por extenso — sem dados '
             'completos, o ecrã diz claramente que não há indicador fiável.')
    caixa(story, 'Anomalias são sinalizadas, nunca corrigidas em silêncio '
                 '(FUEL-003): litros acima de 115% da capacidade do tanque, '
                 'odómetro inconsistente (menor que o anterior − 50 km) ou '
                 'dois abastecimentos em menos de 30 minutos geram flags e '
                 'alerta MEDIUM para revisão humana.', 'Anomalias visíveis')
    PAUSE(story)


def cap10(story):
    h1(story, 'Capítulo 10 — App do Motorista (PWA) e modo offline')

    h2(story, '10.1 Entrar na app e regras de segurança')
    p(story, 'O perfil Motorista entra directamente na App do Motorista; os '
             'restantes perfis podem pré-visualizá-la pelo menu do '
             'utilizador (“Abrir App do Motorista (pré-visualizar)”). No '
             'telemóvel, recomenda-se “Adicionar ao ecrã principal” (o '
             'manifest permite instalação como aplicação, sem barra do '
             'navegador, ícone próprio e fundo escuro).')
    caixa(story, 'A app abre sempre com a faixa âmbar de segurança: “Nunca '
                 'use o telemóvel enquanto conduz. Interaja apenas com o '
                 'veículo parado em local seguro.” (MOB-005). Esta regra '
                 'antecede qualquer funcionalidade.', 'Faixa obrigatória')
    p(story, 'O cabeçalho mostra o estado de rede (“Online” verde / “Sem '
             'internet” âmbar) e dois cartões de estado: GPS do telemóvel '
             '(disponível / sem permissão / sem fixação) e Sincronização '
             '(n registos pendentes ou “Tudo sincronizado”). A navegação '
             'inferior tem 3 botões: Viagem, Despesas e Fila.')

    h2(story, '10.2 Separador Viagem')
    p(story, 'Sem viagem atribuída, o ecrã diz “Sem viagem activa”. Quando o '
             'despacho atribui, o cartão mostra o código, o estado, a rota '
             'com seta e a carga/cliente. O fluxo segue o estado:')
    numerada(story, [
        '<b>A aguardar checklist</b> — lista de itens com caixas de marcação; bloqueantes marcados '
        '“(obrigatório)”; aviso fixo de que o carregador é obrigatório. “Submeter checklist” só activa '
        'com tudo respondido.',
        '<b>Autorizada para partida</b> — campo grande “Odómetro de partida (km)” + “Confirmar partida”.',
        '<b>Em trânsito</b> — dois botões: “Registar pausa” (pede motivo) e “Chegada ao destino” '
        '(pede odómetro de chegada). Em pausa, o primeiro passa a “Retomar viagem”.',
        '<b>Chegada registada</b> — mensagem clara: aguardar a revisão do escritório; o fecho é feito '
        'pela equipa após conferência de despesas (FR-038).',
    ])
    caixa(story, 'O botão vermelho “SOS — pedir ajuda” está sempre visível. '
                 'A confirmação exige DIGITAR a palavra SOS e explica: serão '
                 'enviados a viagem, as coordenadas disponíveis e a hora do '
                 'dispositivo; uso acidental mobiliza resposta (GPS-026). O '
                 'SOS funciona SEM internet: fica na fila do telemóvel e '
                 'envia-se sozinho quando a rede volta.', 'SOS sem rede')

    h2(story, '10.3 Separador Despesas')
    p(story, 'Dois botões abrem o formulário: “Nova despesa + foto” e “Despesa '
             'sem câmara”. O formulário é curto, um passo por ecrã '
             '(MOB-004): Categoria (grelha de 10 botões), Valor + Moeda '
             '(MZN/USD/ZAR/ZWG), campos Litros e Preço/litro quando '
             'Combustível, Estabelecimento/posto, e a zona de fotografia do '
             'talão.')
    p(story, 'A fotografia é comprimida NO PRÓPRIO TELEMÓVEL (máximo 1280 px '
             'de largura, JPEG qualidade ≈ 0,72 — AT-011) antes de qualquer '
             'envio, poupando dados móveis. Sem fotografia, existe o campo '
             '“Sem comprovativo — justificação” (ex.: posto sem máquina '
             'fiscal) que fica registado como excepção para revisão. A nota '
             'de GPS explica o que acontece à localização: anexada ao '
             'registo, ou sinalizada para revisão se o telemóvel negar '
             'permissão.')
    p(story, 'Ao guardar: com internet, “Despesa guardada e submetida”; sem '
             'internet, “Despesa guardada NESTE TELEMÓVEL — será enviada '
             'automaticamente quando houver internet”. Em ambos os casos o '
             'registo nasce com UUID e hora do dispositivo (OFF-002).')

    h2(story, '10.4 Separador Fila: os 4 estados offline')
    p(story, 'A fila vive no IndexedDB do telemóvel (base sigfco-offline) — '
             'armazenamento permanente que sobrevive ao fecho da app e ao '
             'reinício do telemóvel (AT-010). Cada registo mostra um resumo '
             'legível (ex.: “Combustível: 1.500,00 MZN” ou “SOS — VIA-...”), '
             'a hora do dispositivo, tentativas e o UUID.')
    tabela(story, [
        ['Estado interno', 'Etiqueta visível', 'Cor', 'Significado'],
        ['GUARDADO', 'Guardado neste telemóvel', 'Cinza', 'À espera de envio'],
        ['A_ENVIAR', 'A sincronizar...', 'Azul', 'Em envio neste momento'],
        ['SINCRONIZADO', 'Sincronizado (confirmado pelo servidor)', 'Verde', 'ACK durável recebido (OFF-004)'],
        ['ERRO', 'Erro que exige acção', 'Vermelho', 'Mensagem do erro visível; reenvia com backoff'],
    ], [0.20, 0.34, 0.12, 0.34], caption='Tabela 10.1 — Estados da fila offline')
    p(story, 'O envio vai a POST /api/sync em lote (máximo 100 itens) e o '
             'servidor responde item a item: ACK para processados, erro '
             'explicativo para recusados. Um registo só é marcado como '
             'SINCRONIZADO após confirmação durável do servidor; sessão '
             'expirada marca “Erro que exige acção — Sessão expirada — '
             'autentique-se para sincronizar”. O ciclo automático usa '
             'backoff: começa aos 5 segundos, dobra até 120 segundos e '
             'reinicia após sucesso; o botão “Tentar agora” força de imediato.')
    alerta(story, 'A sincronização automática ocorre com a app aberta (evento '
                  'online + ciclo temporizado). Não existe promessa de '
                  'telemetria em segundo plano quando a app está fechada — '
                  'o comportamento é declarado e honesto (OFF-023).')
    PAUSE(story)


def cap11(story):
    h1(story, 'Capítulo 11 — Alertas, notificações, auditoria e relatórios')

    h2(story, '11.1 Alertas (SRS 15.2)')
    p(story, 'O ecrã “Alertas” abre no filtro “Abertos” e actualiza a cada '
             '30 segundos. A gravidade define a resposta esperada: CRÍTICO '
             'impede acções, ALTO notifica, MÉDIO entra na fila de trabalho, '
             'INFORMATIVO fica para histórico. O sino no topo mostra '
             'notificações não lidas e leva a esta vista.')
    tabela(story, [
        ['Acção', 'Regras'],
        ['Reconhecer (ACK)', 'Marca quem reconheceu e quando; o alerta continua em seguimento'],
        ['Encerrar', 'Gravidades CRÍTICA e ALTA exigem motivo (mín. 5 caracteres); as restantes motivo opcional'],
        ['Deduplicação', 'Alertas iguais abertos (ex.: DOC_EXPIRED do mesmo documento) não se duplicam'],
    ], [0.24, 0.76], caption='Tabela 11.1 — Ciclo de vida do alerta: OPEN → ACK → CLOSED')
    p(story, 'Tipos de alerta gerados pelo sistema: CHARGER_MISSING '
             '(checklist sem carregador), DOC_EXPIRED (documento bloqueante '
             'expirado), MAINTENANCE_CRITICAL (OS crítica), GPS_NO_POWER e '
             'TAMPER (alimentação/violação do rastreador), GPS_STALLED '
             '(viagem em trânsito sem telemetria — “falta de telemetria não '
             'implica veículo parado”, GPS-027), ROUTE_DEVIATION, LONG_STOP, '
             'BUDGET_EXCEEDED, DUPLICATE_EXPENSE, SPEEDING, GEOFENCE '
             '(entrada/saída de cerca), SOS e OTHER (ocorrências graves).')

    h2(story, '11.2 Notificações in-app')
    p(story, 'Cada decisão (aprovar/rejeitar despesa, autorizar partida, '
             'alerta SOS, etc.) gera notificação IN_APP para os '
             'intervenientes, consultável pelo sino com contador a cada 60 '
             'segundos. Os canais EMAIL e SMS estão previstos no modelo de '
             'dados mas permanecem PENDENTES de fornecedor — nenhum email ou '
             'SMS real é enviado nesta versão (limitação declarada).')

    h2(story, '11.3 Trilha de auditoria')
    p(story, 'O ecrã “Auditoria” lista 50 eventos por página com filtros '
             'por entidade (Viagens, Despesas, Câmbio, Utilizadores, GPS, '
             'Alertas) e paginação “Anterior/Seguinte”. Cada linha mostra '
             'quando, utilizador (ou “sistema”), acção, entidade e id, '
             'motivo, detalhe JSON truncado e IP. A própria consulta é '
             'auditada (AUDIT_VIEW, AT-019): quem consultou a trilha e '
             'quando fica registado.')

    h2(story, '11.4 Relatórios e exportações CSV (AT-024)')
    p(story, 'Quatro exportações: Despesas (com moedas, taxas e fontes — '
             'exige permissão financeira adicional), Abastecimentos (com '
             'anomalias), Viagens (ciclo de vida, km, orçamento, motivo de '
             'cancelamento) e Documentos (vencimentos e bloqueantes). O '
             'ficheiro abre no Excel (BOM UTF-8, separador ponto-e-vírgula, '
             'nome sigfco_tipo_data.csv) e CADA exportação fica auditada com '
             'número de linhas e período. O painel “Fiabilidade dos '
             'indicadores” repete as regras de honestidade: indicadores '
             'declaram período/unidade/moeda/fontes; custo por km não se '
             'calcula com dados incompletos; pendentes não somam aprovados; '
             'tempo sem GPS não é tempo parado.')
    PAUSE(story)


def cap12(story):
    h1(story, 'Capítulo 12 — Configuração')
    p(story, 'Exclusivo dos administradores (plataforma e empresa). Cinco '
             'separadores: Empresa, Parâmetros, Utilizadores, Sessões e '
             'dispositivos, Cercas geográficas.')

    h2(story, '12.1 Empresa')
    p(story, 'Nome, Nome legal, NUIT, Telefone, Morada, Moeda-base (MZN) e '
             'Fuso horário (Africa/Maputo, fuso único nacional — ver nota do '
             'Cap. 1 sobre a Beira). Guardar mostra “Empresa actualizada.”')

    h2(story, '12.2 Parâmetros operacionais (FR-003)')
    p(story, 'Cada parâmetro tem botão OK próprio e guarda sem alterar '
             'código. Valores por defeito entre parênteses:')
    tabela(story, [
        ['Parâmetro no ecrã', 'Chave interna', 'Defeito', 'Efeito'],
        ['GPS “sem comunicação” após (min)', 'gps_stale_minutes', '20', 'A partir daqui o mapa mostra vermelho'],
        ['GPS “atrasado” após (min)', 'gps_delayed_minutes', '5', 'A partir daqui o mapa mostra âmbar'],
        ['Paragem prolongada após (min)', 'long_stop_minutes', '120', 'Dispara alerta de paragem longa'],
        ['Tolerância de desvio de rota (km)', 'route_deviation_km', '15', 'Base do alerta ROUTE_DEVIATION'],
        ['Alerta de orçamento (%)', 'budget_alert_pct', '80', 'Barra âmbar e aviso a partir daqui'],
        ['Janela de duplicados (min)', 'duplicate_window_minutes', '240', 'Janela temporal do detector'],
    ], [0.34, 0.26, 0.10, 0.30],
        caption='Tabela 12.1 — Parâmetros operacionais editáveis (outros: '
                'duplicate_radius_m 2000, velocidade padrão 100 km/h, foto '
                '1280 px / 0,72)', centro=[2])

    h2(story, '12.3 Utilizadores')
    p(story, 'Lista com Nome, Email, Perfil (alterável em linha), Activo '
             '(interruptor) e Último acesso. “Novo utilizador” exige '
             'palavra-passe com mínimo 8 caracteres, letras e números '
             '(SEC-002). Alterar a palavra-passe de alguém revoga as '
             'restantes sessões dessa pessoa. Desactivar um utilizador '
             'corta o acesso na próxima verificação de sessão.')

    h2(story, '12.4 Sessões e dispositivos')
    p(story, 'Sessões activas com dispositivo, IP e última actividade; botão '
             'vermelho “Revogar outras sessões” com confirmação digitada '
             'REVOGAR. Resultado: “n sessões revogadas (excepto a actual)”.')

    h2(story, '12.5 Cercas geográficas (GPS-022)')
    p(story, 'Cada cerca tem Nome, Tipo (Base, Porto, Cliente, Posto, '
             'Portagem, Fronteira, Zona restrita, Descanso), Latitude, '
             'Longitude e Raio (defeito 300 m). Entradas e saídas de '
             'veículos com viagem activa geram alertas informativos e '
             'eventos visíveis no mapa. Exemplos DEMO: Porto da Beira, Base '
             'Beira, Fronteira Machipanda, Cliente Harare, Posto Inchope.')
    PAUSE(story)
