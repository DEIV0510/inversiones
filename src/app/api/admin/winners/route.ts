import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminApi } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { formatNumber, parseNumberInput } from "@/lib/numbers";
import { winnerSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminApi("winners.manage");
  if (auth instanceof Response) return auth;
  const winners = await prisma.winner.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ winners });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi("winners.manage");
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  }

  const parsed = winnerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 422 }
    );
  }

  const { numberInput, ...data } = parsed.data;
  let numberValue: number | null = null;
  let numberFormatted: string | null = null;
  let participantId: string | null = null;
  let participantName = data.participantName;

  // Si hay rifa + número, se resuelve el comprador real del número.
  if (data.raffleId && numberInput) {
    const raffle = await prisma.raffle.findUnique({ where: { id: data.raffleId } });
    if (!raffle) {
      return NextResponse.json({ error: "La rifa no existe" }, { status: 404 });
    }
    const value = parseNumberInput(numberInput, raffle.totalNumbers);
    if (value === null) {
      return NextResponse.json({ error: "Número fuera de rango" }, { status: 422 });
    }
    numberValue = value;
    numberFormatted = formatNumber(value, raffle.digits);
    const row = await prisma.raffleNumber.findUnique({
      where: { raffleId_number: { raffleId: raffle.id, number: value } },
      include: {
        order: { include: { participant: true } },
      },
    });
    if (row?.status === "PAID" && row.order) {
      participantId = row.order.participantId;
      participantName = row.order.participant.name;
    }
  }

  const winner = await prisma.winner.create({
    data: {
      raffleId: data.raffleId,
      raffleTitle: data.raffleTitle,
      numberValue,
      numberFormatted,
      participantId,
      participantName,
      prize: data.prize,
      drawnAtText: data.drawnAtText,
      photoUrl: data.photoUrl,
      isDemo: data.isDemo,
      isPublished: data.isPublished,
      displayOrder: data.displayOrder,
    },
  });

  await logAudit({
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "winner.create",
    entity: "Winner",
    entityId: winner.id,
    detail: { rifa: winner.raffleTitle, numero: winner.numberFormatted },
  });

  // La portada cacheada lleva la sección de ganadores publicados.
  revalidatePath("/");

  return NextResponse.json({ winner }, { status: 201 });
}
