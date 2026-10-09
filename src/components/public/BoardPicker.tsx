"use client";

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { PrizedGroup, PublicRaffle } from "@/lib/public";
import { formatCop, formatearPlazo } from "@/lib/format";
import { formatNumber } from "@/lib/numbers";
import { leerCasilla, tableroValido } from "@/lib/cuadricula";
import { descuentoPorCantidad, precioConDescuento } from "@/lib/precio";
import { normalizeWhatsApp } from "@/lib/whatsapp";
import { eventoMeta } from "@/components/public/MetaPixel";
import { useModalA11y } from "@/components/useModalA11y";
import { IconCheck, IconClock, IconWhatsApp, IconX } from "@/components/icons";

/**
 * Tablero de las rifas de CUADRÍCULA (2 y 3 cifras), como la app que usa el
 * dueño de referencia: TODOS los números en orden, cada uno con su color.
 *
 *   · blanco   → libre: se toca para escogerlo;
 *   · amarillo → reservado: alguien lo apartó y falta que pague;
 *   · verde    → pagado: el dueño ya confirmó el pago;
 *   · gris     → el dueño lo sacó de la venta.
 *
 * El comprador toca sus números, pulsa RESERVAR, deja su nombre (y lo demás
 * que pida la rifa) y sale a WhatsApp con su reserva. NUNCA se dice
 * "comprar": lo pidió el dueño, "la gente es recelosa", y el pago se arregla
 * después con él por WhatsApp.
 *
 * Lo que se ve aquí es solo el estado de cada casilla (src/lib/cuadricula.ts):
 * ni nombres, ni teléfonos, ni códigos de nadie. La disponibilidad de verdad
 * la decide el servidor al crear la reserva; el tablero se refresca solo para
 * que el comprador no escoja a ciegas.
 */

/** Lista vacía estable: un `= []` en el prop rehacía el mapa en cada render. */
const SIN_PREMIOS: PrizedGroup[] = [];

/** Cada cuánto se vuelve a pedir el tablero mientras la pestaña está a la vista. */
const REFRESCO_MS = 15_000;

/**
 * Números por bloque en las rifas de 3 cifras (000-099, 100-199…). Hasta 100
 * números el tablero es uno solo, sin encabezados.
 */
const TAMANO_BLOQUE = 100;

/** Lo que dura a la vista el aviso breve de una casilla tomada o del tope. */
const AVISO_BREVE_MS = 3500;

const inputCls =
  "min-h-12 w-full rounded-2xl border border-line bg-well px-4 text-base text-fg placeholder:text-fg-soft/70 light:placeholder:text-fg-soft focus:border-brand focus:outline-none";

/** Etiqueta pequeña: mayúsculas con tracking muy abierto. */
const labelCls = "text-xs font-bold uppercase tracking-[0.16em] text-fg-faint";

/**
 * Lo que se pinta en cada casilla, en un carácter: los cuatro estados del
 * tablero ("0" a "3", ver cuadricula.ts) y "s" para un número libre que el
 * comprador ya escogió. Cada bloque recibe su trozo de esta cadena y solo se
 * vuelve a pintar si su trozo cambió: tocar un número repinta 100 casillas,
 * no 1.000.
 */
type Marca = "0" | "1" | "2" | "3" | "s";

/**
 * Clases de cada estado, escritas ENTERAS: Tailwind arma el CSS leyendo el
 * código y un nombre juntado con texto no existiría en la hoja de estilos.
 * Los colores de casilla (cell-*) no cambian con el tema: el número negro se
 * lee igual sobre fondo claro u oscuro.
 */
const CLASE_CASILLA: Record<Marca, string> = {
  "0": "border border-cell-line bg-cell-free text-cell-ink",
  "1": "bg-cell-reserved text-cell-ink",
  "2": "bg-cell-paid text-cell-ink",
  "3": "bg-cell-blocked text-cell-ink/45",
  s: "bg-brand text-white ring-2 ring-brand ring-offset-2 ring-offset-card",
};

/** Cómo se nombra cada estado para el lector de pantalla. */
const NOMBRE_ESTADO: Record<Marca, string> = {
  "0": "libre",
  "1": "reservado",
  "2": "pagado",
  "3": "no disponible",
  s: "seleccionado",
};

/** "07" · "07 y 23" · "07, 23 y 45". */
function unirNumeros(etiquetas: string[]): string {
  if (etiquetas.length <= 1) return etiquetas[0] ?? "";
  return `${etiquetas.slice(0, -1).join(", ")} y ${etiquetas[etiquetas.length - 1]}`;
}

type Aviso = { texto: string; importante: boolean; vez: number };

/**
 * Un bloque del tablero (o el tablero entero, hasta 100 números).
 *
 * Las casillas no llevan manejador propio: el clic lo recoge el contenedor
 * del tablero y lee `data-n`. Con 1.000 números eso son 1.000 funciones
 * menos en cada render.
 *
 * En las rifas de 3 cifras cada bloque lleva `content-visibility: auto`: el
 * navegador no dibuja los bloques que están fuera de la pantalla. El
 * `contain-intrinsic-size` es la altura que se le supone mientras tanto
 * (~17 filas de 6 en el móvil, 10 de 10 desde sm) y `auto` hace que recuerde
 * la real en cuanto lo pinta una vez. El `p-1` deja sitio al anillo de foco:
 * con la contención de pintado, lo que se sale del bloque no se ve.
 *
 * Mientras el buscador filtra NO se aplica: un bloque que se quedó con dos
 * filas seguiría ocupando, fuera de la pantalla, la altura que recordaba de
 * cuando tenía cien números, y la lista de resultados saldría llena de
 * huecos que saltan al acercarse. Filtrado quedan pocas casillas (con una
 * cifra, 271 de 1.000 como mucho) y pintarlas todas no cuesta.
 */
const Bloque = memo(function Bloque({
  inicio,
  marcas,
  cifras,
  filtro,
  premios,
  soloLectura,
  conEncabezado,
}: {
  inicio: number;
  marcas: string;
  cifras: number;
  filtro: string;
  premios: Map<number, string>;
  soloLectura: boolean;
  conEncabezado: boolean;
}) {
  const casillas: React.ReactNode[] = [];
  for (let i = 0; i < marcas.length; i++) {
    const n = inicio + i;
    const etiqueta = formatNumber(n, cifras);
    // El buscador FILTRA, como en la app de referencia: quedan las casillas
    // cuya etiqueta contiene lo escrito ("7" → 07, 17, 27… 70-79).
    if (filtro && !etiqueta.includes(filtro)) continue;
    const marca = (marcas.charAt(i) || "0") as Marca;
    const seleccionada = marca === "s";
    const libre = marca === "0" || seleccionada;
    const interactiva = !soloLectura && libre;
    const premio = premios.get(n);
    casillas.push(
      <button
        key={n}
        type="button"
        data-n={n}
        aria-label={`${etiqueta}, ${NOMBRE_ESTADO[marca]}${
          premio ? `, con premio: ${premio}` : ""
        }`}
        aria-pressed={interactiva ? seleccionada : undefined}
        // Las tomadas NO van con `disabled`: un botón deshabilitado no recibe
        // el clic y al tocarlas hay que decirle al comprador por qué no
        // responden. `aria-disabled` dice lo mismo al lector de pantalla.
        aria-disabled={interactiva ? undefined : true}
        // En modo solo lectura nadie tiene que recorrer con Tab cientos de
        // casillas que no hacen nada; el lector de pantalla las sigue leyendo.
        tabIndex={soloLectura ? -1 : undefined}
        className={`relative flex aspect-square min-h-11 min-w-0 items-center justify-center rounded-xl font-display text-[15px] font-black leading-none tabular-nums sm:text-lg ${
          CLASE_CASILLA[marca]
        } ${
          interactiva && !seleccionada
            ? "transition-transform hover:border-brand active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
            : ""
        } ${soloLectura ? "cursor-default" : ""}`}
      >
        {/* El color nunca va solo: estrella para el premio, reloj para el
            reservado, chulo para el pagado y para lo que él escogió, número
            tachado para el que no está a la venta. */}
        {premio ? (
          <span
            aria-hidden="true"
            className="absolute left-1 top-0.5 text-[10px] leading-none"
          >
            ★
          </span>
        ) : null}
        {marca === "1" ? (
          <IconClock
            width={11}
            height={11}
            strokeWidth={2.75}
            className="absolute right-1 top-1"
          />
        ) : marca === "2" || seleccionada ? (
          <IconCheck
            width={12}
            height={12}
            strokeWidth={3.25}
            className="absolute right-1 top-1"
          />
        ) : null}
        <span
          aria-hidden="true"
          className={marca === "3" ? "line-through decoration-2" : ""}
        >
          {etiqueta}
        </span>
      </button>
    );
  }
  if (casillas.length === 0) return null;

  const fin = inicio + marcas.length - 1;
  return (
    <div className={conEncabezado ? "mt-4 first:mt-0" : ""}>
      {conEncabezado ? (
        <h3
          id={`bloque-${inicio}`}
          // Destino de las fichas de salto: el foco viaja aquí para que quien
          // usa teclado siga desde el bloque que eligió.
          tabIndex={-1}
          className="mb-2 scroll-mt-24 px-1 font-display text-sm font-black uppercase tracking-[0.12em] text-fg-soft outline-none lg:scroll-mt-32"
        >
          {formatNumber(inicio, cifras)} – {formatNumber(fin, cifras)}
        </h3>
      ) : null}
      <div
        className={`grid grid-cols-6 gap-1.5 p-1 sm:grid-cols-10 sm:gap-2 ${
          conEncabezado && !filtro
            ? "[contain-intrinsic-size:auto_880px] [content-visibility:auto] sm:[contain-intrinsic-size:auto_680px]"
            : ""
        }`}
      >
        {casillas}
      </div>
    </div>
  );
});

export default function BoardPicker({
  raffle,
  tableroInicial,
  prizedGroups = SIN_PREMIOS,
  soloLectura = false,
  companyName = "",
}: {
  raffle: PublicRaffle;
  /** Estado de cada casilla al pintar la página (getBoardState). */
  tableroInicial: string;
  /** Números premiados que la página ya publica: se marcan con ★. */
  prizedGroups?: PrizedGroup[];
  /**
   * La rifa no está activa (agotada, finalizada, próxima) o es la vista
   * previa del dueño: el tablero se ve, pero no se escoge nada.
   */
  soloLectura?: boolean;
  /** Nombre del negocio, para decirle a quién le llega la reserva. */
  companyName?: string;
}) {
  const router = useRouter();
  const total = raffle.totalNumbers;
  const cifras = raffle.digits;

  const [tablero, setTablero] = useState(() =>
    tableroValido(tableroInicial, total) ? tableroInicial : "0".repeat(total)
  );
  // Copia del tablero para el cierre del modal, que puede llegar desde el
  // Escape de useModalA11y con un render ya viejo.
  const tableroRef = useRef(tablero);
  useEffect(() => {
    tableroRef.current = tablero;
  }, [tablero]);
  const [seleccion, setSeleccion] = useState<Set<number>>(() => new Set());
  // Copia de la selección para leerla desde el refresco del tablero, que es
  // asíncrono: dentro del actualizador de React no se puede avisar (se ejecuta
  // más tarde, y en desarrollo dos veces).
  const seleccionRef = useRef(seleccion);
  useEffect(() => {
    seleccionRef.current = seleccion;
  }, [seleccion]);

  const [busqueda, setBusqueda] = useState("");
  // El filtro va un paso por detrás del teclado: con 1.000 casillas, escribir
  // no espera a que se repinte el tablero.
  const filtro = useDeferredValue(busqueda);

  const [aviso, setAviso] = useState<Aviso | null>(null);
  const vecesAvisoRef = useRef(0);
  const avisar = useCallback((texto: string, importante: boolean) => {
    vecesAvisoRef.current += 1;
    setAviso({ texto, importante, vez: vecesAvisoRef.current });
  }, []);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Cerrojo contra el doble toque. `submitting` no basta: entre que llega la
  // respuesta y el navegador cambia de pagina hay una ventana en la que el
  // boton vuelve a estar activo, y un segundo toque creaba OTRA reserva que
  // apartaba mas numeros a nombre de la misma persona.
  const enviandoRef = useRef(false);
  const [formError, setFormError] = useState("");
  // El refresco es asíncrono: puede salir con el modal cerrado y volver con
  // él abierto. Esta copia le deja saber, al llegar, si el comprador ya está
  // escribiendo su nombre.
  const modalAbiertoRef = useRef(checkoutOpen);
  useEffect(() => {
    modalAbiertoRef.current = checkoutOpen;
  }, [checkoutOpen]);

  /**
   * Quita de la selección los números que el tablero ya no da por libres y
   * le dice cuáles. Si no, se enteraría al reservar, con un error, o vería
   * en amarillo un número que la barra le sigue cobrando.
   */
  const retirarPerdidos = useCallback(
    (tableroActual: string) => {
      const perdidos = [...seleccionRef.current]
        .filter((n) => leerCasilla(tableroActual, n) !== "libre")
        .sort((a, b) => a - b);
      if (perdidos.length === 0) return;
      setSeleccion((prev) => {
        const next = new Set(prev);
        for (const n of perdidos) next.delete(n);
        return next;
      });
      const etiquetas = unirNumeros(perdidos.map((n) => formatNumber(n, cifras)));
      avisar(
        perdidos.length === 1
          ? `El ${etiquetas} ya no está libre, así que lo quitamos de tu selección: escoge otro.`
          : `Los números ${etiquetas} ya no están libres, así que los quitamos de tu selección: escoge otros.`,
        true
      );
    },
    [cifras, avisar]
  );

  // Al cerrar el modal sin reservar se le pone al día la selección: mientras
  // escribía, el tablero pudo cambiar debajo (ver refrescar) y no se le tocó
  // nada para no quitarle números bajo los pies.
  const cerrarReserva = useCallback(() => {
    setCheckoutOpen(false);
    retirarPerdidos(tableroRef.current);
  }, [retirarPerdidos]);
  const panelRef = useModalA11y(checkoutOpen, cerrarReserva);

  // Número → premio, para marcar la casilla con ★ en O(1).
  const premios = useMemo(() => {
    const mapa = new Map<number, string>();
    for (const grupo of prizedGroups) {
      for (const texto of grupo.numbers) {
        const valor = Number(texto);
        if (Number.isInteger(valor)) mapa.set(valor, grupo.prize);
      }
    }
    return mapa;
  }, [prizedGroups]);
  const hayPremiados = premios.size > 0;
  const hayBloqueados = tablero.includes("3");

  // Compra mínima y máxima del sorteo, igual que en el selector de la rifa
  // grande: el mínimo se acota contra el máximo y nunca baja de 1.
  const minPorPedido = Math.max(
    1,
    Math.min(
      Number.isFinite(raffle.minNumbersPerOrder) ? raffle.minNumbersPerOrder : 1,
      raffle.maxNumbersPerOrder
    )
  );
  const hayMinimo = minPorPedido > 1;
  const hayTope = raffle.maxNumbersPerOrder < total;

  const elegidos = useMemo(
    () => [...seleccion].sort((a, b) => a - b),
    [seleccion]
  );
  const cantidad = elegidos.length;
  // Mismo total que cobrará el servidor (calcularTotalPedido): lista por
  // precio, menos el mayor descuento de paquete cuya cantidad coincida exacta.
  const descuentoPct = descuentoPorCantidad(cantidad, raffle.ticketPacks);
  const totalLista = cantidad * raffle.pricePerNumber;
  const totalPedido = precioConDescuento(cantidad, raffle.pricePerNumber, descuentoPct);
  const ahorro = totalLista - totalPedido;
  const hayPedido = cantidad > 0;
  const faltanParaMinimo = hayPedido ? Math.max(0, minPorPedido - cantidad) : 0;
  const puedeReservar =
    hayPedido && faltanParaMinimo === 0 && cantidad <= raffle.maxNumbersPerOrder;

  // Lo que se pinta en cada casilla: el tablero y, encima, lo que él escogió.
  const marcas = useMemo(() => {
    const letras = tablero.split("");
    for (const n of seleccion) {
      if (letras[n] === "0") letras[n] = "s";
    }
    return letras.join("");
  }, [tablero, seleccion]);

  const bloques = useMemo(() => {
    const lista: { inicio: number; fin: number }[] = [];
    for (let i = 0; i < total; i += TAMANO_BLOQUE) {
      lista.push({ inicio: i, fin: Math.min(total, i + TAMANO_BLOQUE) });
    }
    return lista;
  }, [total]);
  const conBloques = bloques.length > 1;

  const sinCoincidencias = useMemo(() => {
    if (!filtro) return false;
    for (let n = 0; n < total; n++) {
      if (formatNumber(n, cifras).includes(filtro)) return false;
    }
    return true;
  }, [filtro, total, cifras]);

  // ── Refresco del tablero ───────────────────────────────────────────────
  const pidiendoRef = useRef(false);
  // Un refresco pedido mientras otro va en camino (el de después de un 409)
  // no se pierde: se hace en cuanto vuelva el que está en curso. Ese podía
  // haber salido ANTES de la reserva ajena y repintaría en blanco los
  // números que el 409 acaba de poner en amarillo.
  const otraVezRef = useRef(false);
  // Una respuesta que llega con el tablero ya desmontado (salió a su pedido
  // mientras la consulta iba en camino) no toca nada.
  const montadoRef = useRef(false);
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);
  const refrescar = useCallback(async () => {
    // Una consulta a la vez: si la red va lenta no se apilan.
    if (pidiendoRef.current) {
      otraVezRef.current = true;
      return;
    }
    pidiendoRef.current = true;
    try {
      do {
        otraVezRef.current = false;
        try {
          const res = await fetch(`/api/public/raffles/${raffle.slug}/board`, {
            cache: "no-store",
          });
          if (!res.ok) continue;
          const data = (await res.json().catch(() => null)) as {
            tablero?: unknown;
          } | null;
          const nuevo = data?.tablero;
          // Una respuesta con otra forma se descarta: mejor un tablero de
          // hace 15 segundos que uno roto.
          if (!tableroValido(nuevo, total)) continue;
          if (!montadoRef.current) return;
          setTablero(nuevo);
          // Con el modal abierto no se le toca la selección bajo los pies:
          // si alguien se le adelantó, el servidor lo dice al reservar (409)
          // y, si cierra el modal sin reservar, se pone al día al cerrarlo.
          if (!modalAbiertoRef.current) retirarPerdidos(nuevo);
        } catch {
          // Sin conexión no se toca nada: el siguiente intento lo pone al día.
        }
      } while (otraVezRef.current);
    } finally {
      pidiendoRef.current = false;
    }
  }, [raffle.slug, total, retirarPerdidos]);

  // Un vistazo nada más montar: si llega aquí con "atrás" desde su pedido, el
  // tablero que trae la página puede ser el de antes de su propia reserva.
  useEffect(() => {
    if (soloLectura) return;
    let vivo = true;
    (async () => {
      await Promise.resolve();
      if (vivo) await refrescar();
    })();
    return () => {
      vivo = false;
    };
  }, [soloLectura, refrescar]);

  // Cada 15 s con la pestaña a la vista, y al volver a ella. Con el modal
  // abierto se espera: quitarle un número mientras escribe su nombre sería
  // peor, y si alguien se lo ganó el servidor lo dice al reservar (409).
  useEffect(() => {
    if (soloLectura || checkoutOpen) return;
    function siEstaALaVista() {
      if (document.visibilityState === "visible") void refrescar();
    }
    function alVolverDelHistorial(e: PageTransitionEvent) {
      if (e.persisted) void refrescar();
    }
    const reloj = window.setInterval(siEstaALaVista, REFRESCO_MS);
    document.addEventListener("visibilitychange", siEstaALaVista);
    window.addEventListener("pageshow", alVolverDelHistorial);
    return () => {
      window.clearInterval(reloj);
      document.removeEventListener("visibilitychange", siEstaALaVista);
      window.removeEventListener("pageshow", alVolverDelHistorial);
    };
  }, [soloLectura, checkoutOpen, refrescar]);

  // El aviso breve se va solo; el importante se queda hasta que lo cierre.
  useEffect(() => {
    if (!aviso || aviso.importante) return;
    const reloj = window.setTimeout(() => setAviso(null), AVISO_BREVE_MS);
    return () => window.clearTimeout(reloj);
  }, [aviso]);

  // ── Tocar una casilla ──────────────────────────────────────────────────
  function tocarCasilla(n: number) {
    if (soloLectura || n < 0 || n >= total) return;
    // Lo que ya escogió se puede soltar SIEMPRE, aunque el tablero lo dé ya
    // por tomado: si no, un número que alguien le ganó se quedaría pegado en
    // su selección (y en su total) hasta el siguiente refresco.
    if (seleccion.has(n)) {
      setSeleccion((prev) => {
        const next = new Set(prev);
        next.delete(n);
        return next;
      });
      return;
    }
    const etiqueta = formatNumber(n, cifras);
    const estado = leerCasilla(tablero, n);
    if (estado !== "libre") {
      avisar(
        estado === "reservado"
          ? `El ${etiqueta} ya está reservado.`
          : estado === "pagado"
            ? `El ${etiqueta} ya está pagado.`
            : `El ${etiqueta} no está disponible.`,
        false
      );
      return;
    }
    // Tope de la reserva: se dice por qué la casilla no responde, en vez de
    // ignorar el toque en silencio (mismo criterio que la rifa grande).
    if (seleccion.size >= raffle.maxNumbersPerOrder) {
      avisar(
        `Este sorteo permite máximo ${raffle.maxNumbersPerOrder} números por reserva. Quita alguno para escoger otro.`,
        false
      );
      return;
    }
    setSeleccion((prev) => {
      const next = new Set(prev);
      next.add(n);
      return next;
    });
  }

  function alTocarTablero(e: React.MouseEvent<HTMLDivElement>) {
    const boton = (e.target as HTMLElement).closest<HTMLElement>("[data-n]");
    if (!boton) return;
    const n = Number(boton.dataset.n);
    if (Number.isInteger(n)) tocarCasilla(n);
  }

  function irABloque(inicio: number) {
    const destino = document.getElementById(`bloque-${inicio}`);
    if (!destino) return;
    const sinMovimiento = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    destino.scrollIntoView({
      behavior: sinMovimiento ? "auto" : "smooth",
      block: "start",
    });
    destino.focus({ preventScroll: true });
  }

  function abrirReserva() {
    setFormError("");
    setCheckoutOpen(true);
    // Aviso a Meta de que empezo el checkout: es la senal que deja medir
    // cuanta gente llega hasta aqui y luego no paga. Solo viaja el valor,
    // nunca datos del comprador ni sus numeros.
    eventoMeta("InitiateCheckout", {
      value: totalPedido,
      currency: "COP",
      num_items: cantidad,
    });
  }

  async function reservar() {
    if (name.trim().length < 2) {
      setFormError("Escribe tu nombre");
      return;
    }
    // El celular se juzga con la MISMA regla del servidor (normalizeWhatsApp):
    // con solo contar 10 dígitos pasaba un "1234567890" que el servidor
    // rechaza, y el comprador perdía el viaje.
    if (raffle.askPhone && !phone.trim()) {
      setFormError("Escribe tu número de WhatsApp");
      return;
    }
    if (raffle.askPhone && !normalizeWhatsApp(phone)) {
      setFormError("Revisa tu número de WhatsApp: escribe tu celular de 10 dígitos");
      return;
    }
    if (raffle.askIdNumber && idNumber.length < 5) {
      setFormError("Escribe tu cédula (mínimo 5 dígitos)");
      return;
    }
    // Cerrojo: un segundo toque no crea otra reserva. Se suelta solo en los
    // caminos de FALLO; si la reserva sale bien, el boton se queda bloqueado
    // hasta que el navegador cambie de pagina.
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setSubmitting(true);
    setFormError("");
    try {
      // Solo viaja lo que esta rifa pide: el servidor descarta el resto de
      // todas formas, y así no sale del navegador un dato que nadie pidió.
      const body = {
        raffleSlug: raffle.slug,
        name: name.trim(),
        numbers: elegidos,
        ...(raffle.askPhone ? { phone } : {}),
        ...(raffle.askIdNumber ? { idNumber } : {}),
        ...(raffle.askEmail && email.trim() ? { email: email.trim() } : {}),
        ...(raffle.askCity && city.trim() ? { city: city.trim() } : {}),
      };
      const res = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Los números perdidos se nombran ANTES de tocar el estado: el
        // actualizador de React no corre en el acto. Solo cuentan enteros
        // que de verdad están en su selección: si no quedara ninguno, el
        // aviso diría "reservó el  antes que tú".
        const tomados =
          res.status === 409 && Array.isArray(data.conflicting)
            ? (data.conflicting as unknown[])
                .filter(
                  (n): n is number =>
                    typeof n === "number" && Number.isInteger(n) && seleccion.has(n)
                )
                .sort((a, b) => a - b)
            : [];
        if (tomados.length > 0) {
          setSeleccion((prev) => {
            const next = new Set(prev);
            for (const n of tomados) next.delete(n);
            return next;
          });
          // Se pintan ya en amarillo, sin esperar al refresco: si no, seguirían
          // en blanco unos segundos y volvería a tocarlos.
          setTablero((prev) => {
            const letras = prev.split("");
            for (const n of tomados) {
              if (letras[n] === "0") letras[n] = "1";
            }
            return letras.join("");
          });
          setCheckoutOpen(false);
          setFormError("");
          enviandoRef.current = false;
          setSubmitting(false);
          const etiquetas = unirNumeros(tomados.map((n) => formatNumber(n, cifras)));
          avisar(
            tomados.length === 1
              ? `Otra persona reservó el ${etiquetas} antes que tú. Lo quitamos de tu selección: escoge otro.`
              : `Otra persona reservó los números ${etiquetas} antes que tú. Los quitamos de tu selección: escoge otros.`,
            true
          );
          void refrescar();
          return;
        }
        // Cualquier otro rechazo (reserva mínima, datos, demasiados intentos)
        // ya viene redactado para el comprador: se muestra tal cual.
        enviandoRef.current = false;
        setSubmitting(false);
        setFormError(data.error || "No fue posible hacer tu reserva");
        return;
      }
      if (typeof data.code !== "string" || !data.code) {
        enviandoRef.current = false;
        setSubmitting(false);
        setFormError("No fue posible hacer tu reserva. Intenta de nuevo.");
        return;
      }
      // La pantalla del pedido abre WhatsApp sola con el nombre y los números.
      router.push(`/pedido/${data.code}?enviar=1`);
    } catch {
      enviandoRef.current = false;
      setSubmitting(false);
      setFormError("Error de conexión. Intenta de nuevo.");
    }
    // Sin `finally`: reactivaba el boton entre la respuesta y el cambio de
    // pagina, que es justo la ventana del doble toque.
  }

  // Leyenda: solo explica los colores, nunca lleva cantidades. "No
  // disponible" y "Con premio" solo salen si de verdad hay alguno.
  const leyenda: { texto: string; muestra: string; icono?: "reloj" | "chulo" | "estrella" }[] = [
    { texto: "Libre", muestra: "border border-cell-line bg-cell-free text-cell-ink" },
    { texto: "Reservado", muestra: "bg-cell-reserved text-cell-ink", icono: "reloj" },
    { texto: "Pagado", muestra: "bg-cell-paid text-cell-ink", icono: "chulo" },
  ];
  if (!soloLectura) {
    leyenda.push({ texto: "Tu selección", muestra: "bg-brand text-white", icono: "chulo" });
  }
  if (hayBloqueados) {
    leyenda.push({ texto: "No disponible", muestra: "bg-cell-blocked text-cell-ink" });
  }
  if (hayPremiados) {
    leyenda.push({
      texto: "Con premio",
      muestra: "border border-cell-line bg-cell-free text-cell-ink",
      icono: "estrella",
    });
  }

  const destinatario = companyName.trim();
  const verPie = hayPedido || Boolean(aviso);

  return (
    <section id="elegir" className="mt-6 flex flex-col gap-5">
      {/* Avisos para el lector de pantalla: regiones fijas, siempre montadas,
          para que el cambio de texto se anuncie de verdad. */}
      <p role="status" className="sr-only">
        {aviso && !aviso.importante ? aviso.texto : ""}
      </p>
      <p role="alert" className="sr-only">
        {aviso && aviso.importante ? aviso.texto : ""}
      </p>

      {soloLectura ? (
        <h2 className="flex items-center gap-2.5 font-display text-lg font-black uppercase tracking-[0.06em] text-fg sm:text-xl">
          <span
            aria-hidden="true"
            className="glow-brand-sm h-[7px] w-[7px] shrink-0 rounded-full bg-brand"
          />
          Tablero de números
        </h2>
      ) : (
        // La manito que pidió el dueño: dice, antes que nada, que los números
        // se escogen aquí abajo. Rebota salvo con movimiento reducido.
        <div className="flex flex-col items-center pt-2 text-center">
          <span
            aria-hidden="true"
            className="block animate-bounce text-5xl leading-none motion-reduce:animate-none"
          >
            👇
          </span>
          <h2 className="mt-3 font-display text-xl font-black uppercase leading-tight tracking-[0.04em] text-fg sm:text-2xl">
            Escoge tus números aquí abajo
          </h2>
        </div>
      )}

      {/* La reserva mínima es una condición del sorteo: se dice ARRIBA, antes
          de escoger, en ámbar (aviso) y nunca en rojo. */}
      {!soloLectura && hayMinimo ? (
        <p className="rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 text-center text-sm font-bold leading-snug text-warn">
          Reserva mínima: {minPorPedido} números
        </p>
      ) : null}

      {/* Buscador: filtra el tablero mientras escribe. */}
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="bp-buscar" className={`mb-2 block ${labelCls}`}>
            Buscar número
          </label>
          <div className="relative">
            <input
              id="bp-buscar"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={cifras}
              value={busqueda}
              onChange={(e) =>
                setBusqueda(e.target.value.replace(/\D/g, "").slice(0, cifras))
              }
              // "00" en gris se confundía con algo ya escrito: el ejemplo
              // dice qué escribir y cómo se ve un número de esta rifa.
              placeholder={`Ej: ${formatNumber(7, cifras)}`}
              className={`${inputCls} pr-14 font-display text-lg font-bold tracking-[0.2em]`}
            />
            {busqueda ? (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                aria-label="Borrar búsqueda"
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-fg-soft hover:text-fg"
              >
                <IconX width={18} height={18} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Saltos por centena en las rifas de 3 cifras. Envuelven en varias
            filas en vez de deslizarse: así ningún bloque queda escondido. */}
        {conBloques && !busqueda ? (
          <nav aria-label="Ir a un bloque de números">
            <ul className="flex flex-wrap gap-1.5">
              {bloques.map((b) => (
                <li key={b.inicio}>
                  <button
                    type="button"
                    onClick={() => irABloque(b.inicio)}
                    aria-label={`Ir a los números del ${formatNumber(b.inicio, cifras)} al ${formatNumber(b.fin - 1, cifras)}`}
                    className="min-h-11 min-w-12 rounded-xl border border-line-strong bg-well px-2.5 font-display text-sm font-black tabular-nums text-fg transition-colors hover:border-brand hover:text-brand"
                  >
                    {formatNumber(b.inicio, cifras)}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>

      {/* Leyenda de colores: sin cantidades. Cada muestra lleva el mismo
          icono que la casilla, porque el color solo no basta. */}
      <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {leyenda.map((l) => (
          <li key={l.texto} className={`flex items-center gap-1.5 ${labelCls}`}>
            <span
              aria-hidden="true"
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] leading-none ${l.muestra}`}
            >
              {l.icono === "reloj" ? (
                <IconClock width={11} height={11} strokeWidth={2.75} />
              ) : l.icono === "chulo" ? (
                <IconCheck width={12} height={12} strokeWidth={3.25} />
              ) : l.icono === "estrella" ? (
                "★"
              ) : null}
            </span>
            {l.texto}
          </li>
        ))}
      </ul>

      {/* El tablero. El clic se recoge aquí, una sola vez, y no en cada
          casilla (ver Bloque). */}
      <div
        role="group"
        aria-label="Tablero de números"
        onClick={alTocarTablero}
        className="rounded-3xl border border-line bg-card p-2 sm:p-3"
      >
        {bloques.map((b) => (
          <Bloque
            key={b.inicio}
            inicio={b.inicio}
            marcas={marcas.slice(b.inicio, b.fin)}
            cifras={cifras}
            filtro={filtro}
            premios={premios}
            soloLectura={soloLectura}
            conEncabezado={conBloques}
          />
        ))}
        {sinCoincidencias ? (
          <p className="px-2 py-6 text-center text-sm text-fg-soft">
            Ningún número contiene “{filtro}”.
          </p>
        ) : null}
      </div>

      {/* Límites de la reserva: condiciones del sorteo, nunca cantidades.
          Un tope que no cabe en el tablero (el máximo de la rifa grande
          heredado, 5.000 en una de 100) no limita nada: no se nombra. */}
      {!soloLectura && (hayMinimo || hayTope) ? (
        <p className="text-center text-xs text-fg-faint">
          {hayMinimo
            ? `Entre ${minPorPedido} y ${Math.min(raffle.maxNumbersPerOrder, total)} números por reserva.`
            : `Máximo ${raffle.maxNumbersPerOrder} números por reserva.`}
        </p>
      ) : null}

      {/* Pie fijo: el aviso breve y la barra de RESERVAR. Se apoya encima de
          la navegación inferior y del aviso de demostración, igual que la
          barra de la rifa grande, para que el botón nunca quede tapado. */}
      <div
        style={{ bottom: "calc(var(--barra-inferior-h) + var(--aviso-demo-h))" }}
        className={`fixed inset-x-0 z-30 transition-all duration-300 motion-reduce:transition-none ${
          verPie
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-full opacity-0"
        }`}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 pb-3">
          {aviso ? (
            <div
              className={`flex items-start justify-between gap-3 rounded-2xl border bg-card px-4 py-2.5 shadow-card ${
                aviso.importante ? "border-brand/60" : "border-line-strong"
              }`}
            >
              {/* aria-hidden: el texto ya lo anuncian las regiones de arriba. */}
              <p aria-hidden="true" className="py-1 text-sm leading-relaxed text-fg">
                {aviso.texto}
              </p>
              <button
                type="button"
                onClick={() => setAviso(null)}
                aria-label="Cerrar aviso"
                className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-fg-soft hover:text-fg"
              >
                <IconX width={16} height={16} />
              </button>
            </div>
          ) : null}

          {hayPedido ? (
            <div className="neon-card rounded-3xl bg-card px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={labelCls}>Valor total</p>
                  <p className="font-display text-2xl font-black leading-tight tabular-nums text-brand">
                    {formatCop(totalPedido)}
                  </p>
                  <p className="truncate text-xs font-semibold text-fg-soft">
                    {cantidad} {cantidad === 1 ? "número" : "números"} ·{" "}
                    <span className="tabular-nums">
                      {elegidos.map((n) => formatNumber(n, cifras)).join(", ")}
                    </span>
                  </p>
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
                  onClick={abrirReserva}
                  disabled={!puedeReservar}
                  aria-describedby={
                    faltanParaMinimo > 0 ? "aviso-reserva-minima" : undefined
                  }
                  className="glow-wa inline-flex min-h-13 shrink-0 items-center gap-2 rounded-2xl bg-wa px-5 text-base font-black uppercase tracking-wide text-white transition-all hover:bg-wa-dark active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-wa disabled:active:scale-100 motion-reduce:transition-none"
                >
                  <IconWhatsApp width={19} height={19} />
                  Reservar
                </button>
              </div>
              {faltanParaMinimo > 0 ? (
                <p
                  id="aviso-reserva-minima"
                  className="mt-2.5 border-t border-line pt-2.5 text-xs font-semibold leading-relaxed text-warn"
                >
                  Te {faltanParaMinimo === 1 ? "falta" : "faltan"}{" "}
                  {faltanParaMinimo}{" "}
                  {faltanParaMinimo === 1 ? "número" : "números"} para la
                  reserva mínima de {minPorPedido}.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Modal de la reserva */}
      {checkoutOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bp-titulo"
          onClick={cerrarReserva}
        >
          <div
            ref={panelRef}
            tabIndex={-1}
            className="glow-brand modal-in max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-2 border-brand bg-card p-5 outline-none sm:rounded-3xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3
                id="bp-titulo"
                className="font-display text-xl font-black uppercase tracking-[0.04em] text-fg"
              >
                Reservar mis números
              </h3>
              <button
                type="button"
                onClick={cerrarReserva}
                aria-label="Cerrar"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-well text-fg-soft hover:text-fg"
              >
                <IconX width={18} height={18} />
              </button>
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-light">
                {raffle.title}
              </p>
              <p className={`mt-3 ${labelCls}`}>Tus números</p>
              <ul className="mt-2 flex max-h-28 flex-wrap justify-center gap-1.5 overflow-y-auto">
                {elegidos.map((n) => {
                  const premio = premios.get(n);
                  return (
                    <li
                      key={n}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-display text-sm font-black tracking-wider tabular-nums ${
                        premio ? "ticket-chip-win text-ink" : "ticket-chip text-white"
                      }`}
                    >
                      {premio ? <span aria-hidden="true">★</span> : null}
                      {formatNumber(n, cifras)}
                      {premio ? (
                        <span className="sr-only">, con premio: {premio}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <p className={`mt-4 ${labelCls}`}>Valor total</p>
              <p className="mt-1 font-display text-4xl font-black tabular-nums text-fg sm:text-5xl">
                {formatCop(totalPedido)}
              </p>
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
            </div>

            <div className="mt-5 flex flex-col gap-3.5">
              <div>
                <label htmlFor="bp-name" className="mb-1.5 block text-sm font-semibold text-fg">
                  Tu nombre
                </label>
                <input
                  id="bp-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                  maxLength={120}
                  autoComplete="name"
                  required
                />
              </div>
              {raffle.askPhone ? (
                <div>
                  <label htmlFor="bp-phone" className="mb-1.5 block text-sm font-semibold text-fg">
                    Tu celular (WhatsApp)
                  </label>
                  <input
                    id="bp-phone"
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputCls}
                    maxLength={15}
                    autoComplete="tel"
                    required
                  />
                </div>
              ) : null}
              {raffle.askIdNumber ? (
                <div>
                  <label htmlFor="bp-id" className="mb-1.5 block text-sm font-semibold text-fg">
                    Tu cédula
                  </label>
                  <input
                    id="bp-id"
                    type="text"
                    inputMode="numeric"
                    value={idNumber}
                    onChange={(e) =>
                      setIdNumber(e.target.value.replace(/\D/g, "").slice(0, 15))
                    }
                    className={inputCls}
                    maxLength={15}
                    autoComplete="off"
                    required
                  />
                </div>
              ) : null}
              {raffle.askEmail ? (
                <div>
                  <label htmlFor="bp-email" className="mb-1.5 block text-sm font-semibold text-fg">
                    Correo <span className="font-normal text-fg-faint">(opcional)</span>
                  </label>
                  <input
                    id="bp-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls}
                    maxLength={200}
                    autoComplete="email"
                  />
                </div>
              ) : null}
              {raffle.askCity ? (
                <div>
                  <label htmlFor="bp-city" className="mb-1.5 block text-sm font-semibold text-fg">
                    Ciudad o municipio{" "}
                    <span className="font-normal text-fg-faint">(opcional)</span>
                  </label>
                  <input
                    id="bp-city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className={inputCls}
                    maxLength={80}
                    autoComplete="address-level2"
                  />
                </div>
              ) : null}

              {/* Aviso de tratamiento de datos (Ley 1581). Si esta rifa publica
                  el ranking, se le nombra: ahí su nombre abreviado puede acabar
                  en una página abierta a internet. */}
              <p className="text-xs leading-relaxed text-fg-faint">
                Al reservar aceptas el tratamiento de tus datos según nuestra{" "}
                <a
                  href="/privacidad"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-fg"
                >
                  política de privacidad
                </a>
                .
                {raffle.showRanking
                  ? " En este sorteo, si quedas entre los diez que más números pagados llevan, se publica tu nombre abreviado y la cantidad."
                  : null}
              </p>

              {formError ? (
                <p role="alert" className="text-sm font-semibold text-error">
                  {formError}
                </p>
              ) : null}

              <button
                type="button"
                onClick={reservar}
                disabled={submitting}
                className="glow-wa mt-1 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-wa px-5 text-base font-black text-white transition-all hover:bg-wa-dark disabled:opacity-60 motion-reduce:transition-none"
              >
                {submitting ? (
                  "Reservando…"
                ) : (
                  <>
                    <IconWhatsApp width={19} height={19} />
                    Reservar y enviar por WhatsApp
                  </>
                )}
              </button>
              <p className="text-center text-xs leading-relaxed text-fg-faint">
                {destinatario
                  ? `Te llevamos a WhatsApp con tus números para que se los envíes a ${destinatario}.`
                  : "Te llevamos a WhatsApp con tus números para que nos los envíes."}{" "}
                Tu reserva dura {formatearPlazo(raffle.reservationMinutes)}.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
