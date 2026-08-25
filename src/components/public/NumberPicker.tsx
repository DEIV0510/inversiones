"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PrizedGroup, PublicRaffle } from "@/lib/public";
import { formatCop, formatearPlazo } from "@/lib/format";
import { formatNumber } from "@/lib/numbers";
import { useModalA11y } from "@/components/useModalA11y";
import { IconCheck, IconTicket, IconWhatsApp, IconX } from "@/components/icons";

type Suggestion = { value: number; label: string };
type SearchResult = {
  label: string;
  value: number;
  status: "DISPONIBLE" | "RESERVADO" | "VENDIDO" | "BLOQUEADO";
};

const inputCls =
  "min-h-12 w-full rounded-2xl border border-line bg-well px-4 text-base text-fg placeholder:text-fg-soft/70 focus:border-brand focus:outline-none";

/**
 * Lista vacía compartida para cuando la rifa no publica números premiados.
 * Es una constante de módulo a propósito: si se pusiera `= []` en el valor
 * por defecto del prop, cada render crearía un array nuevo y el useMemo que
 * arma el mapa de premios se recalcularía en cada pulsación del formulario.
 */
const SIN_PREMIOS: PrizedGroup[] = [];

/** Etiqueta pequeña: mayúsculas con tracking muy abierto. */
const labelCls = "text-xs font-bold uppercase tracking-[0.16em] text-fg-faint";

/**
 * Título de sección: punto fucsia con resplandor + texto display en
 * mayúsculas, igual que en la plataforma de referencia.
 */
function TituloSeccion({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={`flex items-center gap-2.5 font-display text-lg font-black uppercase tracking-[0.06em] text-fg sm:text-xl ${className}`}
    >
      <span
        aria-hidden="true"
        className="glow-brand-sm h-[7px] w-[7px] shrink-0 rounded-full bg-brand"
      />
      {children}
    </h3>
  );
}

/**
 * Lo que cuesta una cantidad con el descuento del paquete ya aplicado.
 *
 * EL DINERO LO DECIDE EL SERVIDOR: esta cuenta es solo para que el comprador
 * vea de antemano lo que le van a cobrar, y por eso tiene que ser la MISMA
 * fórmula que aplica el motor de pedidos al crear la orden —precio de lista
 * por la cantidad, menos el porcentaje del paquete, redondeado al peso—. Si
 * las dos cuentas no dieran igual, el comprador vería un precio y pagaría
 * otro.
 */
function precioConDescuento(
  cantidad: number,
  precioUnitario: number,
  descuentoPct: number
): number {
  const lista = cantidad * precioUnitario;
  if (descuentoPct <= 0) return lista;
  return Math.round((lista * (100 - descuentoPct)) / 100);
}

/**
 * Colores de la pastilla de cada etiqueta.
 *
 * El dueño escribe el texto ("Más vendido", "VIP", "Personalizado"…) pero no
 * elige color: lo decide el descuento, para que la pantalla siempre señale
 * hacia la mejor oferta y no dependa del gusto del día.
 *   · fucsia (la marca) → el paquete con el MEJOR descuento del sorteo; es el
 *     que queremos que se lleve, así que además lleva resplandor;
 *   · ámbar → los demás paquetes que también traen descuento;
 *   · violeta → etiqueta sin descuento ("VIP", "Personalizado"), que informa
 *     pero no es una rebaja.
 * Son los tonos de ESTA plataforma, no los de la captura de referencia (que
 * es de un sitio de fondo blanco).
 */
const TONOS_ETIQUETA = {
  mejor: {
    pastilla: "bg-brand text-white",
    tarjeta: "glow-brand-sm border-brand bg-brand/5",
  },
  rebaja: {
    pastilla: "bg-warn text-bg",
    tarjeta: "border-warn/70 bg-warn/5",
  },
  aviso: {
    pastilla: "bg-brand-violet text-white",
    tarjeta: "border-brand-violet/70 bg-brand-violet/5",
  },
} as const;

/**
 * Selección de números escalable: nunca se carga el universo completo.
 * Las dos formas de comprar van APILADAS en la misma pantalla (sin pestañas):
 * primero la compra rápida por paquetes y debajo la elección del número.
 * La disponibilidad SIEMPRE la decide el backend al cerrar la compra.
 * La forma de elegir (manual / azar / ambas) y los paquetes de boletas
 * vienen configurados en cada rifa desde el panel.
 *
 * `prizedGroups` son los números premiados que la propia página del sorteo ya
 * publica arriba (los calcula el servidor con getPrizedGroups). Llegan hasta
 * aquí para poder CELEBRARLOS dentro del selector: es el mejor argumento de
 * venta que tiene la página y antes se perdía —el buscador decía solo
 * "Disponible" aunque el número estuviera premiado—. El prop es opcional para
 * que una rifa sin premios anticipados funcione exactamente igual.
 *
 * Esto no roza la regla de no enseñar inventario: decir que UN número tiene
 * premio es repetir algo ya público; lo que jamás se dice es cuántos números
 * quedan libres o cuántos se vendieron.
 */
export default function NumberPicker({
  raffle,
  prizedGroups = SIN_PREMIOS,
}: {
  raffle: PublicRaffle;
  prizedGroups?: PrizedGroup[];
}) {
  const router = useRouter();

  // Mapa número → premio, para preguntar en O(1) si una ficha está premiada.
  // Los números vienen rellenados con ceros ("01038"), así que se pasan a
  // entero para poder compararlos con los valores que maneja el selector.
  const premiosPorNumero = useMemo(() => {
    const mapa = new Map<number, string>();
    for (const grupo of prizedGroups) {
      for (const texto of grupo.numbers) {
        const valor = Number(texto);
        if (Number.isInteger(valor)) mapa.set(valor, grupo.prize);
      }
    }
    return mapa;
  }, [prizedGroups]);
  const hayPremiados = premiosPorNumero.size > 0;

  // Modo de selección configurado en la rifa. Cualquier valor desconocido
  // se trata como "ambas" para no dejar al usuario sin manera de comprar.
  const onlyManual = raffle.selectionMode === "MANUAL";
  const onlyRandom = raffle.selectionMode === "RANDOM";
  // Qué bloques se pintan: en "ambas" se ven los dos, uno debajo del otro.
  const verCompraRapida = !onlyManual;
  const verElegirNumero = !onlyRandom;

  // Compra mínima del sorteo: la fija el dueño al crear la rifa. Se acota
  // contra el máximo por si quedaran mal configurados uno contra otro, y
  // nunca baja de 1. Es una condición de compra, no inventario: al comprador
  // SÍ se le dice cuál es (lo que jamás se le enseña son los vendidos).
  const minPorPedido = Math.max(
    1,
    Math.min(
      Number.isFinite(raffle.minNumbersPerOrder)
        ? raffle.minNumbersPerOrder
        : 1,
      raffle.maxNumbersPerOrder
    )
  );
  // Solo se habla del mínimo cuando de verdad limita algo.
  const hayMinimo = minPorPedido > 1;

  // Paquetes definidos por el dueño: sin cantidades repetidas, ordenados, sin
  // superar el máximo por pedido y —igual de importante— sin quedar por debajo
  // de la compra mínima: un paquete más pequeño que el mínimo el servidor lo
  // rechazaría, así que ni se ofrece. Cada uno puede traer su etiqueta y su
  // descuento. Si no hay paquetes, solo quedan los botones +/−.
  //
  // Si por un descuido del panel hubiera dos paquetes con la misma cantidad,
  // se queda el de MAYOR descuento: es el que va a aplicar el servidor al
  // cobrar, así que es el que hay que enseñar.
  const packsPorCantidad = new Map<number, (typeof raffle.ticketPacks)[number]>();
  for (const p of raffle.ticketPacks) {
    if (p.qty < minPorPedido || p.qty > raffle.maxNumbersPerOrder) continue;
    const previo = packsPorCantidad.get(p.qty);
    if (!previo || p.discountPct > previo.discountPct) {
      packsPorCantidad.set(p.qty, p);
    }
  }
  const packs = [...packsPorCantidad.values()]
    .sort((a, b) => a.qty - b.qty)
    .slice(0, 12);

  // Cuál es el paquete de la mejor oferta: el del descuento más alto (y ante
  // un empate, el primero). Es el único que se pinta en fucsia, para que la
  // pantalla señale a un solo sitio.
  const iMejorOferta = packs.reduce(
    (mejor, p, i) =>
      p.discountPct > 0 && p.discountPct > (packs[mejor]?.discountPct ?? 0)
        ? i
        : mejor,
    -1
  );

  // El sitio extra de la rejilla (la pastilla asomando por arriba, la línea
  // del precio tachado) solo se reserva si de verdad hay algo que mostrar:
  // una rifa sin etiquetas ni descuentos se ve exactamente igual que antes.
  const hayEtiquetas = packs.some((p) => p.label);
  const hayDescuentos = packs.some((p) => p.discountPct > 0);

  // Relleno de la última tarjeta: cuando los paquetes no llenan la última
  // fila, la de cierre se estira para tapar el hueco que quedaba a su derecha
  // (móvil de 2 columnas, escritorio de 3). Misma altura y mismo aire, solo
  // más ancha.
  const spanUltimoPack = [
    packs.length % 2 === 1 ? "col-span-2" : "",
    packs.length % 3 === 1
      ? "sm:col-span-3"
      : packs.length % 3 === 2
        ? "sm:col-span-2"
        : "sm:col-span-1",
  ].join(" ");

  const [selected, setSelected] = useState<Map<number, string>>(new Map());
  // Cantidad de la compra rápida. 0 = todavía no ha elegido paquete.
  const [randomQty, setRandomQty] = useState(0);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(!onlyRandom);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searchError, setSearchError] = useState("");

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // Cédula: dato OBLIGATORIO. Identifica al ganador junto con el nombre y el
  // celular, y le sirve al comprador para encontrar sus boletas. El correo,
  // en cambio, sigue siendo opcional: mucha gente no tiene o lo escribe mal.
  const [idNumber, setIdNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const panelRef = useModalA11y(checkoutOpen, () => setCheckoutOpen(false));
  const abortRef = useRef<AbortController | null>(null);
  const noticeRef = useRef<HTMLDivElement | null>(null);

  // El aviso vive arriba del bloque de selección, pero se dispara cuando el
  // comprador está abajo (en el modal o en la cuadrícula). Si queda fuera de
  // la vista se acerca solo: si no, el modal se cerraría y para él no habría
  // pasado nada. Ya visible, no se le da ningún tirón a la página.
  useEffect(() => {
    if (!notice) return;
    const nodo = noticeRef.current;
    if (!nodo) return;
    const caja = nodo.getBoundingClientRect();
    // 96px = alto de la cabecera fija más un respiro.
    if (caja.top < 96 || caja.bottom > window.innerHeight) {
      nodo.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [notice]);

  // Regla derivada (sustituye a las pestañas): si el comprador escogió
  // números a mano, el pedido lleva ESOS números; si no escogió ninguno pero
  // eligió una cantidad, el pedido lleva solo la cantidad.
  const usaNumerosElegidos = selected.size > 0;
  const quantity = usaNumerosElegidos ? selected.size : randomQty;
  // Descuento del pedido. Depende SOLO de la cantidad: si el pedido lleva
  // tantos números como un paquete con descuento, se aplica ese descuento —dé
  // igual si llegó tocando la tarjeta del paquete, subiendo con "+" o
  // eligiendo los números a mano—. Se busca sobre TODOS los paquetes de la
  // rifa y quedándose con el mayor, calcado de lo que hace el servidor al
  // cobrar (calcularTotalPedido); por eso lo que se ve aquí es lo que se paga.
  const descuentoPct = raffle.ticketPacks.reduce(
    (mayor, p) => (p.qty === quantity && p.discountPct > mayor ? p.discountPct : mayor),
    0
  );
  const totalLista = quantity * raffle.pricePerNumber;
  const total = precioConDescuento(
    quantity,
    raffle.pricePerNumber,
    descuentoPct
  );
  const ahorro = totalLista - total;
  const hayPedido = quantity > 0;
  // Cuántos números le faltan para llegar a la compra mínima. En la práctica
  // solo pasa eligiendo a mano: los paquetes y el contador ya salen del
  // mínimo. Con 0 no hay pedido todavía, así que no falta nada.
  const faltanParaMinimo = hayPedido
    ? Math.max(0, minPorPedido - quantity)
    : 0;
  const canContinue =
    hayPedido &&
    faltanParaMinimo === 0 &&
    quantity <= raffle.maxNumbersPerOrder;

  const loadSuggestions = useCallback(async () => {
    // En modo "solo al azar" nunca se muestran sugerencias: no se pide nada.
    if (onlyRandom) return;
    // El estado ya arranca en "cargando" y quien recarga a mano lo vuelve a
    // encender; aquí no se toca para no renderizar de más al montar.
    try {
      const res = await fetch(
        `/api/public/raffles/${raffle.slug}/suggestions?count=24`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (res.ok) setSuggestions(data.suggestions ?? []);
    } catch {
      // sin sugerencias no se bloquea nada: queda el buscador
    } finally {
      setLoadingSuggestions(false);
    }
  }, [raffle.slug, onlyRandom]);

  useEffect(() => {
    // La primera carga se pide fuera del render: así el estado solo cambia
    // cuando llega la respuesta, sin encadenar renders al montar.
    let vivo = true;
    (async () => {
      await Promise.resolve();
      if (vivo) await loadSuggestions();
    })();
    return () => {
      vivo = false;
    };
  }, [loadSuggestions]);

  /**
   * Elegir un número a mano cancela la cantidad de la compra rápida.
   *
   * El pedido lleva UNA cosa o la otra, nunca las dos, y eso es a propósito.
   * Lo que fallaba es que el cambio se hacía EN SILENCIO: el comprador tocaba
   * un paquete de 16, añadía su número de la suerte y el carrito se quedaba en
   * "1 número" con un "te faltan 15" que parecía un error del sitio. Ahora
   * cada vez que una acción descarta la otra se dice con todas las letras.
   */
  function toggle(value: number, label: string) {
    // Tope del pedido: antes se ignoraba el toque en silencio y el comprador
    // creía que la ficha no respondía. Ahora se le dice por qué.
    if (!selected.has(value) && selected.size >= raffle.maxNumbersPerOrder) {
      setNotice(
        `Este sorteo permite máximo ${raffle.maxNumbersPerOrder} números por pedido. Quita alguno para elegir otro.`
      );
      return;
    }
    // Si había una cantidad de la compra rápida, este toque la borra: hay que
    // avisar ANTES de perderla de vista, porque después ya no hay de dónde
    // sacar el número que se descartó.
    const cantidadDescartada = randomQty;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.set(value, label);
      }
      return next;
    });
    setRandomQty(0);
    if (cantidadDescartada > 0) {
      setNotice(
        `Ahora llevas los números que eliges tú: quitamos la compra rápida de ${cantidadDescartada} números.`
      );
    }
  }

  /**
   * Elegir una cantidad rápida cancela los números escogidos a mano.
   * La cantidad nunca se queda entre 1 y el mínimo: o es 0 (todavía no quiere
   * nada) o es al menos la compra mínima del sorteo.
   *
   * Igual que en toggle(): si esto descarta los números que ya había elegido,
   * se le dice; y si solo está subiendo o bajando el contador no se le dice
   * nada, porque ahí no pierde nada.
   */
  function elegirCantidad(n: number) {
    const acotada = Math.max(0, Math.min(raffle.maxNumbersPerOrder, n));
    const q = acotada > 0 ? Math.max(minPorPedido, acotada) : 0;
    setRandomQty(q);
    if (q > 0 && selected.size > 0) {
      const cuantos = selected.size;
      setSelected(new Map());
      setNotice(
        `Cambiaste a la compra rápida de ${q} números: quitamos ${
          cuantos === 1
            ? "el número que habías elegido"
            : `los ${cuantos} números que habías elegido`
        }.`
      );
    }
  }

  /**
   * "+" de la fila de cantidad libre: desde 0 salta directo a la compra
   * mínima (el salto lo hace elegirCantidad) y de ahí sube de uno en uno.
   */
  function subirCantidad() {
    elegirCantidad(randomQty + 1);
  }

  /**
   * "−" de la fila de cantidad libre: no puede bajar del mínimo, así que
   * desde ahí el único paso es volver a 0, que significa "no quiero nada".
   */
  function bajarCantidad() {
    elegirCantidad(randomQty <= minPorPedido ? 0 : randomQty - 1);
  }

  async function searchNumber(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    setSearchResult(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(
        `/api/public/raffles/${raffle.slug}/number-status?n=${encodeURIComponent(query.trim())}`,
        { cache: "no-store", signal: controller.signal }
      );
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error || "No fue posible consultar");
        return;
      }
      // La etiqueta se arma aquí a partir del valor y de las cifras de la
      // rifa: así el número buscado se ve siempre, sin depender de cómo se
      // llame el campo en la respuesta.
      if (typeof data.value !== "number") {
        setSearchError("No fue posible consultar");
        return;
      }
      setSearchResult({
        value: data.value,
        label: formatNumber(data.value, raffle.digits),
        status: data.status,
      });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setSearchError("Error de conexión. Intenta de nuevo.");
      }
    } finally {
      setSearching(false);
    }
  }

  async function submitOrder() {
    if (name.trim().length < 2) {
      setFormError("Escribe tu nombre completo");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setFormError(
        raffle.whatsappCheckout
          ? "Escribe tu número de WhatsApp"
          : "Escribe tu número de teléfono"
      );
      return;
    }
    // La cédula es OBLIGATORIA: identifica al ganador junto con el nombre y
    // el celular, y le sirve al comprador para encontrar sus boletas. El
    // servidor la exige igual (createOrderSchema); esto solo se lo dice antes
    // de que pierda el viaje.
    if (idNumber.length < 5) {
      setFormError("Escribe tu cédula (mínimo 5 dígitos)");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      // Datos del comprador comunes a las dos formas de compra.
      const datos = { raffleSlug: raffle.slug, name, phone, email, idNumber };
      const body = usaNumerosElegidos
        ? { ...datos, numbers: [...selected.keys()] }
        : { ...datos, randomCount: randomQty };
      const res = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && Array.isArray(data.conflicting) && data.conflicting.length > 0) {
          // Los números perdidos se nombran ANTES de tocar el estado: el
          // actualizador de React no corre en el acto, así que leerlos desde
          // dentro dejaba la lista vacía y el aviso salía siempre genérico.
          const perdidos = (data.conflicting as number[])
            .map((n) => selected.get(n))
            .filter((label): label is string => Boolean(label));
          setSelected((prev) => {
            const next = new Map(prev);
            for (const n of data.conflicting) next.delete(n);
            return next;
          });
          setCheckoutOpen(false);
          setSearchResult(null);
          setLoadingSuggestions(true);
          loadSuggestions();
          setFormError("");
          setNotice(
            perdidos.length > 0
              ? `Otra persona tomó ${perdidos.length === 1 ? "el número" : "los números"} ${perdidos.join(", ")} antes que tú. Los quitamos de tu selección: elige otros y continúa.`
              : "Algunos números fueron tomados por otra persona. Revisa tu selección y continúa."
          );
          return;
        }
        // Cualquier otro rechazo del servidor (por ejemplo el 422 de compra
        // mínima) se muestra tal cual en el modal: el mensaje ya viene
        // redactado para el comprador.
        setFormError(data.error || "No fue posible crear tu pedido");
        return;
      }
      // Solo se usa el código del pedido: la respuesta del API ya no trae los
      // números (se revelan cuando el pago esté confirmado). Si la rifa cierra
      // por WhatsApp, el comprador pasa derecho a la conversación.
      router.push(
        raffle.whatsappCheckout
          ? `/pedido/${data.code}?enviar=1`
          : `/pedido/${data.code}`
      );
    } catch {
      setFormError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  // ¿El número que acaba de buscar está premiado? Solo se celebra si además
  // está DISPONIBLE: felicitar por un premio que ya no puede comprar sería
  // burlarse de él. Con el número vendido o pendiente basta con su estado.
  const premioBuscado = searchResult
    ? premiosPorNumero.get(searchResult.value)
    : undefined;
  const celebraBuscado =
    Boolean(premioBuscado) && searchResult?.status === "DISPONIBLE";
  // El "al instante" solo se añade si el dueño no lo escribió ya dentro del
  // premio. Sin esta comprobación, un premio guardado como "$200.000 al
  // instante" se leía "…tiene premio: $200.000 al instante al instante!".
  const premioBuscadoTexto = premioBuscado
    ? /al\s+instante/i.test(premioBuscado)
      ? `${premioBuscado}!`
      : `${premioBuscado} al instante!`
    : "";

  // Cuántos de los números que él mismo eligió están premiados. No es
  // inventario del sorteo: es lo que lleva en su carrito.
  const premiadosElegidos = hayPremiados
    ? [...selected.keys()].filter((v) => premiosPorNumero.has(v)).length
    : 0;

  // Colores de estado igual que la leyenda: pendiente = ámbar, pagado = fucsia.
  // Un número que otra persona está pagando se nombra "Pendiente de pago", no
  // "Reservado": aquí no se aparta nada, se compra.
  const statusChip: Record<SearchResult["status"], { text: string; cls: string }> = {
    DISPONIBLE: { text: "Disponible", cls: "bg-wa/15 text-wa" },
    RESERVADO: { text: "Pendiente de pago", cls: "bg-warn/15 text-warn" },
    VENDIDO: { text: "Vendido", cls: "bg-brand/20 text-brand-light" },
    BLOQUEADO: { text: "No disponible", cls: "bg-well text-fg-faint" },
  };

  // Leyenda de colores de las fichas. Solo explica los colores: nunca lleva
  // cantidades, porque al público jamás se le muestran números vendidos.
  const leyenda = [
    { texto: "Libres", punto: "bg-well ring-1 ring-line-strong" },
    { texto: "Pendientes", punto: "bg-warn" },
    { texto: "Pagados", punto: "bg-brand" },
  ] as const;

  return (
    <section id="elegir" className="mt-6 flex flex-col gap-7">
      {notice ? (
        <div
          ref={noticeRef}
          role="alert"
          className="flex items-start justify-between gap-3 rounded-2xl border border-brand/50 bg-brand/10 px-4 py-3"
        >
          <p className="text-sm leading-relaxed text-fg">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Cerrar aviso"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-soft hover:text-fg"
          >
            <IconX width={16} height={16} />
          </button>
        </div>
      ) : null}

      {/* La compra mínima es una condición del sorteo, no inventario: se dice
          de frente y ARRIBA del todo, antes de que elija nada, para que no
          descubra el límite al intentar comprar. Va en ámbar (aviso), nunca en
          rojo: no se ha equivocado en nada. */}
      {hayMinimo ? (
        <div className="flex items-center gap-3 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3">
          <IconTicket width={18} height={18} className="shrink-0 text-warn" />
          <p className="text-sm font-bold leading-snug text-warn">
            Compra mínima: {minPorPedido} números
          </p>
        </div>
      ) : null}

      {/* ── COMPRA RÁPIDA ─────────────────────────────────────────────
          Paquetes de boletas: la forma más directa de comprar. Al público
          nunca se le nombra "aleatorio": solo elige cuántas quiere. */}
      {verCompraRapida ? (
        <div>
          <TituloSeccion className="mb-3">Compra rápida</TituloSeccion>

          {packs.length > 0 ? (
            <>
              {/* La pastilla de la etiqueta se monta sobre el borde de arriba,
                  así que la rejilla necesita ese respiro extra; sin etiquetas
                  queda igual de compacta que antes. */}
              <div
                className={`grid grid-cols-2 gap-x-3 sm:grid-cols-3 ${
                  hayEtiquetas ? "gap-y-5 pt-3" : "gap-y-3"
                }`}
              >
                {packs.map((p, i) => {
                  const activo = randomQty === p.qty;
                  // La última tarjeta se estira si la fila queda a medias.
                  const relleno = i === packs.length - 1 ? spanUltimoPack : "";
                  const precioLista = p.qty * raffle.pricePerNumber;
                  const precioFinal = precioConDescuento(
                    p.qty,
                    raffle.pricePerNumber,
                    p.discountPct
                  );
                  // El color de la pastilla lo decide el descuento (ver
                  // TONOS_ETIQUETA); sin etiqueta no hay pastilla.
                  const tono = !p.label
                    ? null
                    : i === iMejorOferta
                      ? TONOS_ETIQUETA.mejor
                      : p.discountPct > 0
                        ? TONOS_ETIQUETA.rebaja
                        : TONOS_ETIQUETA.aviso;
                  return (
                    <button
                      key={p.qty}
                      type="button"
                      onClick={() => elegirCantidad(p.qty)}
                      aria-pressed={activo}
                      aria-label={`${p.label ? `${p.label}. ` : ""}${p.qty} ${
                        p.qty === 1 ? "número" : "números"
                      } por ${formatCop(precioFinal)}${
                        p.discountPct > 0
                          ? `, ${p.discountPct}% de descuento`
                          : ""
                      }`}
                      className={`relative flex flex-col items-center justify-center gap-1 rounded-3xl border bg-card px-3 py-5 text-center transition-all active:scale-[0.99] ${
                        hayDescuentos
                          ? "min-h-40 sm:min-h-44"
                          : "min-h-36 sm:min-h-40"
                      } ${relleno} ${
                        activo
                          ? "glow-brand border-brand"
                          : (tono?.tarjeta ?? "border-line hover:border-brand/60")
                      }`}
                    >
                      {p.label && tono ? (
                        <span
                          aria-hidden="true"
                          className={`absolute -top-3 left-1/2 max-w-[94%] -translate-x-1/2 truncate rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] shadow-card ${tono.pastilla}`}
                        >
                          {p.label}
                        </span>
                      ) : null}
                      <span
                        aria-hidden="true"
                        className="font-display text-[2.75rem] font-black leading-none tabular-nums text-brand sm:text-5xl"
                      >
                        {p.qty}
                      </span>
                      <span aria-hidden="true" className="text-sm text-fg-soft">
                        {p.qty === 1 ? "Número" : "Números"}
                      </span>
                      <span
                        aria-hidden="true"
                        className="mt-2 max-w-full rounded-full bg-brand px-3.5 py-1.5 font-display text-sm font-black tabular-nums text-white"
                      >
                        {formatCop(precioFinal)}
                      </span>
                      {/* Con descuento se ve de un vistazo que sale más
                          barato: el precio de lista tachado y cuánto se
                          rebaja. */}
                      {p.discountPct > 0 ? (
                        <span
                          aria-hidden="true"
                          className="mt-1.5 flex max-w-full flex-wrap items-center justify-center gap-1.5 text-[11px] leading-none"
                        >
                          <s className="tabular-nums text-fg-faint">
                            {formatCop(precioLista)}
                          </s>
                          <span className="rounded-full bg-warn/15 px-1.5 py-0.5 font-black tabular-nums text-warn">
                            −{p.discountPct}%
                          </span>
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {/* Empuje de la referencia: sin contadores ni cifras de venta,
                  solo la idea de que comprar más suma oportunidades. */}
              <p className="mt-3 text-center text-xs font-semibold leading-relaxed text-fg-soft">
                Más números, más oportunidades de ganar
              </p>
            </>
          ) : null}

          {/* Cantidad libre, por si quiere una distinta a los paquetes. */}
          <div className={packs.length > 0 ? "mt-3" : ""}>
            <div className="flex items-center justify-between gap-3 rounded-3xl border border-line bg-card px-4 py-3">
              <span className={labelCls}>Otra cantidad</span>
              <span className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={bajarCantidad}
                  disabled={randomQty === 0}
                  aria-label="Menos boletas"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-strong text-xl font-black text-fg transition-colors hover:border-brand disabled:opacity-40"
                >
                  −
                </button>
                <span className="min-w-10 text-center font-display text-2xl font-black tabular-nums text-brand">
                  {randomQty}
                </span>
                <button
                  type="button"
                  onClick={subirCantidad}
                  disabled={randomQty >= raffle.maxNumbersPerOrder}
                  aria-label="Más boletas"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-strong text-xl font-black text-fg transition-colors hover:border-brand disabled:opacity-40"
                >
                  +
                </button>
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── ELIGE TU NÚMERO ───────────────────────────────────────────
          Buscador puntual + cuadrícula de sugerencias disponibles. */}
      {verElegirNumero ? (
        <div className="flex flex-col gap-4">
          <TituloSeccion>Elige tu número</TituloSeccion>

          {/* Buscador */}
          <form
            onSubmit={searchNumber}
            className="rounded-3xl border border-line bg-card p-4"
          >
            <label htmlFor="buscar-numero" className={`mb-2 block ${labelCls}`}>
              Busca tu número de la suerte
            </label>
            <div className="flex gap-2">
              <input
                id="buscar-numero"
                type="text"
                inputMode="numeric"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value.replace(/\D/g, "").slice(0, raffle.digits));
                  setSearchResult(null);
                  setSearchError("");
                }}
                className={`${inputCls} min-w-0 font-display text-lg font-bold tracking-[0.2em]`}
                placeholder={"0".repeat(raffle.digits)}
              />
              <button
                type="submit"
                disabled={searching || query.length === 0}
                className="min-h-12 shrink-0 rounded-2xl bg-brand px-5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
              >
                {searching ? "…" : "Buscar"}
              </button>
            </div>
            {searchError ? (
              <p role="alert" className="mt-2 text-sm font-semibold text-error">
                {searchError}
              </p>
            ) : null}
            {searchResult ? (
              <div
                className={`mt-3 rounded-2xl px-4 py-3 ${
                  celebraBuscado
                    ? "border border-wa/60 bg-wa/10"
                    : "bg-well"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span
                    className={`font-display text-xl font-black tracking-[0.15em] ${
                      celebraBuscado ? "text-wa" : "text-brand"
                    }`}
                  >
                    {searchResult.label}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${statusChip[searchResult.status].cls}`}
                  >
                    {statusChip[searchResult.status].text}
                  </span>
                  {searchResult.status === "DISPONIBLE" ? (
                    <button
                      type="button"
                      onClick={() => {
                        toggle(searchResult.value, searchResult.label);
                        setQuery("");
                        setSearchResult(null);
                      }}
                      className="glow-brand-sm min-h-11 rounded-2xl bg-brand px-4 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-dark"
                    >
                      {selected.has(searchResult.value) ? "Quitar" : "Agregar"}
                    </button>
                  ) : null}
                </div>
                {/* LA VENTA QUE SE PERDÍA. El número premiado ya está
                    publicado más arriba en la página, así que aquí se celebra
                    sin rodeos: quien busca su número de la suerte y le sale
                    "$1.000.000 al instante" compra. Va en el verde de
                    premiado, el mismo de la boleta ganadora. */}
                {celebraBuscado ? (
                  <p
                    role="status"
                    className="mt-2.5 border-t border-wa/30 pt-2.5 text-sm font-black leading-snug text-wa"
                  >
                    <span aria-hidden="true">★ </span>¡Este número tiene premio:{" "}
                    {premioBuscadoTexto} Agrégalo antes de que se lo lleven.
                  </p>
                ) : null}
              </div>
            ) : null}
          </form>

          {/* Sugerencias disponibles */}
          <div className="rounded-3xl border border-line bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <span className={labelCls}>Números disponibles</span>
              <button
                type="button"
                onClick={() => {
                  setLoadingSuggestions(true);
                  loadSuggestions();
                }}
                disabled={loadingSuggestions}
                className="-mr-2 min-h-11 shrink-0 rounded-xl px-3 text-xs font-bold uppercase tracking-[0.16em] text-brand hover:bg-well disabled:opacity-50"
              >
                Ver otros
              </button>
            </div>
            {loadingSuggestions ? (
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-11 animate-pulse rounded-full bg-well"
                    aria-hidden="true"
                  />
                ))}
              </div>
            ) : suggestions.length > 0 ? (
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {suggestions.map((s) => {
                  const isSelected = selected.has(s.value);
                  // Las sugerencias son números libres, así que uno premiado
                  // aquí siempre se puede comprar: se pinta en el verde de
                  // premiado con su estrella para que salte a la vista.
                  const premio = premiosPorNumero.get(s.value);
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => toggle(s.value, s.label)}
                      aria-pressed={isSelected}
                      className={`flex min-h-11 flex-col items-center justify-center overflow-hidden rounded-full px-1 font-display text-[13px] font-black leading-none tracking-wider tabular-nums transition-all sm:text-sm ${
                        premio
                          ? `ticket-chip-win text-bg ${
                              isSelected
                                ? "outline-2 outline-offset-2 outline-brand"
                                : ""
                            }`
                          : isSelected
                            ? "glow-brand-sm bg-brand text-white"
                            : "border border-line bg-well text-fg hover:border-brand"
                      }`}
                    >
                      {/* El color no basta para avisar de un premio: la
                          estrella lo dice a la vista y el texto oculto lo
                          dice al lector de pantalla. */}
                      {premio ? (
                        <span aria-hidden="true" className="text-[8px]">
                          ★
                        </span>
                      ) : null}
                      <span className={premio ? "mt-0.5" : ""}>{s.label}</span>
                      {premio ? (
                        <span className="sr-only">
                          , número premiado con {premio}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-fg-soft">
                No hay sugerencias en este momento. Usa el buscador.
              </p>
            )}

            {/* Qué significa el verde de la cuadrícula. Solo se dice si la
                rifa publica números premiados, y nunca cuántos hay. */}
            {hayPremiados ? (
              <p className="mt-3 text-center text-xs font-bold leading-relaxed text-wa">
                <span aria-hidden="true">★ </span>Los números en verde tienen
                premio al instante.
              </p>
            ) : null}

            {/* Leyenda de colores: sin cantidades ni contadores. */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-line pt-3">
              {leyenda.map((l) => (
                <span
                  key={l.texto}
                  className={`flex items-center gap-1.5 ${labelCls}`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${l.punto}`}
                  />
                  {l.texto}
                </span>
              ))}
            </div>

            {/* Límites del pedido: solo condiciones de compra, nunca
                cantidades vendidas ni disponibles. */}
            <p className="mt-3 text-center text-xs text-fg-faint">
              {hayMinimo
                ? `Entre ${minPorPedido} y ${raffle.maxNumbersPerOrder} números por pedido.`
                : `Máximo ${raffle.maxNumbersPerOrder} números por pedido.`}
            </p>
          </div>

          {/* Selección actual */}
          {selected.size > 0 ? (
            <div className="rounded-3xl border border-brand/40 bg-card p-4">
              <p className={labelCls}>Números seleccionados</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {[...selected.entries()].map(([value, label]) => {
                  // El premiado sigue en verde también dentro del carrito:
                  // ver ahí su número ganador es lo que le empuja a pagar.
                  const premio = premiosPorNumero.get(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggle(value, label)}
                      aria-label={
                        premio
                          ? `Quitar número ${label}, premiado con ${premio}`
                          : `Quitar número ${label}`
                      }
                      className={`group inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 font-display text-sm font-black tracking-wider tabular-nums ${
                        premio
                          ? "ticket-chip-win text-bg"
                          : "ticket-chip text-white"
                      }`}
                    >
                      {premio ? <span aria-hidden="true">★</span> : null}
                      {label}
                      <IconX width={13} height={13} className="opacity-70 group-hover:opacity-100" />
                    </button>
                  );
                })}
              </div>
              {/* Cuántos premiados lleva NO es inventario: es lo que hay en su
                  propio carrito. Se le recuerda porque es su mejor razón para
                  rematar la compra. */}
              {premiadosElegidos > 0 ? (
                <p className="mt-3 text-sm font-black leading-snug text-wa">
                  <span aria-hidden="true">★ </span>
                  {premiadosElegidos === 1
                    ? "¡Llevas un número premiado!"
                    : `¡Llevas ${premiadosElegidos} números premiados!`}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Barra de resumen: refleja siempre lo que se va a comprar. Aparece en
          cuanto hay algo elegido —aunque todavía no llegue a la compra
          mínima— para poder decirle cuánto le falta. Se apoya encima de la
          navegación inferior y del aviso de demostración para que
          "Comprar" quede siempre destapado y se pueda pulsar. */}
      <div
        style={{ bottom: "calc(var(--barra-inferior-h) + var(--aviso-demo-h))" }}
        className={`fixed inset-x-0 z-30 transition-all duration-300 ${
          hayPedido
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-full opacity-0"
        }`}
      >
        <div className="mx-auto w-full max-w-3xl px-4 pb-3">
          <div className="neon-card rounded-3xl bg-card px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className={labelCls}>
                  {quantity} {quantity === 1 ? "número" : "números"}
                </p>
                <p className="font-display text-xl font-black tabular-nums text-brand">
                  {formatCop(total)}
                </p>
                {/* Con descuento se ve aquí mismo lo que se ahorra: es el
                    total que va a cobrar el servidor, no una promesa. */}
                {descuentoPct > 0 ? (
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] font-semibold leading-tight">
                    <s className="tabular-nums text-fg-faint">
                      {formatCop(totalLista)}
                    </s>
                    <span className="tabular-nums text-warn">
                      Ahorras {formatCop(ahorro)}
                    </span>
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormError("");
                  setCheckoutOpen(true);
                }}
                disabled={!canContinue}
                aria-describedby={
                  faltanParaMinimo > 0 ? "aviso-compra-minima" : undefined
                }
                className="glow-brand-sm inline-flex min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-brand px-6 text-sm font-bold uppercase tracking-wide text-white transition-all hover:bg-brand-dark active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-brand disabled:active:scale-100"
              >
                <IconTicket width={17} height={17} />
                Comprar
              </button>
            </div>
            {/* Le falta para el mínimo: en ámbar, no en rojo. No se equivocó
                él, es una condición del sorteo. */}
            {faltanParaMinimo > 0 ? (
              <p
                id="aviso-compra-minima"
                role="status"
                className="mt-2.5 border-t border-line pt-2.5 text-xs font-semibold leading-relaxed text-warn"
              >
                Te {faltanParaMinimo === 1 ? "falta" : "faltan"}{" "}
                {faltanParaMinimo}{" "}
                {faltanParaMinimo === 1 ? "número" : "números"} para llegar a la
                compra mínima de {minPorPedido}.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Modal de datos */}
      {checkoutOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar compra"
          onClick={() => setCheckoutOpen(false)}
        >
          {/* Panel con borde fucsia neón de 2px y resplandor exterior. */}
          <div
            ref={panelRef}
            tabIndex={-1}
            className="glow-brand modal-in max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-2 border-brand bg-card p-5 outline-none sm:rounded-3xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-xl font-black uppercase tracking-[0.04em] text-fg">
                Confirmar compra
              </h3>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                aria-label="Cerrar"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-well text-fg-soft hover:text-fg"
              >
                <IconX width={18} height={18} />
              </button>
            </div>

            {/* Importe enorme centrado, con el detalle debajo. */}
            <div className="mt-4 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-light">
                {raffle.title}
              </p>
              <p className="mt-1.5 font-display text-4xl font-black tabular-nums text-fg sm:text-5xl">
                {formatCop(total)}
              </p>
              <p className="mt-1 text-sm text-fg-soft">
                Por {quantity} {quantity === 1 ? "número" : "números"}
              </p>
              {/* El mismo descuento que ya vio en la barra de resumen: el
                  importe grande de arriba es exactamente lo que se cobra. */}
              {descuentoPct > 0 ? (
                <p className="mt-2 inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-warn/40 bg-warn/10 px-3 py-1.5 text-xs font-bold leading-tight text-warn">
                  <s className="tabular-nums text-fg-faint">
                    {formatCop(totalLista)}
                  </s>
                  <span className="tabular-nums">
                    −{descuentoPct}% · ahorras {formatCop(ahorro)}
                  </span>
                </p>
              ) : null}
              {/* QUÉ NÚMEROS SE ENSEÑAN AQUÍ, Y POR QUÉ.
                  El resto del sitio revela los números cuando el pago está
                  confirmado, y esto no lo contradice:
                  · si el comprador los TECLEÓ él mismo, ya son suyos y ya los
                    conoce —no hay nada que revelar—, y verlos antes de pagar
                    es justo lo que le deja comprobar que no se equivocó;
                  · si en cambio se los va a entregar el sistema por cantidad,
                    aquí NO aparece ninguno: se los enseñamos con el pago
                    confirmado, igual que en la boleta y en la página del
                    pedido. */}
              {usaNumerosElegidos ? (
                <div className="mt-3">
                  <p className={labelCls}>Tus números</p>
                  <div className="mt-2 flex max-h-28 flex-wrap justify-center gap-1.5 overflow-y-auto">
                    {[...selected.entries()].map(([value, label]) => {
                      const premio = premiosPorNumero.get(value);
                      return (
                        <span
                          key={value}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-display text-xs font-black tracking-wider tabular-nums ${
                            premio
                              ? "ticket-chip-win text-bg"
                              : "ticket-chip text-white"
                          }`}
                        >
                          {premio ? <span aria-hidden="true">★</span> : null}
                          {label}
                          {premio ? (
                            <span className="sr-only">
                              , premiado con {premio}
                            </span>
                          ) : null}
                        </span>
                      );
                    })}
                  </div>
                  {premiadosElegidos > 0 ? (
                    <p className="mt-2.5 text-xs font-black leading-snug text-wa">
                      <span aria-hidden="true">★ </span>
                      {premiadosElegidos === 1
                        ? "Llevas un número premiado."
                        : `Llevas ${premiadosElegidos} números premiados.`}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-xs leading-relaxed text-fg-faint">
                  Te mostramos tus números apenas confirmemos tu pago.
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3.5">
              <div>
                <label htmlFor="co-name" className="mb-1.5 block text-sm font-semibold text-fg">
                  Tu nombre completo
                </label>
                <input
                  id="co-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                  maxLength={120}
                  autoComplete="name"
                />
              </div>
              <div>
                <label htmlFor="co-phone" className="mb-1.5 block text-sm font-semibold text-fg">
                  {/* Si esta rifa no cierra por WhatsApp, aquí tampoco se
                      nombra: se le pide el teléfono y ya. */}
                  {raffle.whatsappCheckout ? "Tu WhatsApp" : "Tu teléfono"}
                </label>
                <input
                  id="co-phone"
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputCls}
                  maxLength={15}
                  autoComplete="tel"
                />
              </div>
              <div>
                <label htmlFor="co-email" className="mb-1.5 block text-sm font-semibold text-fg">
                  Correo <span className="font-normal text-fg-faint">(opcional)</span>
                </label>
                <input
                  id="co-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  maxLength={200}
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="co-id" className="mb-1.5 block text-sm font-semibold text-fg">
                  Tu cédula
                </label>
                <input
                  id="co-id"
                  type="text"
                  inputMode="numeric"
                  value={idNumber}
                  onChange={(e) =>
                    setIdNumber(e.target.value.replace(/\D/g, "").slice(0, 15))
                  }
                  className={inputCls}
                  maxLength={15}
                  autoComplete="off"
                />
                <p className="mt-1.5 text-xs leading-relaxed text-fg-faint">
                  Con ella identificamos al ganador y tú encuentras tus
                  boletas en cualquier momento.
                </p>
              </div>

              {/* Aviso de tratamiento de datos. No existía en ningún punto del
                  flujo de compra, y sin él la Ley 1581 se queda sin prueba de
                  que al comprador se le informó. Cuando esta rifa publica el
                  ranking se le nombra expresamente: ahí su nombre abreviado
                  puede acabar en una página abierta a internet. */}
              <p className="text-xs leading-relaxed text-fg-faint">
                {raffle.showRanking
                  ? "Al comprar aceptas el tratamiento de tus datos. En este sorteo, si quedas entre los diez que más números llevan, se publica tu nombre abreviado y la cantidad. Nunca tu celular, correo ni cédula. "
                  : "Al comprar aceptas el tratamiento de tus datos. "}
                <a
                  href="/privacidad"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-fg"
                >
                  Ver política de privacidad
                </a>
                .
              </p>

              {formError ? (
                <p role="alert" className="text-sm font-semibold text-error">
                  {formError}
                </p>
              ) : null}

              {/* Botón de cierre a lo ancho: verde WhatsApp solo si la rifa
                  cierra por WhatsApp; si no, fucsia y sin rastro de WhatsApp.
                  Aquí se remata la COMPRA, no una reserva: el texto lo dice. */}
              <button
                type="button"
                onClick={submitOrder}
                disabled={submitting}
                className={`mt-1 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl px-5 text-base font-black transition-all disabled:opacity-60 ${
                  raffle.whatsappCheckout
                    ? "glow-wa bg-wa text-white hover:bg-wa-dark"
                    : "glow-brand bg-brand text-white hover:bg-brand-dark"
                }`}
              >
                {submitting ? (
                  "Procesando…"
                ) : raffle.whatsappCheckout ? (
                  <>
                    <IconWhatsApp width={19} height={19} />
                    Finalizar compra
                  </>
                ) : (
                  <>
                    <IconCheck width={18} height={18} />
                    Pagar mis números
                  </>
                )}
              </button>
              {/* Se dice la verdad sin hablar de "reservar": los números se
                  guardan mientras paga, y por eso hay un tiempo límite.
                  El plazo pasa por formatearPlazo: las rifas que cobran por
                  WhatsApp lo tienen en 720 minutos y aquí se leía "720
                  minutos", que no lo entiende nadie. Ahora dice "12 horas". */}
              <p className="text-center text-xs leading-relaxed text-fg-faint">
                {raffle.whatsappCheckout
                  ? `Seguimos por WhatsApp para completar el pago. Te guardamos tus números ${formatearPlazo(raffle.reservationMinutes)} mientras tanto.`
                  : `Te guardamos tus números ${formatearPlazo(raffle.reservationMinutes)} mientras completas el pago.`}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
