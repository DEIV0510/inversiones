import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { settingsSchema } from "@/lib/validation";
import { normalizeWhatsApp } from "@/lib/whatsapp";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

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

  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
