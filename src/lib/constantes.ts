// =====================================================================
// SIGFCO - Constantes de negócio (estados, categorias, perfis, rótulos)
// Sem enums Prisma: valores controlados aqui, com rótulos PT-MZ.
// =====================================================================

export const ROLES = [
  'PLATFORM_ADMIN', 'COMPANY_ADMIN', 'FLEET_MANAGER', 'DISPATCHER',
  'FINANCE', 'DRIVER', 'MECHANIC', 'AUDITOR', 'BRANCH_MANAGER',
] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  PLATFORM_ADMIN: 'Administrador da plataforma',
  COMPANY_ADMIN: 'Administrador da empresa',
  FLEET_MANAGER: 'Gestor de frota',
  DISPATCHER: 'Despachante / Operações',
  FINANCE: 'Financeiro',
  DRIVER: 'Motorista',
  MECHANIC: 'Mecânico / Oficina',
  AUDITOR: 'Auditor / Leitura',
  BRANCH_MANAGER: 'Gestor de filial',
}

// ------------------------- Estados de viagem ------------------
export const TRIP_STATUS = [
  'DRAFT', 'PLANNED', 'AWAITING_CHECKLIST', 'AUTHORIZED_DEPARTURE',
  'IN_TRANSIT', 'PAUSED', 'ARRIVED', 'AWAITING_RECONCILIATION',
  'CLOSED', 'CANCELLED',
] as const
export type TripStatus = (typeof TRIP_STATUS)[number]

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  DRAFT: 'Rascunho',
  PLANNED: 'Planeada',
  AWAITING_CHECKLIST: 'A aguardar checklist',
  AUTHORIZED_DEPARTURE: 'Autorizada para partida',
  IN_TRANSIT: 'Em trânsito',
  PAUSED: 'Em pausa / retida',
  ARRIVED: 'Chegada registada',
  AWAITING_RECONCILIATION: 'A aguardar reconciliação',
  CLOSED: 'Fechada',
  CANCELLED: 'Cancelada',
}

// Estados activos para conflito de recursos
export const TRIP_ACTIVE_STATUSES: TripStatus[] = [
  'PLANNED', 'AWAITING_CHECKLIST', 'AUTHORIZED_DEPARTURE',
  'IN_TRANSIT', 'PAUSED', 'ARRIVED', 'AWAITING_RECONCILIATION',
]

// ------------------------- Estados de veículo -----------------
export const VEHICLE_STATUS = [
  'AVAILABLE', 'RESERVED', 'IN_TRANSIT', 'MAINTENANCE', 'INACTIVE', 'BLOCKED',
] as const
export type VehicleStatus = (typeof VEHICLE_STATUS)[number]

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  AVAILABLE: 'Disponível',
  RESERVED: 'Reservado / Planeado',
  IN_TRANSIT: 'Em trânsito',
  MAINTENANCE: 'Em manutenção',
  INACTIVE: 'Inactivo',
  BLOCKED: 'Bloqueado por segurança',
}

// ------------------------- Estados de despesa ---------------
export const EXPENSE_STATUS = [
  'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED',
  'RECONCILED', 'VOID',
] as const
export type ExpenseStatus = (typeof EXPENSE_STATUS)[number]

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  SUBMITTED: 'Submetida / pendente de aprovação',
  IN_REVIEW: 'Em revisão',
  APPROVED: 'Aprovada',
  REJECTED: 'Rejeitada',
  RETURNED: 'Devolvida para correcção',
  RECONCILIATED: 'Reconciliada',
  RECONCILED: 'Reconciliada',
  VOID: 'Anulada',
} as Record<string, string>

// ------------------------- Categorias de despesa ------------
export const EXPENSE_CATEGORIES = [
  'combustivel', 'portagens', 'per_diem', 'alfandega', 'estacionamento',
  'manutencao_emergencia', 'pneus', 'lavagem', 'comunicacao', 'alojamento',
  'alimentacao', 'taxas_locais', 'outros',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  combustivel: 'Combustível',
  portagens: 'Portagens',
  per_diem: 'Per diem / ajuda de custo',
  alfandega: 'Alfândega / fronteira',
  estacionamento: 'Estacionamento',
  manutencao_emergencia: 'Manutenção de emergência',
  pneus: 'Pneus',
  lavagem: 'Lavagem',
  comunicacao: 'Comunicação',
  alojamento: 'Alojamento',
  alimentacao: 'Alimentação',
  taxas_locais: 'Taxas locais',
  outros: 'Outros justificados',
}

// ------------------------- Eventos de viagem ----------------
export const TRIP_EVENT_TYPES = [
  'DEPARTURE', 'ARRIVAL', 'CHECKPOINT', 'BORDER', 'PAUSE_START', 'PAUSE_END',
  'DELAY', 'DEVIATION', 'DRIVER_CHANGE', 'VEHICLE_CHANGE', 'LOAD', 'UNLOAD',
  'SOS', 'OTHER',
] as const
export type TripEventType = (typeof TRIP_EVENT_TYPES)[number]

export const TRIP_EVENT_LABELS: Record<TripEventType, string> = {
  DEPARTURE: 'Partida',
  ARRIVAL: 'Chegada',
  CHECKPOINT: 'Checkpoint',
  BORDER: 'Fronteira',
  PAUSE_START: 'Início de pausa',
  PAUSE_END: 'Fim de pausa',
  DELAY: 'Atraso',
  DEVIATION: 'Desvio de rota',
  DRIVER_CHANGE: 'Mudança de motorista',
  VEHICLE_CHANGE: 'Mudança de veículo',
  LOAD: 'Carregamento',
  UNLOAD: 'Descarga',
  SOS: 'SOS - pedido de ajuda',
  OTHER: 'Outro',
}

// ------------------------- Alertas ---------------------------
export const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'INFO'] as const
export type Severity = (typeof SEVERITIES)[number]

export const SEVERITY_LABELS: Record<Severity, string> = {
  CRITICAL: 'Crítico',
  HIGH: 'Alto',
  MEDIUM: 'Médio',
  INFO: 'Informativo',
}

// ------------------------- GPS ---------------------------------------
// Fonte de posição: TRACKER é a primária; MOBILE é
// complementar; SIMULATOR é DEMO e nunca apresentada como real.
export const GPS_SOURCES = ['TRACKER', 'MOBILE', 'SIMULATOR'] as const
export type GpsSource = (typeof GPS_SOURCES)[number]

export const GPS_SOURCE_LABELS: Record<GpsSource, string> = {
  TRACKER: 'Rastreador dedicado',
  MOBILE: 'Telemóvel (complementar)',
  SIMULATOR: 'Simulador - DEMO',
}

// Frescura do último ponto
export type Freshness = 'LIVE' | 'DELAYED' | 'NO_COMMUNICATION' | 'HISTORIC'
export const FRESHNESS_LABELS: Record<Freshness, string> = {
  LIVE: 'Actualizado',
  DELAYED: 'Atrasado',
  NO_COMMUNICATION: 'Sem comunicação',
  HISTORIC: 'Histórico',
}

export const DEVICE_STATUS = [
  'OPERATIONAL', 'NO_NETWORK', 'NO_POWER', 'TAMPER_ALERT', 'OFFLINE', 'INACTIVE',
] as const
export type DeviceStatus = (typeof DEVICE_STATUS)[number]

export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  OPERATIONAL: 'Operacional',
  NO_NETWORK: 'Sem rede (a guardar localmente)',
  NO_POWER: 'Sem alimentação',
  TAMPER_ALERT: 'Alerta de manipulação',
  OFFLINE: 'Offline',
  INACTIVE: 'Inactivo',
}

// ------------------------- Moedas --------------------------
export const CURRENCIES = ['MZN', 'USD', 'ZAR', 'ZWG', 'MWK', 'ZMW', 'CDF'] as const
export type Currency = (typeof CURRENCIES)[number]

export const CURRENCY_LABELS: Record<Currency, string> = {
  MZN: 'Metical (MZN)', USD: 'Dólar (USD)', ZAR: 'Rand (ZAR)',
  ZWG: 'ZiG (ZWG)', MWK: 'Kwacha (MWK)', ZMW: 'Kwacha Zâmbia (ZMW)',
  CDF: 'Franco Congolês (CDF)',
}

// ------------------------- Tipos de documento ------------------------
export const DOCUMENT_TYPES = [
  'seguro', 'inspecao', 'licenca', 'autorizacao_transfronteira',
  'carta_conducao', 'tala', 'aduaneiro', 'certificado_carga', 'outro',
] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  seguro: 'Seguro', inspecao: 'Inspecção', licenca: 'Licença',
  autorizacao_transfronteira: 'Autorização transfronteiriça',
  carta_conducao: 'Carta de condução', tala: 'Tala / matrícula',
  aduaneiro: 'Documento aduaneiro', certificado_carga: 'Certificado de carga',
  outro: 'Outro',
}

// ------------------------- Outros ------------------------------------
export const TRIP_EVENT_TYPE_LIST = TRIP_EVENT_TYPES
export const INCIDENT_TYPES = ['ACIDENTE', 'AVARIA', 'RETENCAO', 'ROUBO', 'PERDA_CARGA', 'OUTRO'] as const
export const INCIDENT_TYPE_LABELS: Record<string, string> = {
  ACIDENTE: 'Acidente', AVARIA: 'Avaria', RETENCAO: 'Retenção',
  ROUBO: 'Roubo', PERDA_CARGA: 'Perda de carga', OUTRO: 'Outro',
}

// Chave do item sistémico do carregador
export const CHARGER_ITEM_KEY = 'carregador_telemovel'
export const GPS_ITEM_KEY = 'rastreador_operacional'
export const PHONE_HOLDER_KEY = 'suporte_telemovel'

export const TRIP_ACTIVE = TRIP_ACTIVE_STATUSES
