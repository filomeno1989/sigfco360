# SIGFCO — Matriz de Requisitos → Implementação → Verificação
# SRS v1.0 • Entrega v1.0 • (DEV-001, DEV-010, §16.3, §18.1)

Legenda: ✅ implementado e verificado · 🟡 implementado com dependência externa pendente · ⛔ fora do âmbito inicial (§2.4)

## 1. Instruções à IA desenvolvedora (§1)

| Req | Implementação | Evidência |
|---|---|---|
| DEV-001 | Decomposição nesta matriz + worklog | `docs/MATRIZ_REQUISITOS.md`, `worklog.md` |
| DEV-002 | Ambiente inspecionado antes de codificar | worklog Task 1 |
| DEV-003 | DEMO sempre identificado; simulador fonte=SIMULATOR | `api/demo/route.ts`, badge DEMO em toda a UI, login demo |
| DEV-004 | Sem controlos mortos: botões ocultos quando o estado não permite a acção | `views-trips.tsx` (acções condicionais ao estado) |
| DEV-005 | Carregador, RBAC, auditoria, isolamento e offline não foram enfraquecidos | testes AT abaixo |
| DEV-006 | Fases incrementais com migração por passo | `prisma/schema.prisma` + worklog |
| DEV-007 | Segredos só em variáveis de ambiente; chave de API GPS revelada uma vez | `.env.example`, `api/gps/devices` (rotate-key) |
| DEV-008 | Decisões registadas com alternativas e risco | `docs/DECISOES_TECNICAS.md` |
| DEV-009 | Interfaces de integração sem inventar compatibilidade | `src/lib/gps.ts` (adapters), §5 do README |
| DEV-010 | README, migrações, .env.example, testes, manuais, matriz | este repositório |

## 2–5. Perfis, fluxos e estados

| Req | Implementação | Verificação |
|---|---|---|
| §4 perfis (9 perfis) | `src/lib/rbac.ts` (matriz por perfil) | ✅ login por perfil; menu adapta-se; servidor bloqueia |
| §4.1 autorização em cada chamada | `src/lib/api.ts → withAuth + scopeCompanyId` | ✅ AT-001 (empresa B não vê A — testado com fuga de tenant) |
| §4.1 motorista vê só a sua viagem | filtro obrigatório em `api/trips`, `api/expenses` | ✅ AT-002 (escopo server-side) |
| §5.1 ciclo de vida (10 estados) | `api/trips/[id]/actions` (transições validadas) | ✅ testes unitários + fluxo e2e no browser |
| §5.2 estados do veículo automáticos | `src/lib/veiculo.ts → recomputeVehicleState` | ✅ estado muda com viagem/manutenção/documentos; auditoria registada |
| §5.3 conflitos de recursos | `src/lib/viagem.ts → conflictCheck` | ✅ AT-016 (veículo sobreposto rejeitado com explicação) |
| §5.3 UTC + hora original do dispositivo | gnssTime/receivedTime/deviceTime separados | ✅ AT-005 (pontos atrasados com hora original) |

## 6. Requisitos funcionais por módulo

| Req | Implementação | Verificação |
|---|---|---|
| FR-001 multiempresa | companyId em todos os registos + escopo no servidor | ✅ AT-001 |
| FR-002 config. empresa | `api/company` + Configuração → Empresa | ✅ UI |
| FR-003 parâmetros | `src/lib/numeracao.ts → SETTING_DEFAULTS` + UI | ✅ Configuração → Parâmetros |
| FR-004 ambientes | empresa real vazia vs DEMO separada (isDemo) | ✅ |
| FR-005 numeração | `nextCode` com contadores transaccionais | ✅ VIA/DESP/OS-AAAA-NNNNN |
| FR-010 ficha veículo | `api/vehicles` (todos os campos do SRS) | ✅ UI Frota |
| FR-011 documentação veículo | `api/documents` + alertas | ✅ |
| FR-012 reboques | `api/trailers` + associação à viagem | ✅ |
| FR-013 histórico veículo | GET /api/vehicles?id= (histórico completo) | ✅ |
| FR-014 estados automáticos | recomputeVehicleState (com registo) | ✅ |
| FR-015 quilometragem confiável | validação de regressão/salto com justificação | ✅ API devolve erro e pede motivo |
| FR-020..023 motoristas | `api/drivers` + elegibilidade | ✅ carta expirada bloqueia (AT-017 parcial) |
| FR-030 criar viagem | `api/trips` (todos os campos) | ✅ |
| FR-031 plano de rota | waypointsJson + versão aprovada guardada | ✅ |
| FR-032 disponibilidade/conflitos | validação antes de planear | ✅ AT-016 |
| FR-033/034 orçamento por rubrica/moeda | TripBudgetLine + computeTripBudget | ✅ gráfico orçamento vs realizado |
| FR-035 autorização de saída | bloqueio por checklist+docs+rastreador | ✅ AT-003 |
| FR-036 eventos de viagem | `api/trips/[id]/events` (13 tipos) | ✅ |
| FR-037 gestão de alterações | auditoria antes/depois em PATCH críticos | ✅ |
| FR-038 fecho operacional | request_close com pendências + close (AT-023) | ✅ |
| FR-040..044 carregador obrigatório | item sistémico bloqueante, sem bypass | ✅ AT-003 (API + UI) |
| FR-050..052 despesa + foto + GPS | `api/expenses` + `lib/client/offline.ts` | ✅ AT-008 (offline) |
| FR-053..054 categorias/combustível | 13 categorias; litros, preço, odómetro | ✅ |
| FR-055 estados despesa | 7 estados server-side | ✅ |
| FR-056 aprovar/rejeitar | verificação completa + motivo obrigatório | ✅ FIN-014 testado |
| FR-057 protecção de aprovados | sem edição/apagamento; anulação controlada (VOID) | ✅ |
| FR-058 duplicados | `detectDuplicate` (hash, valor, local, tempo) | ✅ AT-015 |
| FR-059 limites | alertas 80%/100% (FIN-011) | ✅ |
| FR-060 sem comprovativo | excepção documentada por categoria | ✅ |
| FR-065..067 adiantamentos/per diem/reconciliação | `api/advances`, `api/perdiem-rules`, reconcileTrip | ✅ |

## 7. GPS (fonte primária — REGRA FUNDAMENTAL)

| Req | Implementação | Verificação |
|---|---|---|
| GPS-001 um rastreador/veículo | GpsDevice + DeviceAssignment (histórico) | ✅ |
| GPS-002/003 posicionamento sem internet + store-and-forward | ingestão em lote com gnssTime original e seq | ✅ AT-005 |
| GPS-004/007 energia e tamper | powerEvent → alerta CRITICAL + estado NO_POWER | 🟡 depende de hardware homologado |
| GPS-005 conectividade regional | campos SIM/roaming na ficha | 🟡 homologação |
| GPS-006 instalação registada | installedAt/installedBy/notes | ✅ |
| GPS-008 interface de fornecedor | ProviderAdapter + contrato documentado | ✅ `GET /api/gps/ingest` |
| GPS-010 cadência configurável | settings gps_moving/stopped_seconds | ✅ |
| GPS-011 campos mínimos | modelo GpsPoint completo | ✅ |
| GPS-012 frescura inequívoca | LIVE/DELAYED/NO_COMMUNICATION/HISTORIC no mapa | ✅ AT-006 (unitário + visual) |
| GPS-013 histórico de trajecto | `api/gps/points` paginado | ✅ |
| GPS-014 qualidade | flags LOW_ACCURACY/IMPOSSIBLE_JUMP/IMPLAUSIBLE_SPEED | ✅ |
| GPS-015 fonte móvel secundária | fonte=MOBILE etiquetada, sem fusão | ✅ |
| GPS-020..022 mapa/geofences | Leaflet + Cercas com eventos entrada/saída | ✅ |
| GPS-023..025 paragens/ETA/velocidade | parâmetros + regras declaradas | 🟡 com telemetria real |
| GPS-026 SOS | fila offline + alerta crítico + confirmação segura | ✅ |
| GPS-027 sem dados ≠ parado | regras visíveis no mapa e painel | ✅ |

## 8. Offline (offline-first)

| Req | Implementação | Verificação |
|---|---|---|
| OFF-001..002 IndexedDB + fila UUID | `lib/client/offline.ts` | ✅ AT-008 |
| OFF-003..004 idempotência + ACK | clientUuid único + SyncRecord | ✅ AT-009 (3 envios → 1 registo) |
| OFF-005 reenvio automático | backoff + evento online | ✅ visual |
| OFF-006 estado visível | 4 estados legíveis na fila | ✅ visual |
| OFF-007..008 conflitos/revalidação | servidor revalida tudo no sync | ✅ |
| OFF-009 fotos offline | base64 comprimido no dispositivo → anexo privado | ✅ AT-011 (compressão canvas) |
| OFF-010 armazenamento | estados de erro visíveis; limpeza manual após ACK | ✅ |
| OFF-020..023 limites PWA | SW mínimo; sem promessas de 2º plano; aviso na UI | ✅ declaração honesta |

## 9–10. Financeiro, manutenção, combustível, documentos

| Req | Implementação | Verificação |
|---|---|---|
| FIN-001..005 moedas | centavos inteiros + taxa fonte/data/autor | ✅ AT-013 (ZAR 3,48 reproduzível) |
| FIN-010..016 orçamento/alçadas/fecho | computeTripBudget + fila + reconciliação | ✅ |
| §9.3 integridade documental | hash SHA-256, metadados, export auditado | ✅ AT-024 |
| MNT-001..005 manutenção | planos + OS com bloqueio crítico e libertação com prova | ✅ AT-018 |
| MNT-010/011 pneus/peças | pneus com histórico; stock expansível | ✅ (stock de peças: fase posterior, modelo preparado) |
| FUEL-001..004 combustível | abastecimentos + anomalias + consumo com pressupostos | ✅ |
| DOC-001..003 documentos | repositório + alertas + bloqueio por rota/país | ✅ AT-017 |

## 11–12. Interface, NFRs e segurança

| Req | Implementação | Verificação |
|---|---|---|
| §11.1 painel | dashboard + mapa + tabelas com pesquisa/filtros/paginação | ✅ |
| §11.2 app motorista | viagem activa, acções rápidas, estados claros | ✅ visual (viewport móvel) |
| UX-001..004 | PT-MZ, contrastes, estados visíveis, confirmação crítica (digitar SOS/REVOGAR) | ✅ |
| NFR-004 paginação/índices | take/skip + @@index nos campos quentes | ✅ |
| SEC-002..009 | ver README §6 | ✅ AT-001/AT-019 (auditoria consultável) |
| SEC-008 rate limiting | login/ingest/sync | ✅ |
| PRV-003 acesso proporcional | perfis sem gps.view; auditoria de acessos | ✅ |
| OPS-001..005 | backups manuais documentados (SQLite file copy); plano de incidente nos manuais | 🟡 operação |

## 15–16. Relatórios e aceitação

- Dashboards §15.1 implementados no Painel + Relatórios (com distinção pendente/aprovado).
- AT-001..AT-019 e AT-023/024 verificados end-to-end (API + browser). AT-004/007/021/022/025 dependem de hardware/dispositivos reais — declarados como pendentes de homologação, sem simulação apresentada como real (DEV-003).
- AT-020 (restauro) — procedimento documentado nos manuais; teste formal em ambiente controlado pelo operador.

## 17–18. Fases e entregáveis

| Fase SRS | Estado |
|---|---|
| Fase 0 — descoberta/desenho | ✅ (worklog + decisões) |
| Fase 1 — núcleo operacional | ✅ |
| Fase 2 — operação offline | ✅ |
| Fase 3 — GPS autónomo | 🟡 código + ingestão prontos; homologação de hardware pendente |
| Fase 4 — controlo financeiro/manutenção avançados | ✅ (stock de peças e integração contabilística = fase posterior) |
| Fase 5 — piloto/produção | 🟡 procedures documentados; execução pelo operador |
