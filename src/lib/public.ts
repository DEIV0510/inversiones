import type { Raffle } from "@prisma/client";
import { prisma } from "./db";

/**
 * Consultas públicas. Regla de negocio: al público JAMÁS se le muestran
 * cantidades vendidas/restantes — solo el porcentaje. El tamaño de la rifa
 * (dígitos/rango) sí es público porque es necesario para elegir número.
 */

export const PUBLIC_STATUSES = [
  "COMING_SOON",
  "ACTIVE",
  "SOLD_OUT",
  "FINISHED",
] as const;

/**
 * Proporción con la que se pinta la foto del sorteo. Los flyers del dueño son
 * verticales y en un marco 4/3 se les corta media información (premios
 * anticipados, precio por ficha, fecha), así que la elige él por rifa.
 */
export const IMAGE_ASPECTS = ["4/3", "1/1", "9/16"] as const;
export type RaffleImageAspect = (typeof IMAGE_ASPECTS)[number];

/** Cualquier valor raro guardado en la base se lee como la proporción vieja. */
export function sanearImageAspect(valor: string | null | undefined): RaffleImageAspect {
  return IMAGE_ASPECTS.includes(valor as RaffleImageAspect)
    ? (valor as RaffleImageAspect)
    : "4/3";
}

/**
 * Paquete de boletas tal como lo ve el comprador. Siempre con las tres
 * claves puestas —etiqueta vacía y 0% cuando no hay— para que la tarjeta no
 * tenga que andar comprobando `undefined`.
 */
export type PublicTicketPack = {
  /** Cuántos números trae el paquete. */
  qty: number;
  /** Etiqueta de color, ej. "Más vendido". Vacía si no tiene. */
  label: string;
  /** Descuento en porcentaje entero. 0 si no tiene. */
  discountPct: number;
};

/**
 * Lee los paquetes de ticketPacksJson admitiendo las DOS formas: la vieja
 * ([1, 2, 5, 10]) y la nueva ([{ "q": 55, "label": "Más vendido", "off": 10 }]).
 *
 * Es el ÚNICO sitio donde se interpreta ese JSON: lo usan tanto la página
 * pública como el cálculo del total en el servidor, así que lo que se le
 * cobra al comprador y lo que se le enseña salen siempre de la misma lectura.
 * Nada de lanzar excepciones: una rifa con el JSON corrupto se queda sin
 * paquetes, pero se sigue pudiendo comprar con los botones +/−.
 */
export function parseTicketPacks(raw: string): PublicTicketPack[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return []; // paquetes corruptos → sin botones rápidos
  }
  if (!Array.isArray(parsed)) return [];

  const packs: PublicTicketPack[] = [];
  for (const item of parsed) {
    // Forma vieja: un número suelto, sin etiqueta ni descuento.
    if (typeof item === "number") {
      if (Number.isInteger(item) && item >= 1) {
        packs.push({ qty: item, label: "", discountPct: 0 });
      }
      continue;
    }
    if (typeof item !== "object" || item === null) continue;

    const fila = item as { q?: unknown; label?: unknown; off?: unknown };
    const qty = fila.q;
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1) continue;
    const label =
      typeof fila.label === "string" ? fila.label.trim().slice(0, 24) : "";
    // Un descuento fuera de rango (o guardado como texto) se lee como 0: ante
    // la duda se cobra el precio de lista, nunca un descuento inventado.
    const off = fila.off;
    const discountPct =
      typeof off === "number" && Number.isInteger(off) && off >= 1 && off <= 90
        ? off
        : 0;
    packs.push({ qty, label, discountPct });
  }
  return packs.slice(0, 12);
}

/** Premio adicional mostrado en la página del sorteo. */
export type RafflePrize = {
  label: string; // "ANTICIPADO · LUNES"
  title: string; // "Premio mayor" / "Bono"
  amount: string; // "1.000.000"
  note: string; // "Lotería de Cundinamarca"
};

export type PublicRaffle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  prize: string;
  imageUrl: string | null;
  /** Proporción con la que se pinta la foto: "4/3", "1/1" o "9/16". */
  imageAspect: RaffleImageAspect;
  gallery: string[];
  pricePerNumber: number;
  drawDateText: string | null;
  status: string;
  progressPct: number;
  digits: number;
  totalNumbers: number;
  /**
   * Compra mínima por pedido. Es público a propósito: no es inventario, es
   * una condición de compra que el comprador tiene que conocer antes de
   * elegir cantidad.
   */
  minNumbersPerOrder: number;
  maxNumbersPerOrder: number;
  reservationMinutes: number;
  terms: string;
  selectionMode: string;
  /** Si esta rifa cierra la compra por WhatsApp. */
  whatsappCheckout: boolean;
  /** Si la ficha del sorteo repite la fila del premio. */
  showPrize: boolean;
  /** Si la ficha del sorteo repite la fila de la fecha. */
  showDrawDate: boolean;
  ticketPacks: PublicTicketPack[];
  prizes: RafflePrize[];
};

/** Números premiados agrupados por premio, para mostrarlos al público. */
export type PrizedGroup = {
  prize: string;
  numbers: string[];
};

function parseJsonArray<T>(raw: string, isValid: (v: unknown) => boolean): T[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed.filter(isValid) as T[]) : [];
  } catch {
    return [];
  }
}

/** Porcentaje visible: automático (vendidos/total) o manual. */
export function progressPctOf(raffle: {
  progressMode: string;
  manualProgressPct: number;
  paidCount: number;
  totalNumbers: number;
}): number {
  if (raffle.progressMode === "MANUAL") {
    return Math.max(0, Math.min(100, raffle.manualProgressPct));
  }
  if (raffle.totalNumbers <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, Math.floor((raffle.paidCount * 100) / raffle.totalNumbers))
  );
}

export function toPublicRaffle(raffle: Raffle): PublicRaffle {
  let gallery: string[] = [];
  try {
    const parsed = JSON.parse(raffle.galleryJson);
    if (Array.isArray(parsed)) gallery = parsed.filter((g) => typeof g === "string");
  } catch {
    // galería corrupta → vacía
  }
  return {
    id: raffle.id,
    slug: raffle.slug,
    title: raffle.title,
    description: raffle.description,
    prize: raffle.prize,
    imageUrl: raffle.imageUrl,
    imageAspect: sanearImageAspect(raffle.imageAspect),
    gallery,
    pricePerNumber: raffle.pricePerNumber,
    drawDateText: raffle.drawDateText,
    status: raffle.status,
    progressPct: progressPctOf(raffle),
    digits: raffle.digits,
    totalNumbers: raffle.totalNumbers,
    minNumbersPerOrder: raffle.minNumbersPerOrder,
    maxNumbersPerOrder: raffle.maxNumbersPerOrder,
    reservationMinutes: raffle.reservationMinutes,
    terms: raffle.terms,
    selectionMode: raffle.selectionMode,
    whatsappCheckout: raffle.whatsappCheckout,
    showPrize: raffle.showPrize,
    showDrawDate: raffle.showDrawDate,
    ticketPacks: parseTicketPacks(raffle.ticketPacksJson),
    prizes: parseJsonArray<RafflePrize>(
      raffle.prizesJson,
      (v) => typeof v === "object" && v !== null && typeof (v as RafflePrize).title === "string"
    ).slice(0, 12),
  };
}

export async function getPublicRaffles(): Promise<PublicRaffle[]> {
  const raffles = await prisma.raffle.findMany({
    where: { status: { in: [...PUBLIC_STATUSES] } },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });
  return raffles.map(toPublicRaffle);
}

export async function getPublicRaffleBySlug(
  slug: string
): Promise<PublicRaffle | null> {
  const raffle = await prisma.raffle.findUnique({ where: { slug } });
  if (!raffle || !PUBLIC_STATUSES.includes(raffle.status as never)) return null;
  return toPublicRaffle(raffle);
}

/**
 * Rifa por slug SIN filtrar por estado, con la misma proyección pública.
 *
 * Es EXCLUSIVAMENTE para la vista previa autenticada: el dueño crea una rifa,
 * nace en borrador y necesita verla antes de publicarla. Quien la llame tiene
 * que haber comprobado ANTES que hay sesión de panel válida
 * (getVerifiedSession); si no, estaría enseñando borradores al público.
 * Para cualquier pantalla pública se usa getPublicRaffleBySlug.
 */
export async function getRaffleBySlugForAdmin(
  slug: string
): Promise<PublicRaffle | null> {
  const raffle = await prisma.raffle.findUnique({ where: { slug } });
  return raffle ? toPublicRaffle(raffle) : null;
}

/**
 * ¿Existe al menos una rifa visible al público que cierre la compra por
 * WhatsApp?
 *
 * Sirve para las pantallas transversales que no pertenecen a una rifa
 * concreta (por ejemplo "Mis boletas", a la que se llega desde la cabecera de
 * cualquier sorteo). Si NINGUNA rifa pública usa WhatsApp, esa pantalla no
 * puede ofrecerlo por ningún lado —ni siquiera como texto—, porque el
 * comprador vendría de una rifa que lo tiene apagado.
 *
 * Consulta deliberadamente barata: findFirst con select del id. Nunca carga
 * filas de números ni cuenta nada.
 */
export async function hayRifasConWhatsApp(): Promise<boolean> {
  const rifa = await prisma.raffle.findFirst({
    where: {
      status: { in: [...PUBLIC_STATUSES] },
      whatsappCheckout: true,
    },
    select: { id: true },
  });
  return rifa !== null;
}

/**
 * Números premiados de una rifa, agrupados por premio para mostrarlos como
 * en las plataformas de referencia ("50 números premiados con 1 millón").
 */
export async function getPrizedGroups(
  raffleId: string,
  digits: number
): Promise<PrizedGroup[]> {
  const rows = await prisma.prizedNumber.findMany({
    where: { raffleId },
    orderBy: { number: "asc" },
    select: { number: true, prize: true },
  });
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.prize) ?? [];
    list.push(String(row.number).padStart(digits, "0"));
    map.set(row.prize, list);
  }
  return [...map.entries()]
    .map(([prize, numbers]) => ({ prize, numbers }))
    .sort((a, b) => b.numbers.length - a.numbers.length);
}

export async function getPublishedWinners() {
  return prisma.winner.findMany({
    where: { isPublished: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    take: 12,
  });
}

// ============================================================
// CONSULTA "¿QUIÉN GANÓ?" — dueño de un número
// ============================================================

/**
 * Nombre abreviado para mostrar en público: "Wilson Andrés Torres" →
 * "Wilson A. T.".
 *
 * El día del sorteo cualquiera puede teclear el número que salió en la
 * lotería, así que el nombre completo NO se publica: solo lo suficiente para
 * que el ganador se reconozca a sí mismo (y para que el dueño lo confirme
 * en el panel, que ahí sí están los datos completos).
 */
export function abreviarNombre(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "Participante";
  const [primero, ...resto] = partes;
  // Solo la inicial del resto, en mayúscula y con punto.
  const iniciales = resto
    .map((p) => `${p[0].toUpperCase()}.`)
    .slice(0, 3)
    .join(" ");
  return iniciales ? `${primero} ${iniciales}` : primero;
}

/**
 * Teléfono enmascarado: "573106930187" → "310 *** 0187".
 *
 * Se dejan visibles el prefijo del operador y los últimos cuatro dígitos:
 * el dueño del número lo reconoce, pero no alcanza para llamarlo ni para
 * armar una lista de compradores. Nunca se publican correo ni cédula.
 */
export function enmascararTelefono(telefono: string): string {
  let digitos = telefono.replace(/\D/g, "");
  // Los teléfonos se guardan en formato internacional (57XXXXXXXXXX): se
  // recorta el indicativo para mostrar el celular como se lee en Colombia.
  if (digitos.length === 12 && digitos.startsWith("57")) digitos = digitos.slice(2);
  if (digitos.length < 7) return "***";
  return `${digitos.slice(0, 3)} *** ${digitos.slice(-4)}`;
}

/** Lo que se puede publicar del dueño de un número: nunca correo ni cédula. */
export type DuenoDeNumero = {
  /** Nombre abreviado, ej. "Wilson A. T.". */
  nombre: string;
  /** Teléfono enmascarado, ej. "310 *** 0187". */
  telefono: string;
};

/**
 * ¿A quién le pertenece este número?
 *
 * Solo responde por números VENDIDOS (fila PAID). Si el número está libre,
 * apartado o bloqueado devuelve null sin distinguir entre esos casos: eso es
 * inventario del sorteo y al público jamás se le informa.
 *
 * Consulta O(1) por el índice único (raffleId, number).
 */
export async function buscarDuenoDeNumero(
  raffleId: string,
  numero: number
): Promise<DuenoDeNumero | null> {
  const fila = await prisma.raffleNumber.findUnique({
    where: { raffleId_number: { raffleId, number: numero } },
    select: {
      status: true,
      order: {
        select: {
          status: true,
          participant: { select: { name: true, phone: true } },
        },
      },
    },
  });
  if (!fila || fila.status !== "PAID") return null;
  // Sin orden (se borró) o con la orden ya anulada: no hay dueño que anunciar.
  if (!fila.order || fila.order.status !== "PAID") return null;
  return {
    nombre: abreviarNombre(fila.order.participant.name),
    telefono: enmascararTelefono(fila.order.participant.phone),
  };
}

/**
 * Premio instantáneo asociado a un número, si la rifa lo tiene configurado.
 * Los números premiados ya son públicos en la página del sorteo, así que
 * repetirlos aquí no revela nada nuevo.
 */
export async function buscarPremioDeNumero(
  raffleId: string,
  numero: number
): Promise<string | null> {
  const fila = await prisma.prizedNumber.findUnique({
    where: { raffleId_number: { raffleId, number: numero } },
    select: { prize: true },
  });
  return fila?.prize ?? null;
}
