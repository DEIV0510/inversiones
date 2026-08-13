import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export const runtime = "nodejs";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (
    isRateLimited("admin.login", ip, {
      max: 8,
      windowMs: 10 * 60_000,
      globalMax: 40,
    })
  ) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 422 }
    );
  }

  await delay(350); // fricción constante contra fuerza bruta

  const user = await prisma.adminUser.findUnique({
    where: { email: parsed.data.email },
  });

  const valid =
    user != null &&
    user.isActive &&
    (await bcrypt.compare(parsed.data.password, user.passwordHash));

  if (!user || !valid) {
    return NextResponse.json(
      { error: "Correo o contraseña incorrectos" },
      { status: 401 }
    );
  }

  await createSession(user);
  await prisma.adminUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await logAudit({
    actorEmail: user.email,
    actorRole: user.role,
    action: "auth.login",
    entity: "AdminUser",
    entityId: user.id,
  });

  return NextResponse.json({ ok: true });
}
