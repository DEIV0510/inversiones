import type { AdminRole } from "@prisma/client";

/**
 * Matriz de permisos por rol. Un permiso nuevo se agrega aquí y todos los
 * guards (API y páginas) lo respetan automáticamente.
 */

export type Permission =
  | "dashboard.view"
  | "raffles.manage"
  | "numbers.view"
  | "numbers.block"
  | "participants.view"
  | "orders.view"
  | "orders.confirm"
  | "orders.cancel"
  | "reservations.view"
  | "payments.view"
  | "winners.manage"
  | "reports.view"
  | "settings.manage"
  | "users.manage"
  | "audit.view";

const ALL: AdminRole[] = ["SUPER_ADMIN", "ADMIN", "SOPORTE", "FINANZAS"];

const MATRIX: Record<Permission, AdminRole[]> = {
  "dashboard.view": ALL,
  "raffles.manage": ["SUPER_ADMIN", "ADMIN"],
  "numbers.view": ALL,
  "numbers.block": ["SUPER_ADMIN", "ADMIN", "SOPORTE"],
  "participants.view": ALL,
  "orders.view": ALL,
  "orders.confirm": ["SUPER_ADMIN", "ADMIN", "FINANZAS"],
  "orders.cancel": ["SUPER_ADMIN", "ADMIN", "FINANZAS"],
  "reservations.view": ALL,
  "payments.view": ["SUPER_ADMIN", "ADMIN", "FINANZAS"],
  "winners.manage": ["SUPER_ADMIN", "ADMIN"],
  "reports.view": ["SUPER_ADMIN", "ADMIN", "FINANZAS"],
  "settings.manage": ["SUPER_ADMIN", "ADMIN"],
  "users.manage": ["SUPER_ADMIN"],
  "audit.view": ["SUPER_ADMIN", "ADMIN"],
};

export function can(role: AdminRole, permission: Permission): boolean {
  return MATRIX[permission]?.includes(role) ?? false;
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Administrador",
  SOPORTE: "Soporte",
  FINANZAS: "Finanzas",
};
