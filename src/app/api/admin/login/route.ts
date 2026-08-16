import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { clientIp, isRateLimited, isUnderPressure } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export const runtime = "nodejs";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Hash de relleno con el mismo coste (12 rondas) que los reales. Si el correo
 * no existe se compara contra este: así la respuesta tarda lo mismo exista o
 * no la cuenta y nadie puede averiguar qué correos son administradores
 * cronometrando los intentos. No corresponde a ninguna contraseña usable.
 */
const HASH_RELLENO =
  "$2b$12$XeTPVFENLozOLtmqO.C8QOhOBCORIojo/btmzdSkKDW2DBtbsRJK.";

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

  // Fricción constante contra fuerza bruta; se endurece si hay una oleada
  // de intentos, pero JAMÁS se niega el acceso a un administrador legítimo.
  await delay(isUnderPressure("admin.login", 40) ? 2000 : 350);

  const user = await prisma.adminUser.findUnique({
    where: { email: parsed.data.email },
  });

  // La comparación se hace SIEMPRE, aunque el correo no exista: contra el
  // hash de relleno. Si solo se comparara cuando hay usuario, la respuesta
  // sería ~300 ms más lenta para los correos que sí son administradores y
  // bastaría un cronómetro para ir descubriéndolos uno a uno.
  const coincide = await bcrypt.compare(
    parsed.data.password,
    user?.passwordHash ?? HASH_RELLENO
  );
  const valid = user != null && user.isActive && coincide;

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
