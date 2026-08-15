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

  // El esquema es parcial, pero Zod rellena con sus valores por defecto todo
  // campo que no venga en la petición. Si guardáramos eso tal cual, un cambio
  // suelto (el interruptor de publicar, por ejemplo) le borraría al ganador la
  // rifa, la fecha y hasta la foto. Solo se escribe lo que el panel mandó.
  const enviado = (body ?? {}) as Record<string, unknown>;
  const tiene = (campo: string) =>
    Object.prototype.hasOwnProperty.call(enviado, campo);

  const winner = await prisma.winner.update({
    where: { id },
    data: {
      ...(tiene("raffleId") ? { raffleId: parsed.data.raffleId } : {}),
      ...(tiene("raffleTitle") ? { raffleTitle: parsed.data.raffleTitle } : {}),
      ...(tiene("participantName")
        ? { participantName: parsed.data.participantName }
        : {}),
      ...(tiene("prize") ? { prize: parsed.data.prize } : {}),
      ...(tiene("drawnAtText") ? { drawnAtText: parsed.data.drawnAtText } : {}),
      ...(tiene("photoUrl") ? { photoUrl: parsed.data.photoUrl } : {}),
      ...(tiene("isDemo") ? { isDemo: parsed.data.isDemo } : {}),
      ...(tiene("isPublished") ? { isPublished: parsed.data.isPublished } : {}),
      ...(tiene("displayOrder")
        ? { displayOrder: parsed.data.displayOrder }
        : {}),
    },
  });

  if (
    tiene("photoUrl") &&
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
