import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { deleteImage } from "@/lib/media";
import { winnerPatchSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireAdminApi("winners.manage");
  if (auth instanceof Response) return auth;

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

  const { numberInput, ...data } = parsed.data;
  void numberInput;
  const winner = await prisma.winner.update({ where: { id }, data });

  if (
    parsed.data.photoUrl !== undefined &&
    existing.photoUrl &&
    existing.photoUrl !== parsed.data.photoUrl
  ) {
    await deleteImage(existing.photoUrl);
  }

  await logAudit({
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "winner.update",
    entity: "Winner",
    entityId: id,
  });

  return NextResponse.json({ winner });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAdminApi("winners.manage");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.winner.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "El ganador no existe" }, { status: 404 });
  }

  await prisma.winner.delete({ where: { id } });
  await deleteImage(existing.photoUrl);
  await logAudit({
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "winner.delete",
    entity: "Winner",
    entityId: id,
    detail: { rifa: existing.raffleTitle },
  });

  return NextResponse.json({ ok: true });
}
