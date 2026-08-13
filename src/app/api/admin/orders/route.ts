import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOrderExpired } from "@/lib/engine/orders";
import { formatNumbers } from "@/lib/numbers";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi("orders.view");
  if (auth instanceof Response) return auth;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(100, Math.max(10, parseInt(sp.get("perPage") ?? "25", 10) || 25));
  const status = sp.get("status");
  const raffleId = sp.get("raffleId");
  const search = (sp.get("q") ?? "").trim();

  const where = {
    ...(status && ["PENDING", "PAID", "EXPIRED", "CANCELLED", "REJECTED"].includes(status)
      ? { status: status as "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | "REJECTED" }
      : {}),
    ...(raffleId ? { raffleId } : {}),
    ...(search
      ? {
          OR: [
            { code: { contains: search.toUpperCase() } },
            { participant: { phone: { contains: search.replace(/\D/g, "") || search } } },
            { participant: { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        participant: { select: { name: true, phone: true } },
        raffle: { select: { title: true, digits: true } },
      },
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    perPage,
    items: orders.map((o) => ({
      id: o.id,
      code: o.code,
      raffleTitle: o.raffle.title,
      participant: o.participant,
      numbers: formatNumbers(JSON.parse(o.numbersJson), o.raffle.digits),
      quantity: o.quantity,
      total: o.total,
      status: isOrderExpired(o) ? "EXPIRED" : o.status,
      paymentMethod: o.paymentMethod,
      reservedUntil: o.reservedUntil,
      paidAt: o.paidAt,
      createdAt: o.createdAt,
    })),
  });
}
