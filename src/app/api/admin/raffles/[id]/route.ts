import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { digitsForTotal } from "@/lib/numbers";
import { deleteImage } from "@/lib/media";
import { rafflePatchSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAdminApi("numbers.view");
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const raffle = await prisma.raffle.findUnique({ where: { id } });
  if (!raffle) {
    return NextResponse.json({ error: "La rifa no existe" }, { status: 404 });
  }
  return NextResponse.json({ raffle });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireAdminApi("raffles.manage");
  if (auth instanceof Response) return auth;

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

  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    const clash = await prisma.raffle.findUnique({
      where: { slug: parsed.data.slug },
    });
    if (clash) {
      return NextResponse.json(
        { error: "Ya existe un sorteo con ese slug (URL)" },
        { status: 409 }
      );
    }
  }

  // No permitir reducir el total por debajo del número más alto ya tomado.
  if (
    parsed.data.totalNumbers != null &&
    parsed.data.totalNumbers !== existing.totalNumbers
  ) {
    const highest = await prisma.raffleNumber.findFirst({
      where: { raffleId: id },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    if (highest && parsed.data.totalNumbers <= highest.number) {
      return NextResponse.json(
        {
          error: `No puedes reducir el total: ya hay números tomados hasta el ${highest.number}`,
        },
        { status: 409 }
      );
    }
  }

  const { gallery, drawsAt, ...data } = parsed.data;
  const raffle = await prisma.raffle.update({
    where: { id },
    data: {
      ...data,
      ...(drawsAt !== undefined
        ? { drawsAt: drawsAt ? new Date(drawsAt) : null }
        : {}),
      ...(gallery !== undefined ? { galleryJson: JSON.stringify(gallery) } : {}),
      ...(parsed.data.totalNumbers != null
        ? { digits: digitsForTotal(parsed.data.totalNumbers) }
        : {}),
    },
  });

  if (
    parsed.data.imageUrl !== undefined &&
    existing.imageUrl &&
    existing.imageUrl !== parsed.data.imageUrl
  ) {
    await deleteImage(existing.imageUrl);
  }

  // Cambios sensibles siempre auditados.
  const sensitive: Record<string, unknown> = {};
  if (parsed.data.pricePerNumber != null && parsed.data.pricePerNumber !== existing.pricePerNumber) {
    sensitive.precio = { antes: existing.pricePerNumber, ahora: parsed.data.pricePerNumber };
  }
  if (parsed.data.totalNumbers != null && parsed.data.totalNumbers !== existing.totalNumbers) {
    sensitive.totalNumeros = { antes: existing.totalNumbers, ahora: parsed.data.totalNumbers };
  }
  if (parsed.data.status && parsed.data.status !== existing.status) {
    sensitive.estado = { antes: existing.status, ahora: parsed.data.status };
  }
  if (parsed.data.manualProgressPct != null && parsed.data.manualProgressPct !== existing.manualProgressPct) {
    sensitive.porcentajeManual = { antes: existing.manualProgressPct, ahora: parsed.data.manualProgressPct };
  }
  await logAudit({
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "raffle.update",
    entity: "Raffle",
    entityId: raffle.id,
    detail: sensitive,
  });

  return NextResponse.json({ raffle });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAdminApi("raffles.manage");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.raffle.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "La rifa no existe" }, { status: 404 });
  }

  const orderCount = await prisma.order.count({ where: { raffleId: id } });
  if (orderCount > 0) {
    return NextResponse.json(
      {
        error:
          "Esta rifa ya tiene pedidos: no puede eliminarse. Usa el estado CANCELADA.",
      },
      { status: 409 }
    );
  }

  await prisma.raffle.delete({ where: { id } });
  await deleteImage(existing.imageUrl);
  await logAudit({
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "raffle.delete",
    entity: "Raffle",
    entityId: id,
    detail: { title: existing.title },
  });

  return NextResponse.json({ ok: true });
}
