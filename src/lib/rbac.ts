// =====================================================================
// SIGFCO — RBAC: matriz de permissões por perfil (§4, §4.1)
// A autorização é verificada NO SERVIDOR em cada chamada (§4.1): esconder
// um botão na interface não é controlo de segurança.
// =====================================================================
import type { Role } from './constantes'

// Recursos × acções. Cada endpoint do backend valida contra esta matriz.
export type Perm =
  | 'company.read' | 'company.manage'
  | 'user.read' | 'user.manage'
  | 'fleet.read' | 'fleet.manage'          // veículos, motoristas, reboques, dispositivos, documentos
  | 'trip.read' | 'trip.own' | 'trip.manage' | 'trip.close' | 'trip.reopen' | 'trip.authorize'
  | 'checklist.submit'
  | 'expense.read' | 'expense.own' | 'expense.submit' | 'expense.approve' | 'expense.void'
  | 'finance.read' | 'finance.manage'      // câmbio, adiantamentos, per diem, fecho
  | 'maintenance.read' | 'maintenance.manage'
  | 'fuel.read' | 'fuel.manage'
  | 'doc.manage'
  | 'gps.view' | 'gps.manage' | 'gps.simulate'
  | 'report.read' | 'report.export'
  | 'audit.read'
  | 'alert.handle'
  | 'settings.manage'

const ALL: Perm[] = [
  'company.read', 'company.manage', 'user.read', 'user.manage',
  'fleet.read', 'fleet.manage', 'trip.read', 'trip.manage', 'trip.close', 'trip.reopen', 'trip.authorize',
  'checklist.submit', 'expense.read', 'expense.submit', 'expense.approve', 'expense.void',
  'finance.read', 'finance.manage', 'maintenance.read', 'maintenance.manage',
  'fuel.read', 'fuel.manage', 'doc.manage', 'gps.view', 'gps.manage', 'gps.simulate',
  'report.read', 'report.export', 'audit.read', 'alert.handle', 'settings.manage',
]

// Matriz por perfil — alinhada com §4 (responsabilidades e limites):
// · Despachante NÃO aprova despesas (segregação de funções)
// · Motorista só vê a sua viagem (expense.own/trip.own), sem orçamento global
// · Mecânico não altera despesas financeiras aprovadas
// · Auditor só leitura
// · Financeiro pode não ter gps.view contínuo — por defeito tem leitura;
//   a política de acesso excepcional fica registada em auditoria (PRV-003)
const MATRIX: Record<Role, Perm[]> = {
  PLATFORM_ADMIN: ALL,
  COMPANY_ADMIN: ALL,
  FLEET_MANAGER: [
    'company.read', 'user.read', 'fleet.read', 'fleet.manage',
    'trip.read', 'trip.manage', 'trip.authorize', 'checklist.submit',
    'expense.read', 'maintenance.read', 'maintenance.manage',
    'fuel.read', 'fuel.manage', 'doc.manage', 'gps.view', 'gps.manage',
    'report.read', 'report.export', 'alert.handle',
  ],
  DISPATCHER: [
    'company.read', 'fleet.read', 'trip.read', 'trip.manage', 'trip.authorize',
    'checklist.submit', 'expense.read', 'expense.submit',
    'maintenance.read', 'fuel.read', 'doc.manage', 'gps.view', 'report.read', 'alert.handle',
  ],
  FINANCE: [
    'company.read', 'user.read', 'fleet.read', 'trip.read',
    'expense.read', 'expense.approve', 'expense.void',
    'finance.read', 'finance.manage', 'report.read', 'report.export',
    'audit.read', 'alert.handle', 'gps.view',
  ],
  DRIVER: [
    'trip.own', 'checklist.submit', 'expense.own', 'expense.submit',
    'fuel.read', 'fuel.manage',
  ],
  MECHANIC: [
    'company.read', 'fleet.read', 'maintenance.read', 'maintenance.manage',
    'trip.read', 'fuel.read', 'report.read',
  ],
  AUDITOR: [
    'company.read', 'user.read', 'fleet.read', 'trip.read',
    'expense.read', 'finance.read', 'maintenance.read', 'fuel.read',
    'gps.view', 'report.read', 'report.export', 'audit.read',
  ],
  BRANCH_MANAGER: [
    'company.read', 'user.read', 'fleet.read', 'fleet.manage',
    'trip.read', 'trip.manage', 'trip.authorize', 'checklist.submit',
    'expense.read', 'maintenance.read', 'maintenance.manage',
    'fuel.read', 'fuel.manage', 'doc.manage', 'gps.view',
    'report.read', 'report.export', 'alert.handle',
  ],
}

export function can(role: Role | string, perm: Perm): boolean {
  const list = MATRIX[role as Role]
  if (!list) return false
  return list.includes(perm)
}

export function canAny(role: Role | string, perms: Perm[]): boolean {
  return perms.some((p) => can(role, p))
}
