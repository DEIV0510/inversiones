"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Botón de Pagos de Bold (integración manual).
 *
 * Bold no da una URL de checkout como Wompi: da una LIBRERÍA que lee un
 * <script data-bold-button ...> y pinta ella misma el botón. Por eso este
 * componente monta el script a mano dentro de su propio contenedor.
 *
 * TODO lo que va en los atributos lo calcula el SERVIDOR (src/lib/bold.ts):
 * el monto sale de la orden guardada y la firma de integridad se hace allí
 * con la llave secreta. Aquí solo llegan la llave de IDENTIDAD (que es
 * pública) y la firma ya hecha: la llave secreta NUNCA baja al navegador.
 */

/** Datos firmados que la página del pedido recibe del servidor. */
export type BoldButtonData = {
  /** Llave de IDENTIDAD de Bold (pública, puede viajar al navegador). */
  apiKey: string;
  /** Monto en pesos enteros. Sale de la orden, jamás del navegador. */
  amount: number;
  /** Moneda ISO ("COP"). */
  currency: string;
  /** Identificador único del pedido: es el CÓDIGO de 8 caracteres. */
  orderId: string;
  /** sha256({orderId}{amount}{currency}{secreto}), calculado en el servidor. */
  integritySignature: string;
  /** A dónde vuelve el comprador después de pagar. */
  redirectionUrl: string;
  /** Descripción visible en el checkout (2 a 100 caracteres). */
  description: string;
  /** Datos del comprador (email, fullName, phone). JSON u objeto. */
  customerData?: string | Record<string, string>;
};

/** Librería oficial del botón. Se carga UNA sola vez por documento. */
const LIBRERIA = "https://checkout.bold.co/library/boldPaymentButton.js";

/**
 * Carga de la librería compartida por todas las instancias del botón.
 * Es una promesa a nivel de módulo: al renavegar dentro de la aplicación el
 * script no se vuelve a descargar ni se duplica en el <head>.
 */
let promesaLibreria: Promise<void> | null = null;

function cargarLibreria(): Promise<void> {
  if (promesaLibreria) return promesaLibreria;
  promesaLibreria = new Promise<void>((resolver, rechazar) => {
    const existente = document.querySelector<HTMLScriptElement>(
      'script[data-bold-lib="1"]'
    );
    if (existente) {
      if (existente.dataset.boldListo === "1") {
        resolver();
        return;
      }
      existente.addEventListener("load", () => resolver(), { once: true });
      existente.addEventListener("error", () => rechazar(new Error("bold")), {
        once: true,
      });
      return;
    }
    const etiqueta = document.createElement("script");
    etiqueta.src = LIBRERIA;
    etiqueta.async = true;
    etiqueta.dataset.boldLib = "1";
    etiqueta.addEventListener(
      "load",
      () => {
        etiqueta.dataset.boldListo = "1";
        resolver();
      },
      { once: true }
    );
    etiqueta.addEventListener(
      "error",
      () => {
        // Sin internet o con un bloqueador: se limpia para poder reintentar
        // en la siguiente visita y se avisa al componente.
        etiqueta.remove();
        promesaLibreria = null;
        rechazar(new Error("bold"));
      },
      { once: true }
    );
    document.head.appendChild(etiqueta);
  });
  return promesaLibreria;
}

/**
 * La librería busca los <script data-bold-button> cuando se ejecuta. Si el
 * comprador ya había pasado por otra pantalla que la cargó, al volver aquí
 * puede no enterarse del botón nuevo, así que se vuelve a ejecutar (viene de
 * la caché del navegador, no es una descarga más).
 */
function reejecutarLibreria() {
  document
    .querySelectorAll('script[data-bold-reintento="1"]')
    .forEach((viejo) => viejo.remove());
  const etiqueta = document.createElement("script");
  etiqueta.src = LIBRERIA;
  etiqueta.async = true;
  etiqueta.dataset.boldReintento = "1";
  document.head.appendChild(etiqueta);
}

export default function BoldPayButton({
  datos,
  estilo = "dark-L",
  hayOtraVia = false,
}: {
  datos: BoldButtonData;
  /** Estilo del botón de Bold: dark-L, dark-S, light-M… */
  estilo?: string;
  /**
   * ¿La pantalla ofrece además otra forma de pagar (WhatsApp)? Solo cambia
   * el mensaje de cuando la librería no carga: mandarlo a "las otras
   * opciones" cuando no hay ninguna sería engañarlo.
   */
  hayOtraVia?: boolean;
}) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">(
    "cargando"
  );

  // Se sacan los valores sueltos (cadenas y números) para que el efecto NO se
  // vuelva a ejecutar cada vez que la pantalla se repinta: con el objeto
  // entero como dependencia, el botón se destruiría y se volvería a montar en
  // cada render de la página del pedido.
  const {
    apiKey,
    amount,
    currency,
    orderId,
    integritySignature,
    redirectionUrl,
    description,
  } = datos;
  const cliente =
    typeof datos.customerData === "string"
      ? datos.customerData
      : datos.customerData
        ? JSON.stringify(datos.customerData)
        : "";

  useEffect(() => {
    const caja = contenedor.current;
    if (!caja) return;
    let vivo = true;
    const relojes: number[] = [];

    // El <script> se crea a mano: uno escrito en el JSX nunca se ejecutaría.
    const etiqueta = document.createElement("script");
    etiqueta.setAttribute("data-bold-button", estilo);
    etiqueta.setAttribute("data-api-key", apiKey);
    etiqueta.setAttribute("data-amount", String(Math.round(amount)));
    etiqueta.setAttribute("data-currency", currency);
    etiqueta.setAttribute("data-order-id", orderId);
    etiqueta.setAttribute("data-integrity-signature", integritySignature);
    etiqueta.setAttribute("data-redirection-url", redirectionUrl);
    etiqueta.setAttribute("data-description", description);
    if (cliente) etiqueta.setAttribute("data-customer-data", cliente);
    caja.appendChild(etiqueta);

    // Bold pinta su botón junto al script (o en su lugar): si en la caja hay
    // algo que no sea nuestro propio script, es que ya se dibujó.
    const pintado = () =>
      Array.from(caja.children).some((hijo) => hijo !== etiqueta);

    cargarLibreria()
      .then(() => {
        if (!vivo) return;
        relojes.push(
          window.setTimeout(() => {
            if (!vivo) return;
            if (pintado()) {
              setEstado("listo");
              return;
            }
            // La librería ya estaba cargada de una pantalla anterior.
            reejecutarLibreria();
            relojes.push(
              window.setTimeout(() => {
                if (!vivo) return;
                setEstado(pintado() ? "listo" : "error");
              }, 2500)
            );
          }, 900)
        );
      })
      .catch(() => {
        if (vivo) setEstado("error");
      });

    return () => {
      vivo = false;
      for (const reloj of relojes) window.clearTimeout(reloj);
      // React no creó estos hijos, así que los quitamos nosotros.
      caja.replaceChildren();
    };
  }, [
    apiKey,
    amount,
    currency,
    orderId,
    integritySignature,
    redirectionUrl,
    description,
    cliente,
    estilo,
  ]);

  return (
    <div className="rounded-2xl border border-line-strong bg-well p-4">
      <p className="text-center text-[11px] font-bold uppercase tracking-[0.16em] text-fg-faint">
        Paga en línea con tarjeta, PSE o Nequi
      </p>

      {/* Hueco reservado para el botón de Bold. Mientras carga se ve una
          barra en gris del mismo alto, así la pantalla no da un salto cuando
          aparece. Si la librería no llega, se esconde entero: nunca queda un
          rectángulo vacío en mitad de la pantalla de pago. */}
      {estado === "error" ? null : (
        <div className="relative mt-3 min-h-14 w-full">
          {estado === "cargando" ? (
            <div
              aria-hidden
              className="absolute inset-0 animate-pulse rounded-xl border border-line bg-card"
            />
          ) : null}
          <div
            ref={contenedor}
            className="relative flex min-h-14 w-full max-w-full items-center justify-center"
          />
        </div>
      )}

      {estado === "cargando" ? (
        <p className="mt-2 text-center text-xs text-fg-faint">
          Preparando el pago seguro…
        </p>
      ) : null}

      {estado === "error" ? (
        <p role="alert" className="mt-2 text-center text-sm leading-relaxed text-fg-soft">
          No pudimos cargar el pago en línea. Revisa tu conexión y vuelve a
          cargar la página
          {hayOtraVia
            ? ", o paga por la otra vía que aparece abajo."
            : ". Tus números siguen apartados mientras tanto."}
        </p>
      ) : null}

      {estado === "listo" ? (
        <p className="mt-2.5 text-center text-[11px] leading-relaxed text-fg-faint">
          Pago seguro procesado por Bold. Al terminar vuelves a esta página.
        </p>
      ) : null}
    </div>
  );
}
