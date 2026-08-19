import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  invalidarEtiquetas,
  TAG_RIFAS,
  tagRifa,
  tagRifaId,
} from "@/lib/cache-tags";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const blockSchema = z.object({
  raffleId: z.string().min(1),
  from: z.number().int().min(0),
  to: z.number().int().min(0).optional(),
  action: z.enum(["block", "unblock"]),
});

const RANGE_CAP = 1000;

/** Bloquear/desbloquear números o rangos (máx 1000 por operación). */
export async function POST(req: NextRequest) {
  const auth = await requireAdminApi("numbers.block");
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  }

  const parsed = blockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 422 }
    );
  }

  const { raffleId, from, action } = parsed.data;
  const to = parsed.data.to ?? from;
  if (to < from) {
    return NextResponse.json({ error: "Rango no válido" }, { status: 422 });
  }
  if (to - from + 1 > RANGE_CAP) {
    return NextResponse.json(
      { error: `Máximo ${RANGE_CAP} números por operación` },
      { status: 422 }
    );
  }

  const raffle = await prisma.raffle.findUnique({ where: { id: raffleId } });
  if (!raffle) {
    return NextResponse.json({ error: "La rifa no existe" }, { status: 404 });
  }
  if (from >= raffle.totalNumbers || to >= raffle.totalNumbers) {
    return NextResponse.json({ error: "Número fuera de rango" }, { status: 422 });
  }

  const numbers = Array.from({ length: to - from + 1 }, (_, i) => from + i);

  if (action === "block") {
    // Solo bloquea números libres: jamás pisa reservas ni ventas.
    const result = await prisma.$transaction(async (tx) => {
      await tx.raffleNumber.deleteMany({
        where: {
          raffleId,
          number: { in: numbers },
          status: "RESERVED",
          reservedUntil: { lt: new Date() },
        },
      });
      return tx.raffleNumber.createMany({
        data: numbers.map((number) => ({
          raffleId,
          number,
          status: "BLOCKED" as const,
        })),
        skipDuplicates: true,
      });
    });
    await logAudit({
      actorEmail: auth.email,
      actorRole: auth.role,
      action: "number.block",
      entity: "Raffle",
      entityId: raffleId,
      detail: { desde: from, hasta: to, bloqueados: result.count },
    });
    // Bloquear números cambia el bombo de esta rifa. La disponibilidad se
    // pregunta siempre en vivo (esa no se cachea nunca), pero se invalidan
    // igual las consultas cacheadas de la rifa: así ninguna pantalla queda
    // apoyada en una lectura anterior al bloqueo. Va después de la
    // transacción y solo cuando ya se escribió.
    invalidarEtiquetas(TAG_RIFAS, tagRifa(raffle.slug), tagRifaId(raffleId));
    return NextResponse.json({
      ok: true,
      blocked: result.count,
      skipped: numbers.length - result.count,
    });
  }

  const result = await prisma.raffleNumber.deleteMany({
    where: { raffleId, number: { in: numbers }, status: "BLOCKED" },
  });
  await logAudit({
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "number.unblock",
    entity: "Raffle",
    entityId: raffleId,
    detail: { desde: from, hasta: to, desbloqueados: result.count },
  });
  // Mismo motivo que al bloquear: los números vuelven al bombo.
  invalidarEtiquetas(TAG_RIFAS, tagRifa(raffle.slug), tagRifaId(raffleId));
  return NextResponse.json({ ok: true, unblocked: result.count });
}
