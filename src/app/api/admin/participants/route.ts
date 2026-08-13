import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi("participants.view");
  if (auth instanceof Response) return auth;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(100, Math.max(10, parseInt(sp.get("perPage") ?? "25", 10) || 25));
  const search = (sp.get("q") ?? "").trim();

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search.replace(/\D/g, "") || search } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, participants] = await Promise.all([
    prisma.participant.count({ where }),
    prisma.participant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        orders: {
          select: { status: true, total: true, quantity: true },
        },
      },
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    perPage,
    items: participants.map((p) => {
      const paid = p.orders.filter((o) => o.status === "PAID");
      return {
        id: p.id,
        name: p.name,
        phone: p.phone,
        email: p.email,
        createdAt: p.createdAt,
        ordersCount: p.orders.length,
        paidOrders: paid.length,
        numbersBought: paid.reduce((s, o) => s + o.quantity, 0),
        totalSpent: paid.reduce((s, o) => s + o.total, 0),
      };
    }),
  });
}
