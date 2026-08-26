import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdminApi } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOrderExpired } from "@/lib/engine/orders";
import { formatNumbers } from "@/lib/numbers";

export const runtime = "nodejs";

/**
 * Filtro por estado. "Pendiente" y "Expirada" se calculan igual que en la
 * tarjeta del panel (isOrderExpired): una orden PENDING cuya reserva ya venció
 * se ve como expirada, así que también tiene que FILTRARSE como expirada. Si
 * no, el dueño abre "Pendientes" y le salen pedidos marcados "Expirada".
 */
function filtroDeEstado(
  estado: string | null,
  ahora: Date
): Prisma.OrderWhereInput | null {
  if (estado === "PENDING") {
    return {
      status: "PENDING",
      OR: [{ reservedUntil: null }, { reservedUntil: { gte: ahora } }],
    };
  }
  if (estado === "EXPIRED") {
    return {
      OR: [
        { status: "EXPIRED" },
        { status: "PENDING", reservedUntil: { lt: ahora } },
      ],
    };
  }
  if (estado === "PAID" || estado === "CANCELLED" || estado === "REJECTED") {
    return { status: estado };
  }
  return null;
}

/**
 * Búsqueda libre: código, nombre o teléfono.
 *
 * El teléfono SOLO se busca cuando lo tecleado parece un teléfono (puras
 * cifras y separadores). Antes se buscaba siempre por las cifras sueltas del
 * texto, así que un código como "8VEFBBVX" se reducía a "8" y devolvía todos
 * los pedidos que tuvieran un 8 en el teléfono.
 */
function filtroDeBusqueda(search: string): Prisma.OrderWhereInput | null {
  if (!search) return null;
  const digitos = search.replace(/\D/g, "");
  const pareceTelefono = digitos.length >= 3 && /^[\d\s+().-]+$/.test(search);
  const opciones: Prisma.OrderWhereInput[] = [
    { code: { contains: search.toUpperCase() } },
    { participant: { name: { contains: search, mode: "insensitive" } } },
  ];
  if (pareceTelefono) {
    opciones.push({ participant: { phone: { contains: digitos } } });
  }
  return { OR: opciones };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi("orders.view");
  if (auth instanceof Response) return auth;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(100, Math.max(10, parseInt(sp.get("perPage") ?? "25", 10) || 25));
  const status = sp.get("status");
  const raffleId = sp.get("raffleId");
  const search = (sp.get("q") ?? "").trim();

  // Cada filtro es una condición independiente y se combinan con AND: así el
  // OR del estado y el OR de la búsqueda no se pisan entre ellos.
  const condiciones: Prisma.OrderWhereInput[] = [];
  const porEstado = filtroDeEstado(status, new Date());
  if (porEstado) condiciones.push(porEstado);
  if (raffleId) condiciones.push({ raffleId });
  const porBusqueda = filtroDeBusqueda(search);
  if (porBusqueda) condiciones.push(porBusqueda);

  const where: Prisma.OrderWhereInput =
    condiciones.length > 0 ? { AND: condiciones } : {};

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
      // El estado va CRUDO. Antes se le pintaba "EXPIRED" a un pedido que en
      // la base sigue PENDING, y el panel colgaba de ese estado el boton de
      // confirmar: al dueno le desaparecia justo en el pedido de alguien que
      // pago tarde, que es cuando mas falta hace. La caducidad se manda
      // aparte para poder seguir marcandola en la lista.
      status: o.status,
      vencida: isOrderExpired(o),
      paymentMethod: o.paymentMethod,
      reservedUntil: o.reservedUntil,
      paidAt: o.paidAt,
      createdAt: o.createdAt,
    })),
  });
}
