import { prisma } from "./db";

/**
 * Auditoría de acciones administrativas críticas. Nunca rompe la operación
 * principal: si el registro falla, se reporta a consola y se continúa.
 */
export async function logAudit(params: {
  actorEmail: string;
  actorRole: string;
  action: string;
  entity: string;
  entityId?: string;
  detail?: unknown;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorEmail: params.actorEmail,
        actorRole: params.actorRole,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        detailJson: JSON.stringify(params.detail ?? {}),
      },
    });
  } catch (err) {
    console.error("No se pudo registrar auditoría:", params.action, err);
  }
}
