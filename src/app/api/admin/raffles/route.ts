import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { digitsForTotal } from "@/lib/numbers";
import { raffleSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminApi("numbers.view");
  if (auth instanceof Response) return auth;

  const raffles = await prisma.raffle.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ raffles });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi("raffles.manage");
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  }

  const parsed = raffleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 422 }
    );
  }

  const exists = await prisma.raffle.findUnique({
    where: { slug: parsed.data.slug },
  });
  if (exists) {
    return NextResponse.json(
      { error: "Ya existe un sorteo con ese slug (URL)" },
      { status: 409 }
    );
  }

  const { gallery, drawsAt, digits, ticketPacks, prizes, prizedNumbers, ...data } =
    parsed.data;

  // Las cifras las decide el administrador; si no las envía, se derivan del
  // total. Deben alcanzar para representar el número más alto.
  const finalDigits = digits ?? digitsForTotal(parsed.data.totalNumbers);
  if (Math.pow(10, finalDigits) < parsed.data.totalNumbers) {
    return NextResponse.json(
      {
        error: `Con ${finalDigits} cifras solo caben ${Math.pow(10, finalDigits).toLocaleString("es-CO")} números. Sube las cifras o baja la cantidad.`,
      },
      { status: 422 }
    );
  }

  const raffle = await prisma.raffle.create({
    data: {
      ...data,
      drawsAt: drawsAt ? new Date(drawsAt) : null,
      galleryJson: JSON.stringify(gallery),
      digits: finalDigits,
      ticketPacksJson: JSON.stringify(ticketPacks),
      prizesJson: JSON.stringify(prizes),
      ...(prizedNumbers.length > 0
        ? {
            prizedNumbers: {
              create: prizedNumbers.map((p) => ({
                number: p.number,
                prize: p.prize,
              })),
            },
          }
        : {}),
    },
  });

  await logAudit({
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "raffle.create",
    entity: "Raffle",
    entityId: raffle.id,
    detail: { title: raffle.title, totalNumbers: raffle.totalNumbers },
  });

  return NextResponse.json({ raffle }, { status: 201 });
}
