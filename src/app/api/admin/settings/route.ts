import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminApi } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { invalidarEtiquetas, TAG_AJUSTES } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { correoConfigurado } from "@/lib/email";
import { settingsSchema } from "@/lib/validation";
import { normalizeWhatsApp } from "@/lib/whatsapp";

export const runtime = "nodejs";

/**
 * Estado del correo automático para el panel: lo guardado en Configuración y
 * si el entorno tiene de verdad la clave del proveedor. Sin clave no sale
 * ningún correo, y el formulario lo dice tal cual.
 */
export async function GET() {
  const auth = await requireAdminApi("settings.manage");
  if (auth instanceof Response) return auth;

  const rows = await prisma.setting.findMany({
    where: { key: { in: ["email_enabled", "email_from"] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value.trim()]));

  return NextResponse.json({
    // Solo un "0" explícito apaga el envío; por defecto está activo.
    email_enabled: map.get("email_enabled") === "0" ? "0" : "1",
    email_from: map.get("email_from") ?? "",
    proveedorListo: correoConfigurado(),
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminApi("settings.manage");
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 422 }
    );
  }

  const data = { ...parsed.data };
  if (data.whatsapp_number !== undefined) {
    const normalized = normalizeWhatsApp(data.whatsapp_number);
    if (!normalized) {
      return NextResponse.json(
        {
          error:
            "Número de WhatsApp no válido. Usa el formato 3106930187 o 573106930187.",
        },
        { status: 422 }
      );
    }
    data.whatsapp_number = normalized;
  }

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  await logAudit({
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "settings.update",
    entity: "Setting",
    detail: Object.keys(data),
  });

  // La Configuración se ve por toda la portada cacheada: nombre, WhatsApp,
  // ciudad, redes y el aviso de demostración. Se regenera con los ajustes ya
  // guardados.
  revalidatePath("/");
  // Y la lee la plantilla raíz, así que sale en TODAS las páginas del sitio
  // (cabecera, pie y barra inferior de la página del sorteo incluidas). Al
  // invalidar la etiqueta, la siguiente carga de cualquiera de ellas ya
  // muestra lo recién guardado.
  invalidarEtiquetas(TAG_AJUSTES);

  return NextResponse.json({ ok: true });
}
