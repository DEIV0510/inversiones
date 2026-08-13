import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi("payments.view");
  if (auth instanceof Response) return auth;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(100, Math.max(10, parseInt(sp.get("perPage") ?? "25", 10) || 25));
  const status = sp.get("status");
  const provider = sp.get("provider");

  const where = {
    ...(status ? { status } : {}),
    ...(provider ? { provider } : {}),
  };

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        order: {
          include: {
            participant: { select: { name: true, phone: true } },
            raffle: { select: { title: true } },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    perPage,
    items: payments.map((p) => ({
      id: p.id,
      orderCode: p.order.code,
      raffleTitle: p.order.raffle.title,
      participant: p.order.participant,
      provider: p.provider,
      providerTxId: p.providerTxId,
      reference: p.reference,
      amount: p.amount,
      status: p.status,
      createdAt: p.createdAt,
    })),
  });
}
