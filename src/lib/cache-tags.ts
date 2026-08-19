import { revalidateTag } from "next/cache";

/**
 * ETIQUETAS DE LA CACHÉ DE DATOS
 *
 * La página /sorteo/[slug] es dinámica a propósito (tiene que seguir
 * enseñándole los borradores en vista previa a quien tiene sesión de panel),
 * así que lo que se cachea NO es la página: son las CONSULTAS públicas que se
 * repetían en cada visita y cambian poco. Cada consulta cacheada lleva
 * etiquetas, y cada acción del panel que toca esos datos las invalida al
 * terminar. Así el visitante no paga el viaje a la base y el dueño sigue
 * viendo sus cambios en el acto.
 *
 * Lo que NO lleva etiqueta y NO se cachea, por diseño:
 *  - getRaffleBySlugForAdmin y todo lo que dependa de la sesión: se evalúan
 *    en CADA petición, o un borrador acabaría servido a un visitante.
 *  - La disponibilidad de números (sugerencias y consulta de un número):
 *    va siempre en vivo, o dos personas pagarían por el mismo número.
 */

/**
 * Paraguas de TODO lo que depende de las rifas: el listado público, la rifa
 * por slug, los números premiados y la comprobación de WhatsApp. Se invalida
 * en cualquier cambio de rifa, incluidos los que solo mueven el porcentaje
 * (confirmar o cancelar un pago), donde solo se conoce el id de la rifa.
 */
export const TAG_RIFAS = "rifas";

/** Configuración del sitio (nombre, WhatsApp, ciudad, redes, demo). */
export const TAG_AJUSTES = "ajustes";

/** Ganadores publicados que salen en la portada. */
export const TAG_GANADORES = "ganadores";

/** Etiqueta fina de una rifa concreta por su dirección pública. */
export function tagRifa(slug: string): string {
  return `rifa:${slug}`;
}

/**
 * Etiqueta fina de una rifa por su id. Hace falta porque los números
 * premiados se consultan por raffleId (la página del sorteo ya tiene la rifa
 * cargada y no vuelve a mirar el slug).
 */
export function tagRifaId(id: string): string {
  return `rifa-id:${id}`;
}

/**
 * Marca como caducadas las entradas de caché con estas etiquetas.
 *
 * Se llama SIEMPRE después de que la escritura haya terminado bien y fuera de
 * cualquier transacción: si se llamara antes, la caché se regeneraría con los
 * datos viejos y el cambio no se vería.
 *
 * El segundo argumento `{ expire: 0 }` es lo que hace que el cambio se vea EN
 * EL ACTO: caduca la entrada ya mismo, así que la siguiente lectura va a la
 * base. Sin él (o con un perfil como "max") Next serviría el dato viejo
 * mientras refresca por detrás, y el dueño vería el precio antiguo después de
 * guardarlo.
 */
export function invalidarEtiquetas(...etiquetas: string[]): void {
  for (const etiqueta of new Set(etiquetas)) {
    revalidateTag(etiqueta, { expire: 0 });
  }
}
