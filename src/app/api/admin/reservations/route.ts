import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatNumber } from "@/lib/numbers";

export const runtime = "nodejs";

/** Reservas activas (números RESERVED con vigencia). */
export async function GET(req: NextRequest) {
  const auth = await requireAdminApi("reservations.view");
  if (auth instanceof Response) return auth;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(100, Math.max(10, parseInt(sp.get("perPage") ?? "50", 10) || 50));
  const raffleId = sp.get("raffleId");

  const where = {
    status: "RESERVED" as const,
    reservedUntil: { gt: new Date() },
    ...(raffleId ? { raffleId } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.raffleNumber.count({ where }),
    prisma.raffleNumber.findMany({
      where,
      orderBy: { reservedUntil: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        raffle: { select: { title: true, digits: true } },
        order: {
          include: { participant: { select: { name: true, phone: true } } },
        },
      },
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    perPage,
    items: rows.map((row) => ({
      id: row.id,
      number: formatNumber(row.number, row.raffle.digits),
      raffleTitle: row.raffle.title,
      orderCode: row.order?.code ?? null,
      participant: row.order?.participant ?? null,
      createdAt: row.createdAt,
      reservedUntil: row.reservedUntil,
    })),
  });
}
