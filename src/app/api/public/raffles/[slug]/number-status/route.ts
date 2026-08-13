import { NextRequest, NextResponse } from "next/server";
import { getNumberStatus } from "@/lib/engine/claims";
import { formatNumber, parseNumberInput } from "@/lib/numbers";
import { getPublicRaffleBySlug } from "@/lib/public";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Buscador público de números: rápido incluso con millones (índice único). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ip = clientIp(req);
  if (
    isRateLimited("numbers.search", ip, {
      max: 60,
      windowMs: 60_000,
      globalMax: 2000,
    })
  ) {
    return NextResponse.json(
      { error: "Demasiadas consultas. Espera un momento." },
      { status: 429 }
    );
  }

  const { slug } = await params;
  const raffle = await getPublicRaffleBySlug(slug);
  if (!raffle) {
    return NextResponse.json({ error: "Sorteo no encontrado" }, { status: 404 });
  }

  const query = req.nextUrl.searchParams.get("n") ?? "";
  const value = parseNumberInput(query, raffle.totalNumbers);
  if (value === null) {
    return NextResponse.json(
      { error: `Ingresa un número entre ${formatNumber(0, raffle.digits)} y ${formatNumber(raffle.totalNumbers - 1, raffle.digits)}` },
      { status: 422 }
    );
  }

  const status = await getNumberStatus(raffle.id, value);
  return NextResponse.json({
    number: formatNumber(value, raffle.digits),
    value,
    status,
  });
}
