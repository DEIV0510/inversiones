import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminApi } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi("raffles.manage");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const original = await prisma.raffle.findUnique({ where: { id } });
  if (!original) {
    return NextResponse.json({ error: "La rifa no existe" }, { status: 404 });
  }

  // Los números premiados también son configuración de la rifa: la copia sale
  // con la misma lista, sin heredar lo ya reclamado del original.
  const premiados = await prisma.prizedNumber.findMany({
    where: { raffleId: id },
    select: { number: true, prize: true },
    orderBy: { number: "asc" },
  });

  let slug = `${original.slug}-copia`;
  for (let i = 2; await prisma.raffle.findUnique({ where: { slug } }); i++) {
    slug = `${original.slug}-copia-${i}`;
  }

  // La copia se lleva TODA la configuración del original: si no, el dueño
  // duplica una rifa sin WhatsApp o de solo azar y la copia le sale con los
  // valores de fábrica sin avisarle. Lo único que no se hereda es el estado
  // (nace en borrador) y lo vendido (contadores, números y pedidos).
  const copy = await prisma.raffle.create({
    data: {
      slug,
      title: `${original.title} (copia)`,
      description: original.description,
      prize: original.prize,
      imageUrl: original.imageUrl,
      galleryJson: original.galleryJson,
      pricePerNumber: original.pricePerNumber,
      totalNumbers: original.totalNumbers,
      digits: original.digits,
      startsAt: original.startsAt,
      drawsAt: original.drawsAt,
      drawDateText: original.drawDateText,
      status: "DRAFT",
      progressMode: original.progressMode,
      manualProgressPct: original.manualProgressPct,
      reservationMinutes: original.reservationMinutes,
      minNumbersPerOrder: original.minNumbersPerOrder,
      maxNumbersPerOrder: original.maxNumbersPerOrder,
      terms: original.terms,
      displayOrder: original.displayOrder + 1,
      selectionMode: original.selectionMode,
      whatsappCheckout: original.whatsappCheckout,
      showPrize: original.showPrize,
      showDrawDate: original.showDrawDate,
      imageAspect: original.imageAspect,
      ticketPacksJson: original.ticketPacksJson,
      prizesJson: original.prizesJson,
      ...(premiados.length > 0
        ? { prizedNumbers: { create: premiados } }
        : {}),
    },
  });

  await logAudit({
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "raffle.duplicate",
    entity: "Raffle",
    entityId: copy.id,
    detail: { desde: original.id, titulo: copy.title },
  });

  // La copia nace en borrador, así que hoy no sale en la portada; se marca
  // igualmente para regenerar porque la portada está cacheada y así el listado
  // público nunca depende de en qué estado nazca la copia.
  revalidatePath("/");

  return NextResponse.json({ raffle: copy }, { status: 201 });
}
