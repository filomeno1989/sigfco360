# SIGFCO — Manuais de Utilização (resumo por perfil)

## 1. Administrador da empresa / Director

**Arranque:** Configuração → Empresa (dados, NUIT) → Parâmetros (limiares GPS, orçamento,
duplicados) → Utilizadores (criar contas por perfil) → Checklist padrão (ajustar itens; os
itens Carregador/Suporte/Rastreador são sistémicos e não removíveis).

**Rotina:** semanalmente rever Auditoria (acessos, câmbio, fechos) e Sessões (revogar
dispositivos perdidos — botão "Revogar outras sessões"). Trocar a palavra-passe DEMO de
qualquer conta reutilizada.

## 2. Despachante / Operações

**Planear viagem:** Viagens → Nova viagem (cliente, origem/destino, motorista, veículo,
reboque, orçamento por rubrica/moeda) → *Validar e planear*. O sistema bloqueia com lista de
problemas (sem rastreador, documentos expirados, manutenção crítica, conflito de recursos).

**Liberar partida:** envia para checklist → motorista submete no telemóvel → se todos os
itens bloqueantes estiverem OK, autorize a partida. **Não existe forma de autorizar com
checklist reprovada** (regra do carregador obrigatório).

**Acompanhar:** Mapa da frota (frescura do ponto), Alertas (reconhecer/encerrar com motivo),
ocorrências no detalhe da viagem.

## 3. Motorista (App — instalável como PWA)

**Ecrãs:** Viagem (checklist pré-partida, partida com odómetro, pausa, chegada), Despesas
(categoria → valor/moeda → foto do talão), Fila (estado de sincronização).

**Sem internet:** tudo funciona — os registos ficam marcados **"Guardado neste telemóvel"** e
enviam-se sozinhos quando a rede volta ("Sincronizado"). Não precisa de fazer mais nada.
**Nunca use o telemóvel ao conduzir.** SOS: segure a intenção — digite SOS para confirmar.

**Instalação:** Chrome/Safari → "Adicionar ao ecrã principal". A app mantém os registos mesmo
após fecho/reinício.

## 4. Financeiro

**Fila de despesas:** filtros por pendentes/duplicadas/sem talão. Abrir registo: ver talão
(privado, com hash), GPS da despesa, orçamento da viagem. Decisões: Aprovar · Rejeitar ·
Devolver (motivo com categoria obrigatório). Anulação é fluxo controlado com auditoria.

**Câmbio:** registar taxa por par (fonte manual auditada; API activa-se após credenciais).
**Adiantamentos:** conceder por viagem; reconciliação mostra saldo por moeda (a devolver /
a reembolsar) e pendências que bloqueiam o fecho.

## 5. Gestor de frota / Mecânico

**Frota:** veículos (odómetro, tanque, consumo de referência), motoristas (validade da carta
bloqueia atribuição), reboques, rastreadores (associação, rotação de chave API, estado
NO_POWER/TAMPER), documentos (bloqueantes com alerta de vencimento).

**Manutenção:** planos preventivos com antecedência de alerta; ordens de serviço — marcar
**Crítica** para bloquear o despacho; libertar com diagnóstico + motivo (fica prova em
auditoria). Pneus: instalar/rotação/reparação com odómetro. Combustível: anomalias sinalizadas
para revisão humana; consumo esperado vs real com pressupostos.

## 6. Auditor

Leitura total com exportações CSV auditadas (Relatórios). Auditoria: filtro por entidade
(viagens, despesas, câmbio, utilizadores, GPS) — cada evento tem autor, data, antes/depois.

## 7. Operação e recuperação (OPS)

- **Backup:** copiar `db/custom.db` + `db/uploads/` (diário, encriptado no destino).
- **Restauro (AT-020):** parar serviço → restaurar ficheiros → `bun run db:push` (verificação
  de schema) → arrancar → validar com checklist de aceptação. RPO 24h / RTO 8h (proposta
  inicial §12.4 — validar com o negócio).
- **Incidentes:** perda de telemóvel → Configuração → Sessões → revogar; GPS sem sinal →
  verificar estado do dispositivo (sem rede ≠ sem alimentação); fornecedor GPS caído →
  telemetria local dos equipamentos mantém histórico para reenvio.

## 8. Homologação do rastreador (checklist ARC-005)

1. Documentação do protocolo/API e método de autenticação.
2. Memória offline ≥ 30 dias na cadência acordada; reenvio ordenado sem duplicados.
3. Bateria de reserva + eventos de alimentação/tamper (GPS-007).
4. Bandas/roaming dos operadores das rotas (MZ, ZW, MW, ZM, CD).
5. Teste real: com rede, sem rede (30 min), desligar alimentação — validar na ingestão
   `POST /api/gps/ingest` antes de activar em produção.
6. Registar serial, local de instalação e técnico na ficha do dispositivo.
