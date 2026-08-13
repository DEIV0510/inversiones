import { NextRequest, NextResponse } from "next/server";
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

  let slug = `${original.slug}-copia`;
  for (let i = 2; await prisma.raffle.findUnique({ where: { slug } }); i++) {
    slug = `${original.slug}-copia-${i}`;
  }

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
      drawDateText: original.drawDateText,
      status: "DRAFT",
      progressMode: original.progressMode,
      reservationMinutes: original.reservationMinutes,
      maxNumbersPerOrder: original.maxNumbersPerOrder,
      terms: original.terms,
      displayOrder: original.displayOrder + 1,
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

  return NextResponse.json({ raffle: copy }, { status: 201 });
}
