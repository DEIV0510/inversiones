import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rafflePatchSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function tryDeleteUpload(imageUrl: string | null) {
  if (!imageUrl || !imageUrl.startsWith("/uploads/")) return;
  const fileName = path.basename(imageUrl);
  const filePath = path.join(process.cwd(), "public", "uploads", fileName);
  try {
    await unlink(filePath);
  } catch {
    // La imagen puede no existir; no es un error crítico.
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  }

  const parsed = rafflePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 422 }
    );
  }

  const existing = await prisma.raffle.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "La rifa no existe" }, { status: 404 });
  }

  const raffle = await prisma.raffle.update({ where: { id }, data: parsed.data });

  // Si se reemplazó una imagen subida, elimina el archivo anterior.
  if (
    parsed.data.imageUrl !== undefined &&
    existing.imageUrl &&
    existing.imageUrl !== parsed.data.imageUrl
  ) {
    await tryDeleteUpload(existing.imageUrl);
  }

  revalidatePath("/");
  return NextResponse.json({ raffle });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const existing = await prisma.raffle.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "La rifa no existe" }, { status: 404 });
  }

  await prisma.raffle.delete({ where: { id } });
  await tryDeleteUpload(existing.imageUrl);

  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
