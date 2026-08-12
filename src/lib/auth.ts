import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "dys_admin";
const SESSION_DAYS = 7;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET no está configurado (mínimo 32 caracteres) en .env");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(): Promise<void> {
  const token = await new SignJWT({ role: "admin" })
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

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.role === "admin";
  } catch {
    return false;
  }
}

/** Guard para route handlers del API admin. Devuelve null si la sesión es válida. */
export async function requireAdmin(): Promise<Response | null> {
  if (await isAuthenticated()) return null;
  return Response.json({ error: "No autorizado" }, { status: 401 });
}

/**
 * Guard para las páginas del panel. Los layouts de Next no se re-ejecutan en
 * navegaciones suaves, por lo que CADA página del panel debe verificar la
 * sesión por sí misma antes de consultar datos.
 */
export async function requirePanelAuth(): Promise<void> {
  if (!(await isAuthenticated())) redirect("/admin/login");
}
