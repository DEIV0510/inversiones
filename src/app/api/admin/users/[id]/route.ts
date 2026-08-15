import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { adminUserPatchSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Garantiza que siempre quede al menos un SUPER_ADMIN activo. */
async function wouldRemoveLastSuperAdmin(
  targetId: string,
  changes: { role?: string; isActive?: boolean }
): Promise<boolean> {
  const target = await prisma.adminUser.findUnique({ where: { id: targetId } });
  if (!target || target.role !== "SUPER_ADMIN" || !target.isActive) return false;
  const losesSuper =
    (changes.role != null && changes.role !== "SUPER_ADMIN") ||
    changes.isActive === false;
  if (!losesSuper) return false;
  const others = await prisma.adminUser.count({
    where: { role: "SUPER_ADMIN", isActive: true, NOT: { id: targetId } },
  });
  return others === 0;
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireAdminApi("users.manage");
  if (auth instanceof Response) return auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  }

  const parsed = adminUserPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 422 }
    );
  }

  const objetivo = await prisma.adminUser.findUnique({ where: { id } });
  if (!objetivo) {
    return NextResponse.json({ error: "El usuario no existe" }, { status: 404 });
  }

  // Nadie puede degradarse ni desactivarse a sí mismo. Ojo: el formulario
  // manda siempre el rol, así que solo se bloquea cuando el rol CAMBIA de
  // verdad; si no, nadie podría corregir su propio nombre o contraseña.
  const cambiaRol = parsed.data.role != null && parsed.data.role !== objetivo.role;
  if (id === auth.userId && (cambiaRol || parsed.data.isActive === false)) {
    return NextResponse.json(
      { error: "No puedes cambiar tu propio rol ni desactivarte" },
      { status: 409 }
    );
  }
  if (await wouldRemoveLastSuperAdmin(id, parsed.data)) {
    return NextResponse.json(
      { error: "Debe quedar al menos un Super admin activo" },
      { status: 409 }
    );
  }

  // El esquema es parcial, pero Zod rellena con su valor por defecto todo
  // campo ausente: guardarlo tal cual reactivaría una cuenta desactivada al
  // cambiarle cualquier otro dato. Solo se escribe lo que el panel mandó.
  const enviado = (body ?? {}) as Record<string, unknown>;
  const tiene = (campo: string) =>
    Object.prototype.hasOwnProperty.call(enviado, campo);
  const { password } = parsed.data;

  const user = await prisma.adminUser.update({
    where: { id },
    data: {
      ...(tiene("email") ? { email: parsed.data.email } : {}),
      ...(tiene("name") ? { name: parsed.data.name } : {}),
      ...(tiene("role") ? { role: parsed.data.role } : {}),
      ...(tiene("isActive") ? { isActive: parsed.data.isActive } : {}),
      ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
    },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  await logAudit({
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "user.update",
    entity: "AdminUser",
    entityId: id,
    detail: { cambios: Object.keys(enviado) },
  });

  return NextResponse.json({ user });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAdminApi("users.manage");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  if (id === auth.userId) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propia cuenta" },
      { status: 409 }
    );
  }
  if (await wouldRemoveLastSuperAdmin(id, { isActive: false })) {
    return NextResponse.json(
      { error: "Debe quedar al menos un Super admin activo" },
      { status: 409 }
    );
  }

  const existing = await prisma.adminUser.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "El usuario no existe" }, { status: 404 });
  }

  await prisma.adminUser.delete({ where: { id } });
  await logAudit({
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "user.delete",
    entity: "AdminUser",
    entityId: id,
    detail: { email: existing.email },
  });

  return NextResponse.json({ ok: true });
}
