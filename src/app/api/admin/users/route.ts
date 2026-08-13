import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { adminUserSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminApi("users.manage");
  if (auth instanceof Response) return auth;
  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi("users.manage");
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  }

  const parsed = adminUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 422 }
    );
  }

  const exists = await prisma.adminUser.findUnique({
    where: { email: parsed.data.email },
  });
  if (exists) {
    return NextResponse.json(
      { error: "Ya existe un usuario con ese correo" },
      { status: 409 }
    );
  }

  const user = await prisma.adminUser.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      isActive: parsed.data.isActive,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
    },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  await logAudit({
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "user.create",
    entity: "AdminUser",
    entityId: user.id,
    detail: { email: user.email, rol: user.role },
  });

  return NextResponse.json({ user }, { status: 201 });
}
