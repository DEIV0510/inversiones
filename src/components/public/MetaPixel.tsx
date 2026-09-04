"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Píxel de Meta (Facebook / Instagram).
 *
 * Sirve para que las campañas sepan qué anuncio trajo una compra de verdad y
 * puedan optimizar hacia eso. Sin él, Meta solo ve clics.
 *
 * TRES REGLAS QUE NO SE SALTAN:
 *
 * 1. NUNCA en el panel. Todo lo que empiece por /admin queda fuera: cargarlo
 *    ahí le mandaría a Meta el trabajo interno del dueño (qué pedidos mira,
 *    cuánto lleva vendido) y, de paso, mezclaría sus visitas con las de los
 *    compradores y ensuciaría las audiencias.
 *
 * 2. NUNCA datos personales. Al píxel solo van la página visitada y el valor
 *    de la compra. Ni nombre, ni teléfono, ni correo, ni cédula, ni los
 *    números comprados. Meta ofrece "Advanced Matching" para mandar el correo
 *    y el teléfono cifrados; aquí NO se usa, porque significaría entregarle a
 *    un tercero los datos de los compradores sin habérselo pedido.
 *
 * 3. No se pinta nada en el servidor. Todo ocurre dentro de useEffect, así el
 *    HTML que sirve Next y el que ve el navegador son idénticos y no hay
 *    forma de provocar un error de hidratación (ya pasó antes con
 *    usePathname en una página estática).
 *
 * Sin `pixelId` configurado no carga absolutamente nada: ni una petición.
 */

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[][];
      loaded?: boolean;
      version?: string;
      push?: unknown;
    };
    _fbq?: unknown;
  }
}

const SRC = "https://connect.facebook.net/en_US/fbevents.js";

/** ¿Esta ruta es del panel? Ahí el píxel no entra. */
function esPanel(ruta: string): boolean {
  return ruta === "/admin" || ruta.startsWith("/admin/");
}

/**
 * Identificador de evento a partir del código del pedido.
 *
 * Meta necesita una etiqueta ESTABLE para no contar dos veces la misma venta
 * cuando el comprador recarga la pantalla. Pero el código del pedido es la
 * CREDENCIAL con la que él consulta sus boletas en /boletas: mandárselo tal
 * cual a un tercero sería regalar la llave. Así que se manda una huella suya,
 * que cumple igual para no duplicar y no permite volver al código.
 */
function huella(texto: string): string {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) {
    h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  }
  return `p${h.toString(36)}`;
}

/**
 * Dispara un evento del píxel si está cargado. Si no lo está —porque el dueño
 * no lo configuró, o porque un bloqueador lo tumbó— no hace nada y no revienta
 * la página: un fallo de medición jamás puede estropear una compra.
 */
export function eventoMeta(
  nombre: string,
  datos?: Record<string, unknown>,
  idEvento?: string
): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  try {
    // El tercer argumento (eventID) es lo que usa Meta para NO contar dos
    // veces el mismo evento: si el comprador recarga la pantalla de "pago
    // confirmado", la venta se sigue contando una sola vez.
    if (idEvento) {
      window.fbq("track", nombre, datos ?? {}, { eventID: huella(idEvento) });
    } else {
      window.fbq("track", nombre, datos ?? {});
    }
  } catch {
    // Medir nunca puede romper nada.
  }
}

export default function MetaPixel({ pixelId }: { pixelId: string }) {
  const ruta = usePathname();
  const iniciado = useRef(false);

  useEffect(() => {
    // El id lo escribe el dueño en el panel y ya viene validado como solo
    // dígitos; se vuelve a comprobar aquí porque de este valor depende a qué
    // cuenta se manda la medición.
    if (!pixelId || !/^\d{5,20}$/.test(pixelId)) return;
    if (esPanel(ruta ?? "")) return;

    if (!iniciado.current) {
      if (typeof window.fbq !== "function") {
        // Cola oficial de Meta: recoge los eventos disparados antes de que el
        // script termine de bajar, para no perder la primera visita.
        const cola: unknown[][] = [];
        const n = Object.assign(
          (...args: unknown[]) => {
            if (n.callMethod) n.callMethod(...args);
            else cola.push(args);
          },
          { queue: cola, loaded: true, version: "2.0" }
        ) as NonNullable<Window["fbq"]>;
        window.fbq = n;
        window._fbq = n;

        const s = document.createElement("script");
        s.async = true;
        s.src = SRC;
        document.head.appendChild(s);
      }
      window.fbq?.("init", pixelId);
      iniciado.current = true;
    }

    // Una visita por página. Se vuelve a disparar al navegar dentro del sitio
    // porque Next no recarga: sin esto, Meta solo vería la primera pantalla.
    window.fbq?.("track", "PageView");
  }, [pixelId, ruta]);

  return null;
}
