import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminRole } from "@prisma/client";
import { prisma } from "./db";
import { can, type Permission } from "./rbac";

const COOKIE_NAME = "dys_admin";
const SESSION_DAYS = 7;

export type AdminSession = {
  userId: string;
  email: string;
  name: string;
  role: AdminRole;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET no está configurado (mínimo 32 caracteres) en .env");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(user: {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}): Promise<void> {
  const token = await new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setSubject(user.id)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Sesión del token (sin tocar DB). Null si no hay sesión válida. */
export async function getSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || !payload.role) return null;
    return {
      userId: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: payload.role as AdminRole,
    };
  } catch {
    return null;
  }
}

/**
 * Sesión verificada contra la base de datos (usuario existente y activo).
 * Para páginas del panel y APIs admin: un usuario desactivado pierde acceso
 * de inmediato aunque su token siga vigente.
 */
export async function getVerifiedSession(): Promise<AdminSession | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.adminUser.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  return { userId: user.id, email: user.email, name: user.name, role: user.role };
}

/**
 * Guard de páginas del panel. Los layouts de Next no se re-ejecutan en
 * navegaciones suaves: CADA página debe llamar esto. Devuelve la sesión.
 */
export async function requirePanelAuth(
  permission?: Permission
): Promise<AdminSession> {
  const session = await getVerifiedSession();
  if (!session) redirect("/admin/login");
  if (permission && !can(session.role, permission)) redirect("/admin");
  return session;
}

/**
 * Guard de route handlers del API admin.
 * Uso: const auth = await requireAdminApi("orders.confirm");
 *      if (auth instanceof Response) return auth;
 */
export async function requireAdminApi(
  permission?: Permission
): Promise<AdminSession | Response> {
  const session = await getVerifiedSession();
  if (!session) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  if (permission && !can(session.role, permission)) {
    return Response.json(
      { error: "No tienes permiso para esta acción" },
      { status: 403 }
    );
  }
  return session;
}
