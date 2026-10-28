# -*- coding: utf-8 -*-
"""SIGFCO Manual - Capítulos 1 a 3."""
from manual_base import (S, bullets, caixa, codigo, h1, h2, h3, numerada,
                         p, tabela, alerta, PAUSE)
from reportlab.platypus import Spacer, Paragraph


def cap1(story):
    h1(story, 'Capítulo 1 — Sobre este manual e o SIGFCO', primeiro=True)

    h2(story, '1.1 O que é o SIGFCO')
    p(story, 'O SIGFCO (Sistema Integrado de Gestão de Frotas e Controlos '
             'Operacionais) é a aplicação desenvolvida em 2026 para gerir, de '
             'ponta a ponta, a operação de transportes rodoviários a partir da '
             'Beira, com ênfase nos corredores da África Austral. O sistema '
             'acompanha o ciclo completo de cada viagem: do planeamento com '
             'verificação automática de elegibilidade, passando pelo checklist '
             'pré-partida com bloqueios obrigatórios, pela telemetria GPS '
             'dedicada, pelas despesas com talão fotografado e conversão '
             'cambial, até ao fecho financeiro com reconciliação de '
             'adiantamentos.', 'lead')
    p(story, 'A leitura do SRS v1.0 (Especificação de Requisitos de Software, '
             '29 páginas) foi feita requisito a requisito e a implementação '
             'cobre a totalidade das famílias identificadas: funcionais '
             '(FR), de rastreio GPS, financeiras (FIN), de modo offline (OFF), '
             'de manutenção (MNT), de documentos (DOC), de segurança (SEC), de '
             'auditoria (AT), de usabilidade (UX), de dispositivo móvel (MOB) '
             'e de ambiente de demonstração (DEV). Este manual documenta o que '
             'foi efectivamente construído: cada ecrã, cada regra verificada '
             'no servidor e cada limitação assumida de forma honesta.')
    p(story, 'O princípio organizador do sistema é simples: nada de essencial '
             'depende da boa-fé ou da memória de alguém. Os bloqueios de '
             'segurança são verificados no servidor, as acções sensíveis ficam '
             'registadas numa trilha de auditoria com valores antes e depois, '
             'os estados calculam-se a partir de eventos reais (partida, '
             'chegada, ordem de serviço, documento expirado) e os indicadores '
             'declaram sempre as suas fontes e limitações. Quando o sistema '
             'não sabe algo, ele diz que não sabe: tempo sem telemetria nunca '
             'é apresentado como veículo parado, e despesas pendentes nunca '
             'são somadas às aprovadas.')

    h2(story, '1.2 Base legal e âmbito')
    p(story, 'O contrato de desenvolvimento é o documento SRS v1.0 partilhado '
             'pelo proprietário do projecto. Todas as regras citadas neste '
             'manual referem-se aos códigos de requisito desse documento '
             '(por exemplo FR-015 para justificação de odómetro, AT-003 para '
             'o bloqueio sem excepção do checklist, FIN-014 para rejeição com '
             'motivo). O sistema foi concebido para operação real a partir da '
             'Beira: Porto da Beira e EN6 como origens típicas, corredores '
             'transfronteiriços para Harare, Lusaka, Lilongwe e o resto da '
             'região, com moedas MZN, USD, ZAR, ZWG, MWK, ZMW e CDF suportadas '
             'para despesas e câmbios.')

    h2(story, '1.3 Como usar este manual')
    p(story, 'O manual está organizado por capítulos que seguem a lógica da '
             'operação: acesso e perfis, painel e mapa, viagens, frota, '
             'despesas, financeiro, manutenção, aplicação do motorista, '
             'alertas e auditoria, configuração, arranque com dados reais, '
             'migração para a nuvem e resolução de problemas. A leitura em '
             'ordem é recomendada à primeira vez; depois, o índice clicável '
             'serve de consulta rápida. Convenções usadas ao longo do texto:')
    bullets(story, [
        '<b>Caixa com bordo azul</b> — regra crítica de negócio; não admite excepção.',
        '<b>Caixa com bordo vermelho</b> — risco de operação; leia antes de agir.',
        '<b>Monospace</b> — códigos de sistema, valores de configuração e exemplos JSON.',
        'Códigos de requisito (FR-XXX, GPS-XXX, FIN-XXX, AT-XXX) indicam a origem '
        'da regra no SRS v1.0.',
        'Etiquetas de ecrã aparecem entre aspas exactamente como aparecem na '
        'interface (ex.: “Guardar rascunho”, “Fechar com excepção”).',
    ])

    h2(story, '1.4 Ficha técnica do projecto')
    tabela(story, [
        ['Campo', 'Valor'],
        ['Nome do sistema', 'SIGFCO — Sistema Integrado de Gestão de Frotas e Controlos Operacionais'],
        ['Versão', '1.0 (primeira entrega funcional completa)'],
        ['Ano', '2026'],
        ['Local de operação', 'Beira, Sofala, Moçambique (Porto da Beira e EN6 como base operacional)'],
        ['Proprietário', 'Filomeno Manuel Joaquim Alexandre'],
        ['Tecnologia', 'Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui'],
        ['Base de dados', 'SQLite via Prisma (migração para PostgreSQL/Supabase prevista — ver Cap. 14)'],
        ['Mapa', 'Leaflet + OpenStreetMap (sem descarregamento em massa de mapas)'],
        ['Telemetria', 'GPS dedicado por veículo (fonte primária) + telemóvel (fonte secundária)'],
        ['Moeda-base', 'MZN (metical); despesas aceitam 7 moedas com câmbio auditado'],
        ['Idioma', 'Português de Moçambique (pt-MZ)'],
    ], [0.28, 0.72], caption='Tabela 1.1 — Ficha técnica do projecto SIGFCO')

    p(story, 'Nota sobre o fuso horário: o sistema exibe “Africa/Maputo” como '
             'identificador técnico de fuso. Trata-se do identificador '
             'internacional (IANA) do fuso único nacional de Moçambique, '
             'UTC+2, que é o mesmo fuso válido para a Beira. Não existe '
             'nenhuma ligação operacional à cidade de Maputo: a operação, os '
             'exemplos, as origens padrão e o ambiente de demonstração estão '
             'ancorados na Beira (Porto da Beira, Base Beira, EN6, Inchope, '
             'fronteira de Machipanda).')
    PAUSE(story)


def cap2(story):
    h1(story, 'Capítulo 2 — Arquitectura e segurança')

    h2(story, '2.1 Visão geral do funcionamento')
    p(story, 'O SIGFCO é uma aplicação web cliente-servidor. No navegador '
             'corre uma única página (SPA) com a navegação interna por menus; '
             'toda a informação vive no servidor e chega por 39 rotas de API '
             'sob o prefixo /api/. Não há dados de negócio guardados no '
             'navegador do escritório: cada consulta revalida a sessão, as '
             'permissões e o isolamento por empresa antes de devolver '
             'qualquer dado. A excepção propositada é o telemóvel do '
             'motorista, que mantém uma fila local em IndexedDB quando não há '
             'internet (Capítulo 10).')
    p(story, 'O servidor aplica três camadas de protecção em todas as rotas. '
             'Primeiro, a sessão: sem cookie válido não há resposta. Segundo, '
             'o perfil: cada rota exige uma ou mais permissões específicas e a '
             'negação de acesso (HTTP 403) fica registada na auditoria. '
             'Terceiro, a empresa: todas as consultas são filtradas pela '
             'empresa do utilizador autenticado, de modo que nenhuma empresa '
             'vê dados de outra. A regra de casa é explícita no código: '
             'esconder botões não é segurança — as validações vivem '
             'no servidor.')

    h2(story, '2.2 Autenticação e sessões')
    p(story, 'As palavras-passe nunca são guardadas em texto claro: o servidor '
             'usa o algoritmo scrypt com sal aleatório de 16 bytes e compara '
             'em tempo constante. O cookie de sessão (sigfco_session) é '
             'httpOnly e secure, e o valor guardado na base de dados é apenas '
             'o hash SHA-256 do token — roubar a base de dados não permite '
             'reconstruir sessões activas.')
    tabela(story, [
        ['Parâmetro', 'Valor', 'Efeito prático'],
        ['Duração absoluta', '12 horas', 'Após 12 h do login, nova autenticação obrigatória'],
        ['Inactividade', '240 minutos', 'Sem pedidos durante 4 h, a sessão expira por inactividade'],
        ['Palavra-passe', 'Mín. 8 caracteres com letras e números', 'Rejeitada na criação/alteração se mais fraca'],
        ['Revogação individual', 'Logout', 'Apenas a sessão corrente termina'],
        ['Revogação em massa', '“Revogar outras sessões”', 'Útil ao perder telemóvel ou na saída de um trabalhador'],
        ['Mudança de palavra-passe', 'Revoga automaticamente as restantes sessões', 'Protecção SEC-002 contra acesso residual'],
    ], [0.24, 0.32, 0.44], caption='Tabela 2.1 — Regras de sessão (SEC-002)')

    h2(story, '2.3 Perfis e permissões (RBAC)')
    p(story, 'Existem 9 perfis e 31 permissões. Cada chamada ao servidor '
             'declara a permissão de que precisa; quem não a tem recebe erro '
             '403 e a tentativa fica auditada. A segregação de funções é '
             'deliberada: o despachante planeia e autoriza viagens mas não '
             'aprova despesas; o financeiro aprova despesas mas não planeia '
             'viagens; o auditor vê tudo e não altera nada.')
    tabela(story, [
        ['Perfil (rótulo no sistema)', 'O que pode fazer — resumo'],
        ['Administrador da plataforma (PLATFORM_ADMIN)', 'Tudo, em qualquer empresa; acesso excepcional auditado a empresas via ?companyId='],
        ['Administrador da empresa (COMPANY_ADMIN)', 'Tudo dentro da própria empresa: configuração, utilizadores, fecho com excepção, rodar chaves GPS'],
        ['Gestor de frota (FLEET_MANAGER)', 'Frota completa, viagens, manutenção, combustível, documentos, GPS, alertas, relatórios'],
        ['Despachante (DISPATCHER)', 'Planear/enviar viagens, checklist, documentos, GPS, alertas; NÃO aprova despesas (segregação)'],
        ['Financeiro (FINANCE)', 'Fila de despesas, aprovações e anulações, adiantamentos, per diem, câmbio, auditoria'],
        ['Motorista (DRIVER)', 'App do Motorista: a própria viagem, checklist, eventos, despesas próprias, abastecimentos'],
        ['Mecânico (MECHANIC)', 'Ordens de serviço, planos, pneus, libertação de bloqueios críticos com prova'],
        ['Auditor (AUDITOR)', 'Leitura global + auditoria + exportações; nenhuma escrita'],
        ['Gestor de filial (BRANCH_MANAGER)', 'Equivalente ao gestor de frota no âmbito da operação'],
    ], [0.36, 0.64], caption='Tabela 2.2 — Os 9 perfis e o seu alcance')

    h2(story, '2.4 Isolamento por empresa')
    p(story, 'Cada consulta devolve exclusivamente dados da empresa do '
             'utilizador. Uma tentativa de aceder a registos de outra empresa '
             '(por exemplo, manipulando um identificador na URL) devolve '
             'erro 404/403 e cria um registo de auditoria '
             'TENANT_ESCAPE_ATTEMPT. Este comportamento foi verificado no '
             'teste de aceitação AT-001: uma empresa B criada propositadamente '
             'não consegue ler nem escrever nada da empresa A.')

    h2(story, '2.5 Trilha de auditoria')
    p(story, 'Toda a acção sensível grava um AuditLog com: quem (utilizador e '
             'perfil), o quê (acção e entidade), quando (data e hora do '
             'servidor), de onde (IP e navegador, truncados), porquê (motivo '
             'quando exigido) e os valores antes e depois quando relevante. '
             'Consultar a própria auditoria também é auditado (AT-019): '
             'sabe-se sempre quem consultou a trilha e quando. A auditoria é '
             'paginada de 50 em 50 registos e filtrável por entidade no ecrã '
             '“Auditoria” (Cap. 11).')

    h2(story, '2.6 Numeração de documentos')
    p(story, 'Códigos são gerados no servidor em transacção única, garantindo '
             'unicidade por empresa e sem falhas de numeração mesmo com '
             'utilizadores simultâneos:')
    codigo(story, [
        'VIA-2026-00001    viagem  (VIA)',
        'DESP-2026-00001   despesa (DESP)',
        'OS-2026-00001     ordem de serviço (OS)',
        'MTR-0001          código interno de motorista (auto-gerado)',
    ])

    h2(story, '2.7 Dinheiro e câmbio: regras de ouro')
    p(story, 'Nenhum valor monetário usa vírgula flutuante. Todos os '
             'montantes são guardados como inteiros em cêntimos '
             '(amountMinor) e a formatação para o ecrã usa o padrão '
             'moçambicano (“1.234,56 MT”). As taxas de câmbio são guardadas '
             'como texto decimal de precisão arbitrária e cada despesa em '
             'moeda estrangeira guarda, para sempre, o valor original, a '
             'moeda original, a taxa aplicada, a data e a fonte da taxa. O '
             'resultado é reproduzível anos mais tarde (teste AT-013: 300 ZAR '
             '× 3,48 = 1.044,00 MZN com fonte registada).')
    caixa(story, 'Sem taxa de câmbio registada, a despesa em moeda '
                 'estrangeira é rejeitada pelo servidor — o motorista offline '
                 'recebe “fica pendente até a taxa existir” e o registo '
                 'permanece no telemóvel sem se perder (FIN-003, OFF-008).',
          'Regra crítica: câmbio antes da despesa')
    PAUSE(story)


def cap3(story):
    h1(story, 'Capítulo 3 — Acesso, perfis e ambiente DEMO')

    h2(story, '3.1 Primeiro acesso')
    p(story, 'O ecrã de login é único e não tem selector de empresa: a '
             'empresa é determinada pelo utilizador autenticado. Introduza '
             'email e palavra-passe institucionais e prima “Entrar”. Após o '
             'login, o motorista cai directamente na App do Motorista '
             '(Capítulo 10); todos os outros perfis entram no Painel. O pé do '
             'ecrã de login mostra sempre a versão, o fuso e a moeda-base '
             '(v1.0 · Africa/Maputo · MZN · Português de Moçambique).')
    p(story, 'Se errar credenciais, o sistema devolve “Credenciais inválidas.” '
             'e grava LOGIN_FAILED na auditoria com o IP. Pedidos exagerados '
             'são cortados pelo limitador de ritmo (10 pedidos/minuto por IP '
             'e email) com erro 429 — uma pausa de um minuto resolve.')

    h2(story, '3.2 Ambiente de demonstração (DEMO)')
    p(story, 'O ecrã de login mostra um cartão com contorno âmbar tracejado '
             'chamado “Ambiente de demonstração (DEMO)”. Se o ambiente ainda '
             'não estiver preparado, aparece o botão “Preparar ambiente DEMO '
             '(empresa fictícia)”. Ao primir, o servidor cria a empresa '
             '“Transportadora Corredor DEMO” com 2 filiais, 3 camiões, 1 '
             'reboque, 3 rastreadores, 5 cercas geográficas (Porto da Beira, '
             'Base Beira, Fronteira Machipanda, Cliente Harare, Posto '
             'Inchope), checklist completa, taxas de câmbio, regras de per '
             'diem, documentos, planos de manutenção, uma ordem de serviço '
             'crítica e telemetria inicial no corredor Beira-Harare. A '
             'operação é idempotente: primir duas vezes não duplica nada.')
    p(story, 'A palavra-passe de todas as contas DEMO é Sigfco2026!. Os sete '
             'botões de entrada rápida entram automaticamente com o perfil '
             'escolhido:')
    tabela(story, [
        ['Perfil (etiqueta no botão)', 'Email'],
        ['Director / Admin', 'director@demo.sigfco'],
        ['Gestor de frota', 'frota@demo.sigfco'],
        ['Despachante', 'despacho@demo.sigfco'],
        ['Financeiro', 'financas@demo.sigfco'],
        ['Motorista', 'motorista@demo.sigfco'],
        ['Mecânico', 'mecanico@demo.sigfco'],
        ['Auditor', 'auditor@demo.sigfco'],
    ], [0.5, 0.5], caption='Tabela 3.1 — Contas de demonstração (palavra-passe: Sigfco2026!)')
    p(story, 'A sementeira inclui, de propósito, casos difíceis para treino: '
             'um motorista com carta expirada (aparece como INELEGÍVEL), um '
             'documento bloqueante expirado (bloqueia o planeamento de '
             'viagem, teste AT-017) e uma ordem de serviço crítica em aberto '
             '(bloqueia o veículo até libertação com prova, AT-018). Assim é '
             'possível ensaiar os bloqueios sem inventar dados.')
    alerta(story, 'Os dados DEMO estão marcados em todos os registos '
                  'principais (badge âmbar “DEMO” no topo e nas listas) e a '
                  'telemetria do simulador traz sempre a fonte SIMULATOR. '
                  'Dados de demonstração nunca devem ser apresentados como '
                  'operação real (DEV-003). Após a migração para a nuvem, a '
                  'operação real começa com a empresa verdadeira criada de '
                  'novo, a partir de zero — ver Capítulo 13.',
           'DEMO não é operação real')

    h2(story, '3.3 Sessões activas no dia a dia')
    p(story, 'No menu “Configuração — Sessões e dispositivos”, o administrador '
             'vê a lista de sessões activas com dispositivo, IP e última '
             'actividade. O botão vermelho “Revogar outras sessões” exige '
             'digitar a palavra REVOGAR para confirmar (operação crítica, '
             'UX-004) e termina imediatamente todas as sessões excepto a '
             'corrente. Este é o procedimento padrão quando um telemóvel é '
             'perdido ou um trabalhador sai da empresa.')

    h2(story, '3.4 O que cada perfil vê no menu')
    p(story, 'A barra lateral mostra apenas os menus permitidos ao perfil. O '
             'motorista vê apenas Painel, Viagens e Despesas, e a sua vista '
             'principal é a App do Motorista. A tabela seguinte resume a '
             'visibilidade completa (o menu é escondido, mas o servidor '
             'continua a validar cada chamada):')
    tabela(story, [
        ['Menu', 'PA', 'CA', 'GM', 'DP', 'FIN', 'MEC', 'AUD', 'GF', 'MOT'],
        ['Painel', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x'],
        ['Mapa da frota', 'x', 'x', 'x', 'x', 'x', '', '', 'x', ''],
        ['Viagens', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x'],
        ['Frota', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', ''],
        ['Despesas', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x'],
        ['Financeiro', 'x', 'x', '', '', 'x', '', 'x', '', ''],
        ['Manutenção e Pneus', 'x', 'x', 'x', 'x', '', 'x', 'x', 'x', ''],
        ['Combustível', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', ''],
        ['Documentos', 'x', 'x', 'x', 'x', 'x', '', 'x', 'x', ''],
        ['Alertas', 'x', 'x', 'x', 'x', 'x', '', 'x', 'x', ''],
        ['Relatórios', 'x', 'x', 'x', 'x', 'x', '', 'x', 'x', ''],
        ['Auditoria', 'x', 'x', '', '', 'x', '', 'x', '', ''],
        ['Configuração', 'x', 'x', '', '', '', '', '', '', ''],
    ], [0.28, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08],
        caption='Tabela 3.2 — Visibilidade de menus por perfil (PA = Admin plataforma, '
                'CA = Admin empresa, GM = Gestor de frota, DP = Despachante, FIN = Financeiro, '
                'MEC = Mecânico, AUD = Auditor, GF = Gestor de filial, MOT = Motorista)',
        centro=[1, 2, 3, 4, 5, 6, 7, 8, 9])
    PAUSE(story)
