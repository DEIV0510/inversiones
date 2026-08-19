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
import { deleteImage } from "@/lib/media";
import { statusMetaV2 } from "@/lib/raffle-status";
import { rafflePatchSchema } from "@/lib/validation";
import { isWompiConfigured } from "@/lib/wompi";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Estados en los que la rifa está de cara al público y ACEPTA pedidos. En los
 * demás (borrador, agotada, finalizada, cancelada) nadie puede comprar, así
 * que no hace falta que exista forma de cobrar.
 */
const ESTADOS_QUE_COBRAN = new Set(["ACTIVE", "COMING_SOON"]);

/**
 * Regla de cobro, del lado del SERVIDOR. Copia deliberada de la que vive en
 * ../route.ts (el POST): Next.js no deja exportar nada más que los verbos
 * desde un route.ts, así que la alternativa era un módulo nuevo. Son diez
 * líneas y el mensaje es el mismo en las dos puertas.
 *
 * Devuelve el mensaje de bloqueo, o "" cuando la combinación es válida.
 * `status` y `whatsappCheckout` deben ser los del estado FINAL: lo que va a
 * quedar guardado, no solo lo que trae la petición.
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

/** Rutas de la galería guardadas como JSON; si está corrupta, lista vacía. */
function galeriaDe(galleryJson: string): string[] {
  try {
    const parsed = JSON.parse(galleryJson);
    return Array.isArray(parsed)
      ? parsed.filter((g): g is string => typeof g === "string" && g.length > 0)
      : [];
  } catch {
    return [];
  }
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAdminApi("numbers.view");
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const raffle = await prisma.raffle.findUnique({ where: { id } });
  if (!raffle) {
    return NextResponse.json({ error: "La rifa no existe" }, { status: 404 });
  }
  return NextResponse.json({ raffle });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireAdminApi("raffles.manage");
  if (auth instanceof Response) return auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  }

  const parsed = rafflePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 422 }
    );
  }

  const existing = await prisma.raffle.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "La rifa no existe" }, { status: 404 });
  }

  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    const clash = await prisma.raffle.findUnique({
      where: { slug: parsed.data.slug },
    });
    if (clash) {
      return NextResponse.json(
        { error: "Ya existe un sorteo con ese slug (URL)" },
        { status: 409 }
      );
    }
  }

  // No permitir reducir el total por debajo del número más alto ya tomado.
  if (
    parsed.data.totalNumbers != null &&
    parsed.data.totalNumbers !== existing.totalNumbers
  ) {
    const highest = await prisma.raffleNumber.findFirst({
      where: { raffleId: id },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    if (highest && parsed.data.totalNumbers <= highest.number) {
      return NextResponse.json(
        {
          error: `No puedes reducir el total: ya hay números tomados hasta el ${highest.number}`,
        },
        { status: 409 }
      );
    }
  }

  const { gallery, drawsAt, digits, ticketPacks, prizes, prizedNumbers, ...data } =
    parsed.data;

  // Coherencia entre cifras y cantidad de números.
  const finalTotal = parsed.data.totalNumbers ?? existing.totalNumbers;
  const finalDigits =
    digits ??
    (parsed.data.totalNumbers != null
      ? digitsForTotal(parsed.data.totalNumbers)
      : existing.digits);
  if (Math.pow(10, finalDigits) < finalTotal) {
    return NextResponse.json(
      {
        error: `Con ${finalDigits} cifras solo caben ${Math.pow(10, finalDigits).toLocaleString("es-CO")} números. Sube las cifras o baja la cantidad.`,
      },
      { status: 422 }
    );
  }

  // Nada de publicar una rifa que no puede cobrar. Lo que se juzga es el
  // estado FINAL, no la petición: un PATCH que solo apaga el WhatsApp no trae
  // el estado, y uno que solo cambia el estado no trae el WhatsApp. Cualquiera
  // de los dos, por separado, deja la rifa vendiendo sin caja. Por eso cada
  // campo se toma de la petición si viene y de lo guardado si no.
  const sinCobro = errorSinFormaDeCobro(
    parsed.data.status ?? existing.status,
    parsed.data.whatsappCheckout ?? existing.whatsappCheckout
  );
  if (sinCobro) {
    return NextResponse.json({ error: sinCobro }, { status: 422 });
  }

  const raffle = await prisma.raffle.update({
    where: { id },
    data: {
      ...data,
      ...(drawsAt !== undefined
        ? { drawsAt: drawsAt ? new Date(drawsAt) : null }
        : {}),
      ...(gallery !== undefined ? { galleryJson: JSON.stringify(gallery) } : {}),
      ...(ticketPacks !== undefined
        ? { ticketPacksJson: JSON.stringify(ticketPacks) }
        : {}),
      ...(prizes !== undefined ? { prizesJson: JSON.stringify(prizes) } : {}),
      digits: finalDigits,
    },
  });

  // Números premiados: se reemplazan los que aún no han sido reclamados.
  if (prizedNumbers !== undefined) {
    await prisma.prizedNumber.deleteMany({
      where: { raffleId: id, claimedAt: null },
    });
    const claimed = await prisma.prizedNumber.findMany({
      where: { raffleId: id },
      select: { number: true },
    });
    const yaReclamados = new Set(claimed.map((p) => p.number));
    const nuevos = prizedNumbers.filter((p) => !yaReclamados.has(p.number));
    if (nuevos.length > 0) {
      await prisma.prizedNumber.createMany({
        data: nuevos.map((p) => ({
          raffleId: id,
          number: p.number,
          prize: p.prize,
        })),
        skipDuplicates: true,
      });
    }
  }

  if (
    parsed.data.imageUrl !== undefined &&
    existing.imageUrl &&
    existing.imageUrl !== parsed.data.imageUrl
  ) {
    await deleteImage(existing.imageUrl);
  }

  // Cambios sensibles siempre auditados.
  const sensitive: Record<string, unknown> = {};
  if (parsed.data.pricePerNumber != null && parsed.data.pricePerNumber !== existing.pricePerNumber) {
    sensitive.precio = { antes: existing.pricePerNumber, ahora: parsed.data.pricePerNumber };
  }
  if (parsed.data.totalNumbers != null && parsed.data.totalNumbers !== existing.totalNumbers) {
    sensitive.totalNumeros = { antes: existing.totalNumbers, ahora: parsed.data.totalNumbers };
  }
  if (parsed.data.status && parsed.data.status !== existing.status) {
    sensitive.estado = { antes: existing.status, ahora: parsed.data.status };
  }
  if (parsed.data.manualProgressPct != null && parsed.data.manualProgressPct !== existing.manualProgressPct) {
    sensitive.porcentajeManual = { antes: existing.manualProgressPct, ahora: parsed.data.manualProgressPct };
  }
  await logAudit({
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "raffle.update",
    entity: "Raffle",
    entityId: raffle.id,
    detail: sensitive,
  });

  // Editar una rifa cambia lo que se ve en la portada cacheada: estado,
  // título, foto, precio, orden o porcentaje manual. Se marca para regenerar
  // con la rifa ya guardada, nunca antes.
  revalidatePath("/");
  // Y la página del sorteo. Se usa la forma de segmento porque cubre de una
  // vez la dirección nueva y la antigua cuando el dueño cambia el slug.
  revalidatePath("/sorteo/[slug]", "page");
  // Las consultas cacheadas de esa página: la rifa por slug y sus números
  // premiados. Se invalidan los DOS slugs (el guardado antes y el nuevo)
  // porque si el dueño cambia la dirección, la entrada vieja seguiría en
  // caché con los datos de antes.
  invalidarEtiquetas(
    TAG_RIFAS,
    tagRifa(existing.slug),
    tagRifa(raffle.slug),
    tagRifaId(raffle.id)
  );

  return NextResponse.json({ raffle });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAdminApi("raffles.manage");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.raffle.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "La rifa no existe" }, { status: 404 });
  }

  const orderCount = await prisma.order.count({ where: { raffleId: id } });
  if (orderCount > 0) {
    return NextResponse.json(
      {
        error:
          "Esta rifa ya tiene pedidos: no puede eliminarse. Usa el estado CANCELADA.",
      },
      { status: 409 }
    );
  }

  await prisma.raffle.delete({ where: { id } });
  // La portada y TODA la galería: si no, las fotos de la galería quedan
  // huérfanas en el almacenamiento y se siguen pagando.
  await deleteImage(existing.imageUrl);
  for (const url of galeriaDe(existing.galleryJson)) {
    await deleteImage(url);
  }
  await logAudit({
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "raffle.delete",
    entity: "Raffle",
    entityId: id,
    detail: { title: existing.title },
  });

  // La rifa borrada tiene que desaparecer de la portada cacheada de inmediato.
  revalidatePath("/");
  revalidatePath("/sorteo/[slug]", "page");
  // Y de las consultas cacheadas: su entrada por slug tiene que caducar ya,
  // o su página seguiría respondiendo 200 con los datos guardados en caché.
  invalidarEtiquetas(TAG_RIFAS, tagRifa(existing.slug), tagRifaId(id));

  return NextResponse.json({ ok: true });
}
