import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isRowAlive } from "@/lib/engine/claims";
import { formatNumber, parseNumberInput } from "@/lib/numbers";

export const runtime = "nodejs";

/**
 * Gestión de números (admin). SIEMPRE paginado: nunca se cargan millones de
 * filas. Solo existen filas para números tomados; un número sin fila está
 * disponible (se consulta puntualmente con ?n=).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdminApi("numbers.view");
  if (auth instanceof Response) return auth;

  const sp = req.nextUrl.searchParams;
  const raffleId = sp.get("raffleId") ?? "";
  if (!raffleId) {
    return NextResponse.json({ error: "raffleId es requerido" }, { status: 422 });
  }
  const raffle = await prisma.raffle.findUnique({ where: { id: raffleId } });
  if (!raffle) {
    return NextResponse.json({ error: "La rifa no existe" }, { status: 404 });
  }

  // Consulta puntual de un número (incluye disponibles).
  const n = sp.get("n");
  if (n != null && n !== "") {
    const value = parseNumberInput(n, raffle.totalNumbers);
    if (value === null) {
      return NextResponse.json({ error: "Número fuera de rango" }, { status: 422 });
    }
    const row = await prisma.raffleNumber.findUnique({
      where: { raffleId_number: { raffleId, number: value } },
      include: {
        order: {
          include: { participant: { select: { name: true, phone: true } } },
        },
      },
    });
    const alive = row ? isRowAlive(row) : false;
    return NextResponse.json({
      single: {
        number: formatNumber(value, raffle.digits),
        value,
        status: !row || !alive ? "AVAILABLE" : row.status,
        reservedUntil: alive ? row?.reservedUntil : null,
        orderCode: alive ? row?.order?.code ?? null : null,
        participant: alive ? row?.order?.participant ?? null : null,
      },
    });
  }

  const status = sp.get("status");
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(100, Math.max(10, parseInt(sp.get("perPage") ?? "50", 10) || 50));

  const where = {
    raffleId,
    ...(status && ["RESERVED", "PAID", "BLOCKED"].includes(status)
      ? { status: status as "RESERVED" | "PAID" | "BLOCKED" }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.raffleNumber.count({ where }),
    prisma.raffleNumber.findMany({
      where,
      orderBy: { number: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
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
    digits: raffle.digits,
    items: rows.map((row) => ({
      id: row.id,
      number: formatNumber(row.number, raffle.digits),
      value: row.number,
      status: row.status,
      alive: isRowAlive(row),
      reservedUntil: row.reservedUntil,
      createdAt: row.createdAt,
      orderCode: row.order?.code ?? null,
      orderStatus: row.order?.status ?? null,
      participant: row.order?.participant ?? null,
    })),
  });
}
