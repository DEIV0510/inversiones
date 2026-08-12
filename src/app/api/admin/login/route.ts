import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

export const runtime = "nodejs";

// Limitador simple en memoria: 8 intentos por IP cada 10 minutos.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * El hash bcrypt contiene "$", que dotenv-expand corrompe al leer el .env.
 * Por eso ADMIN_PASSWORD_HASH se guarda en base64; también se acepta el hash
 * plano (útil en plataformas donde las variables no pasan por dotenv).
 */
function getPasswordHash(): string {
  const raw = (process.env.ADMIN_PASSWORD_HASH || "").trim();
  if (!raw) return "";
  if (raw.startsWith("$2")) return raw;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    if (decoded.startsWith("$2")) return decoded;
  } catch {
    // No era base64 válido.
  }
  return raw;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos e intenta de nuevo." },
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
      { error: "Ingresa un correo y una contraseña válidos" },
      { status: 400 }
    );
  }

  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const passwordHash = getPasswordHash();

  if (!adminEmail || !passwordHash) {
    return NextResponse.json(
      { error: "El panel no está configurado (revisa el archivo .env)" },
      { status: 500 }
    );
  }

  // Comparación siempre en tiempo similar para no filtrar información.
  const emailOk = parsed.data.email === adminEmail;
  const passwordOk = await bcrypt.compare(parsed.data.password, passwordHash);
  await delay(350);

  if (!emailOk || !passwordOk) {
    return NextResponse.json(
      { error: "Correo o contraseña incorrectos" },
      { status: 401 }
    );
  }

  attempts.delete(ip);
  await createSession();
  return NextResponse.json({ ok: true });
}
