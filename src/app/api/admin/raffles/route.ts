import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminApi } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  invalidarEtiquetas,
  TAG_RIFAS,
  tagRifa,
  tagRifaId,
} from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { digitsForTotal } from "@/lib/numbers";
import { statusMetaV2 } from "@/lib/raffle-status";
import { raffleSchema } from "@/lib/validation";
import { isWompiConfigured } from "@/lib/wompi";

export const runtime = "nodejs";

/**
 * Estados en los que la rifa está de cara al público y ACEPTA pedidos. En los
 * demás (borrador, agotada, finalizada, cancelada) nadie puede comprar, así
 * que no hace falta que exista forma de cobrar.
 */
const ESTADOS_QUE_COBRAN = new Set(["ACTIVE", "COMING_SOON"]);

/**
 * Regla de cobro, del lado del SERVIDOR. El panel ya frena este caso, pero el
 * panel es solo la primera puerta: una petición directa al API (o un panel
 * viejo en caché) podía dejar una rifa publicada con el cobro por WhatsApp
 * apagado y sin pasarela configurada. Resultado: el comprador aparta sus
 * números, llega a «Realiza el pago» y no le sale un solo botón. Es una venta
 * perdida, así que la regla se repite aquí y aquí es donde manda.
 *
 * Devuelve el mensaje de bloqueo, o "" cuando la combinación es válida.
 * `whatsappCheckout` y `status` deben ser los del estado FINAL, es decir lo
 * que va a quedar guardado, no solo lo que trae la petición.
 *
 * NO se exporta: Next.js solo admite GET/POST/… y su configuración como
 * exportaciones de un route.ts. Por eso el PATCH de [id]/route.ts lleva su
 * propia copia; son diez líneas y no cruzan la frontera del framework.
 */
function errorSinFormaDeCobro(
  status: string,
  whatsappCheckout: boolean
): string {
  if (!ESTADOS_QUE_COBRAN.has(status)) return "";
  if (whatsappCheckout) return "";
  if (isWompiConfigured()) return "";
  return (
    `No se puede dejar en «${statusMetaV2(status).label}» una rifa sin forma de cobrar: ` +
    "el cobro por WhatsApp está apagado y esta tienda no tiene pasarela de pago " +
    "configurada, así que el comprador apartaría sus números y en la pantalla de pago " +
    "no le aparecería ningún botón. Hay dos salidas: enciende el cobro por WhatsApp, " +
    "o déjala en «Borrador» hasta que configuren la pasarela de pago."
  );
}

export async function GET() {
  const auth = await requireAdminApi("numbers.view");
  if (auth instanceof Response) return auth;

  const raffles = await prisma.raffle.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ raffles });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi("raffles.manage");
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  }

  const parsed = raffleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 422 }
    );
  }

  const exists = await prisma.raffle.findUnique({
    where: { slug: parsed.data.slug },
  });
  if (exists) {
    return NextResponse.json(
      { error: "Ya existe un sorteo con ese slug (URL)" },
      { status: 409 }
    );
  }

  const { gallery, drawsAt, digits, ticketPacks, prizes, prizedNumbers, ...data } =
    parsed.data;

  // Las cifras las decide el administrador; si no las envía, se derivan del
  // total. Deben alcanzar para representar el número más alto.
  const finalDigits = digits ?? digitsForTotal(parsed.data.totalNumbers);
  if (Math.pow(10, finalDigits) < parsed.data.totalNumbers) {
    return NextResponse.json(
      {
        error: `Con ${finalDigits} cifras solo caben ${Math.pow(10, finalDigits).toLocaleString("es-CO")} números. Sube las cifras o baja la cantidad.`,
      },
      { status: 422 }
    );
  }

  // Nada de publicar una rifa que no puede cobrar. En el POST el estado final
  // es exactamente el que trae la petición: no hay nada guardado con lo que
  // mezclarlo.
  const sinCobro = errorSinFormaDeCobro(
    parsed.data.status,
    parsed.data.whatsappCheckout
  );
  if (sinCobro) {
    return NextResponse.json({ error: sinCobro }, { status: 422 });
  }

  const raffle = await prisma.raffle.create({
    data: {
      ...data,
      drawsAt: drawsAt ? new Date(drawsAt) : null,
      galleryJson: JSON.stringify(gallery),
      digits: finalDigits,
      ticketPacksJson: JSON.stringify(ticketPacks),
      prizesJson: JSON.stringify(prizes),
      ...(prizedNumbers.length > 0
        ? {
            prizedNumbers: {
              create: prizedNumbers.map((p) => ({
                number: p.number,
                prize: p.prize,
              })),
            },
          }
        : {}),
    },
  });

  await logAudit({
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "raffle.create",
    entity: "Raffle",
    entityId: raffle.id,
    detail: { title: raffle.title, totalNumbers: raffle.totalNumbers },
  });

  // La portada está cacheada: se marca para regenerar ahora que la rifa ya
  // existe de verdad. Va aquí, después de la escritura y fuera de cualquier
  // transacción; si se llamara antes, la portada se regeneraría con los datos
  // viejos y el cambio no se vería.
  revalidatePath("/");
  // Y las CONSULTAS cacheadas: el listado público y la rifa por slug. Sin
  // esto, la página del sorteo (que es dinámica pero lee de la caché de
  // datos) seguiría sirviendo lo de antes hasta que venciera el tiempo.
  invalidarEtiquetas(TAG_RIFAS, tagRifa(raffle.slug), tagRifaId(raffle.id));

  return NextResponse.json({ raffle }, { status: 201 });
}
