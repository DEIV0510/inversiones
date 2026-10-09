import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/auth";
import { MAX_NUMEROS_CUADRICULA } from "@/lib/cuadricula";
import { getBoardState } from "@/lib/engine/claims";
import { getPublicRaffleBySlug, getRaffleBySlugForAdmin } from "@/lib/public";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Tablero de una rifa de CUADRÍCULA: el estado de cada número, en vivo.
 *
 * La página del sorteo lo pinta al cargar y luego lo vuelve a pedir cada
 * pocos segundos, para que un número que otra persona acaba de reservar se
 * ponga amarillo sin recargar.
 *
 * DOS CANDADOS, los dos en el servidor:
 *  1. Solo responde para rifas de cuadrícula (boardMode) de 1.000 números o
 *     menos. La rifa grande de 10.000 jamás publica su inventario: para ella
 *     esta ruta es un 404, mande lo que mande quien pregunte.
 *  2. Solo lleva el estado de cada casilla. Ni nombres, ni teléfonos, ni
 *     códigos de pedido.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ip = clientIp(req);
  // Un comprador con la página abierta pide el tablero cada 15 s (4 por
  // minuto). 60 deja margen para varias pestañas y recargas sin estorbar.
  if (
    isRateLimited("board.view", ip, {
      max: 60,
      windowMs: 60_000,
      globalMax: 3000,
    })
  ) {
    return NextResponse.json(
      { error: "Demasiadas consultas. Espera un momento." },
      { status: 429 }
    );
  }

  const { slug } = await params;
  let raffle = await getPublicRaffleBySlug(slug);
  // Vista previa: el dueño mira su rifa en borrador antes de publicarla. Para
  // cualquier otro visitante esta rifa no existe.
  if (!raffle && (await getVerifiedSession())) {
    raffle = await getRaffleBySlugForAdmin(slug);
  }
  if (
    !raffle ||
    !raffle.boardMode ||
    raffle.totalNumbers > MAX_NUMEROS_CUADRICULA
  ) {
    return NextResponse.json({ error: "Sorteo no encontrado" }, { status: 404 });
  }

  const tablero = await getBoardState(raffle.id, raffle.totalNumbers);
  return NextResponse.json(
    { tablero, total: raffle.totalNumbers, digits: raffle.digits },
    { headers: { "Cache-Control": "no-store" } }
  );
}
