import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOrderExpired } from "@/lib/engine/orders";
import { formatNumbers } from "@/lib/numbers";

export const runtime = "nodejs";
export const maxDuration = 60;

function csvCell(value: unknown): string {
  let s = String(value ?? "");
  // Neutraliza inyección de fórmulas: Excel/LibreOffice evalúan las celdas
  // que empiezan por = + - @ (o tab/CR) aunque vayan entrecomilladas, y el
  // nombre lo escribe el público al comprar.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Exportación CSV de pedidos (con filtros). */
export async function GET(req: NextRequest) {
  const auth = await requireAdminApi("reports.view");
  if (auth instanceof Response) return auth;

  const sp = req.nextUrl.searchParams;
  const raffleId = sp.get("raffleId");
  const status = sp.get("status");

  const orders = await prisma.order.findMany({
    where: {
      ...(raffleId ? { raffleId } : {}),
      ...(status && ["PENDING", "PAID", "EXPIRED", "CANCELLED", "REJECTED"].includes(status)
        ? { status: status as "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | "REJECTED" }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 10000,
    include: {
      participant: true,
      raffle: { select: { title: true, digits: true } },
    },
  });

  const header = [
    "codigo",
    "rifa",
    "participante",
    "telefono",
    "email",
    "numeros",
    "cantidad",
    "total",
    "estado",
    "metodo_pago",
    "creado",
    "pagado",
  ].join(";");

  const rows = orders.map((o) =>
    [
      csvCell(o.code),
      csvCell(o.raffle.title),
      csvCell(o.participant.name),
      csvCell(o.participant.phone),
      csvCell(o.participant.email ?? ""),
      csvCell(formatNumbers(JSON.parse(o.numbersJson), o.raffle.digits).join(" ")),
      o.quantity,
      o.total,
      isOrderExpired(o) ? "EXPIRED" : o.status,
      o.paymentMethod ?? "",
      o.createdAt.toISOString(),
      o.paidAt?.toISOString() ?? "",
    ].join(";")
  );

  const csv = "﻿" + [header, ...rows].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pedidos-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
