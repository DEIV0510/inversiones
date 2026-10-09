import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MAX_NUMEROS_CUADRICULA } from "@/lib/cuadricula";
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

  // Tablero completo para el panel (rifas de CUADRÍCULA). A diferencia del
  // tablero público, este sí lleva a quién pertenece cada casilla: es la
  // tabla del dueño, desde donde marca pagos y libera reservas. Solo existe
  // para rifas de cuadrícula de 1.000 números o menos: la rifa grande sigue
  // con su lista paginada y jamás se carga entera.
  if (sp.get("grid") === "1") {
    if (!raffle.boardMode || raffle.totalNumbers > MAX_NUMEROS_CUADRICULA) {
      return NextResponse.json(
        { error: "El tablero solo existe en las rifas de cuadrícula" },
        { status: 422 }
      );
    }
    const now = new Date();
    const filas = await prisma.raffleNumber.findMany({
      where: { raffleId },
      select: {
        number: true,
        status: true,
        reservedUntil: true,
        orderId: true,
      },
    });
    const vivas = filas.filter((f) => isRowAlive(f, now));
    const idsPedidos = [
      ...new Set(vivas.map((f) => f.orderId).filter((id): id is string => !!id)),
    ];
    const pedidos = idsPedidos.length
      ? await prisma.order.findMany({
          where: { id: { in: idsPedidos } },
          select: {
            id: true,
            code: true,
            status: true,
            paymentMethod: true,
            numbersJson: true,
            quantity: true,
            total: true,
            reservedUntil: true,
            createdAt: true,
            paidAt: true,
            participant: {
              select: { name: true, phone: true, idNumber: true, city: true },
            },
          },
        })
      : [];

    // Reservas que se VENCIERON en los últimos 3 días sin que nadie marcara
    // el pago. En el tablero ya salen blancas, así que sin esta lista el
    // dueño no tenía cómo encontrar a quien pagó tarde: con reservas cortas
    // (llegó a haber rifas con 5 minutos) casi todo el que paga por Nequi
    // manda el comprobante cuando su reserva ya venció. Desde aquí se puede
    // marcar pagado: el motor recupera los números si siguen libres.
    const tomadas = new Map(vivas.map((f) => [f.number, f.orderId] as const));
    const vencidasCrudas = await prisma.order.findMany({
      where: {
        raffleId,
        createdAt: { gt: new Date(now.getTime() - 3 * 24 * 3600_000) },
        OR: [
          { status: "EXPIRED" },
          { status: "PENDING", reservedUntil: { lt: now } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        code: true,
        numbersJson: true,
        total: true,
        createdAt: true,
        reservedUntil: true,
        participant: { select: { name: true, phone: true } },
      },
    });
    const vencidas = vencidasCrudas.map((p) => {
      let valores: number[] = [];
      try {
        const crudo = JSON.parse(p.numbersJson);
        if (Array.isArray(crudo)) {
          valores = crudo.filter((v): v is number => Number.isInteger(v));
        }
      } catch {
        // numbersJson dañado: se muestra sin la lista.
      }
      valores.sort((a, b) => a - b);
      return {
        id: p.id,
        code: p.code,
        numbers: valores.map((v) => formatNumber(v, raffle.digits)),
        // Los que ya tomó OTRA persona: con alguno así, marcar pagado
        // rechazaría el pedido entero, y el panel lo dice antes.
        ocupados: valores
          .filter((v) => {
            const duenio = tomadas.get(v);
            return duenio !== undefined && duenio !== p.id;
          })
          .map((v) => formatNumber(v, raffle.digits)),
        total: p.total,
        createdAt: p.createdAt,
        reservedUntil: p.reservedUntil,
        participant: p.participant,
      };
    });

    return NextResponse.json({
      grid: {
        total: raffle.totalNumbers,
        digits: raffle.digits,
        status: raffle.status,
        vencidas,
        casillas: vivas.map((f) => ({
          value: f.number,
          status: f.status,
          orderId: f.orderId,
        })),
        pedidos: pedidos.map((p) => {
          let valores: number[] = [];
          try {
            const crudo = JSON.parse(p.numbersJson);
            if (Array.isArray(crudo)) {
              valores = crudo.filter((v): v is number => Number.isInteger(v));
            }
          } catch {
            // numbersJson dañado: se muestra el pedido sin la lista.
          }
          return {
            id: p.id,
            code: p.code,
            status: p.status,
            paymentMethod: p.paymentMethod,
            numbers: valores
              .sort((a, b) => a - b)
              .map((v) => formatNumber(v, raffle.digits)),
            quantity: p.quantity,
            total: p.total,
            reservedUntil: p.reservedUntil,
            createdAt: p.createdAt,
            paidAt: p.paidAt,
            participant: p.participant,
          };
        }),
      },
    });
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
        orderId: alive ? row?.orderId ?? null : null,
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
      orderId: row.orderId,
      orderStatus: row.order?.status ?? null,
      participant: row.order?.participant ?? null,
    })),
  });
}
