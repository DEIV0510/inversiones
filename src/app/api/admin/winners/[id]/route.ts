import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { winnerPatchSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function tryDeleteUpload(photoUrl: string | null) {
  if (!photoUrl || !photoUrl.startsWith("/uploads/")) return;
  const filePath = path.join(
    process.cwd(),
    "public",
    "uploads",
    path.basename(photoUrl)
  );
  try {
    await unlink(filePath);
  } catch {
    // No crítico.
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

  const parsed = winnerPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 422 }
    );
  }

  const existing = await prisma.winner.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "El ganador no existe" }, { status: 404 });
  }

  const winner = await prisma.winner.update({ where: { id }, data: parsed.data });

  if (
    parsed.data.photoUrl !== undefined &&
    existing.photoUrl &&
    existing.photoUrl !== parsed.data.photoUrl
  ) {
    await tryDeleteUpload(existing.photoUrl);
  }

  revalidatePath("/");
  return NextResponse.json({ winner });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const existing = await prisma.winner.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "El ganador no existe" }, { status: 404 });
  }

  await prisma.winner.delete({ where: { id } });
  await tryDeleteUpload(existing.photoUrl);

  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
