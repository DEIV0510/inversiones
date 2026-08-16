import { NextRequest, NextResponse } from "next/server";
import { formatNumber, parseNumberInput } from "@/lib/numbers";
import {
  buscarDuenoDeNumero,
  buscarPremioDeNumero,
  getPublicRaffleBySlug,
} from "@/lib/public";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * ¿QUIÉN GANÓ? — dueño de un número concreto.
 *
 * El día del sorteo sale el número de la lotería, se teclea aquí y se ve a
 * quién le pertenece. Dos condiciones innegociables:
 *
 *  1. Privacidad: se devuelve el nombre ABREVIADO y el teléfono ENMASCARADO,
 *     nunca el correo ni la cédula. Los datos completos están en el panel.
 *  2. Inventario: solo se informa de números VENDIDOS. Si no lo está, se
 *     responde lo mismo tanto si está libre como si está apartado o
 *     bloqueado — al público jamás se le cuenta el estado del inventario.
 *
 * Límite de intentos estricto: sin él, cualquiera sacaría la lista completa
 * de compradores probando números uno por uno.
 */
export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  if (
    isRateLimited("winner.lookup", ip, {
      max: 20,
      windowMs: 10 * 60_000,
      globalMax: 400,
    })
  ) {
    return NextResponse.json(
      { error: "Demasiadas consultas. Espera unos minutos." },
      { status: 429 }
    );
  }

  const slug = (req.nextUrl.searchParams.get("slug") ?? "").trim();
  // getPublicRaffleBySlug filtra por estado: los borradores no se consultan.
  const raffle = slug ? await getPublicRaffleBySlug(slug) : null;
  if (!raffle) {
    return NextResponse.json({ error: "Sorteo no encontrado" }, { status: 404 });
  }

  const consulta = req.nextUrl.searchParams.get("n") ?? "";
  const valor = parseNumberInput(consulta, raffle.totalNumbers);
  if (valor === null) {
    return NextResponse.json(
      {
        error: `Ingresa un número entre ${formatNumber(0, raffle.digits)} y ${formatNumber(
          raffle.totalNumbers - 1,
          raffle.digits
        )}`,
      },
      { status: 422 }
    );
  }

  const dueno = await buscarDuenoDeNumero(raffle.id, valor);
  // El premio solo acompaña a un número con dueño. Si no lo tiene, la
  // respuesta no dice absolutamente nada más sobre ese número.
  const premio = dueno ? await buscarPremioDeNumero(raffle.id, valor) : null;

  return NextResponse.json({
    raffle: {
      slug: raffle.slug,
      title: raffle.title,
      drawDateText: raffle.drawDateText,
    },
    number: formatNumber(valor, raffle.digits),
    // null cuando el número no está vendido: sin decir por qué.
    dueno,
    premio,
  });
}
