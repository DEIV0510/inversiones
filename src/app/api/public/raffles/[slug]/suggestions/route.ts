import { NextRequest, NextResponse } from "next/server";
import { pickRandomAvailable } from "@/lib/engine/claims";
import { formatNumber } from "@/lib/numbers";
import { getPublicRaffleBySlug } from "@/lib/public";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Sugerencias de números disponibles para la cuadrícula de selección rápida.
 * Son candidatos (no reservas): la reserva real ocurre al crear la orden.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ip = clientIp(req);
  if (
    isRateLimited("numbers.suggest", ip, {
      max: 30,
      windowMs: 60_000,
      globalMax: 1000,
    })
  ) {
    return NextResponse.json({ error: "Espera un momento" }, { status: 429 });
  }

  const { slug } = await params;
  const raffle = await getPublicRaffleBySlug(slug);
  if (!raffle || raffle.status !== "ACTIVE") {
    return NextResponse.json({ error: "Sorteo no disponible" }, { status: 404 });
  }

  const requested = parseInt(req.nextUrl.searchParams.get("count") ?? "24", 10);
  const count = Math.max(6, Math.min(48, Number.isFinite(requested) ? requested : 24));

  const values = await pickRandomAvailable(
    { id: raffle.id, totalNumbers: raffle.totalNumbers },
    count
  );
  return NextResponse.json({
    suggestions: values.map((v) => ({
      value: v,
      label: formatNumber(v, raffle.digits),
    })),
  });
}
