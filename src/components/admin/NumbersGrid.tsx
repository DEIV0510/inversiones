"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { listaDeNumeros, type EstadoCasilla } from "@/lib/cuadricula";
import { formatCop, formatearPlazo } from "@/lib/format";
import { formatNumber } from "@/lib/numbers";
import {
  IconCandado,
  IconCheck,
  IconClock,
  IconWhatsApp,
  IconX,
} from "@/components/icons";
import { useModalA11y } from "@/components/useModalA11y";
import {
  btnOutline,
  btnPrimary,
  formatDate,
  helpCls,
  inputCls,
  labelCls,
} from "./ui";

/**
 * TABLERO DEL DUEÑO de una rifa de cuadrícula (2 o 3 cifras).
 *
 * Es el mismo tablero que ve el comprador —blanco libre, amarillo reservado,
 * verde pagado, gris bloqueado, número en negro— pero con lo que el público
 * jamás ve: de quién es cada casilla. Desde aquí el dueño lleva la rifa
 * entera sin buscar códigos:
 *   · toca una AMARILLA → ve quién la reservó y la marca pagada o la libera;
 *   · toca una VERDE    → ve el pago y, si lo marcó a mano, puede anularlo;
 *   · toca una GRIS     → la desbloquea;
 *   · toca BLANCAS      → las aparta (o las vende ya pagadas) a nombre de
 *                          quien le escribió por WhatsApp sin pasar por la
 *                          página.
 *
 * Solo existe para rifas de 1.000 números o menos (lo garantiza el API): la
 * rifa grande nunca se carga entera.
 */

export type RifaTablero = {
  id: string;
  title: string;
  digits: number;
  totalNumbers: number;
  status: string;
  pricePerNumber: number;
  /** Plazo de una reserva; solo se usa para explicarlo al apartar a mano. */
  reservationMinutes?: number;
};

type CasillaApi = {
  value: number;
  status: "RESERVED" | "PAID" | "BLOCKED";
  orderId: string | null;
};

type PedidoTablero = {
  id: string;
  code: string;
  status: string;
  paymentMethod: string | null;
  /** Ya vienen en orden y con sus ceros ("07"). */
  numbers: string[];
  quantity: number;
  total: number;
  reservedUntil: string | null;
  createdAt: string;
  paidAt: string | null;
  participant: {
    name: string;
    phone: string | null;
    idNumber: string | null;
    city: string | null;
  };
};

type TableroApi = {
  total: number;
  digits: number;
  status: string;
  casillas: CasillaApi[];
  pedidos: PedidoTablero[];
};

type Filtro = "todos" | EstadoCasilla;

/**
 * Pasos de la hoja de detalle. Lo que cambia dinero o libera números pasa
 * SIEMPRE por un paso de confirmación que nombra los números; anular una
 * venta, por dos.
 */
type Paso = "ver" | "pagar" | "liberar" | "anular" | "anular2";

/** Cada cuánto se vuelve a pedir el tablero mientras la pestaña está a la vista. */
const REFRESCO_MS = 20_000;

const ESTADO_DE_API: Record<CasillaApi["status"], EstadoCasilla> = {
  RESERVED: "reservado",
  PAID: "pagado",
  BLOCKED: "bloqueado",
};

/* Colores de la casilla: los MISMOS del tablero público (tokens cell-* de
   globals.css, que no cambian con el tema). Van escritos enteros porque
   Tailwind solo genera las clases que lee tal cual en el código. */
const CASILLA_CLS: Record<EstadoCasilla, string> = {
  libre: "border-cell-line bg-cell-free",
  reservado: "border-cell-reserved bg-cell-reserved",
  pagado: "border-cell-paid bg-cell-paid",
  bloqueado: "border-cell-blocked bg-cell-blocked",
};

const TITULO_ESTADO: Record<EstadoCasilla, string> = {
  libre: "Libre",
  reservado: "Reservado · falta el pago",
  pagado: "Pagado",
  bloqueado: "Bloqueado",
};

const FILTROS: { value: Filtro; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "libre", label: "Libres" },
  { value: "reservado", label: "Reservados" },
  { value: "pagado", label: "Pagados" },
  { value: "bloqueado", label: "Bloqueados" },
];

/* Aviso de error: rosa sobre violeta, igual en todos los módulos. */
const alertCls =
  "rounded-xl border border-error/35 bg-error/10 px-4 py-3 text-sm font-medium text-error";
const modalPanelCls =
  "modal-in max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-card p-5 outline-none sm:rounded-3xl sm:p-6";
const overlayCls =
  "fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4";
/* Acción de aprobación: pastilla verde, la misma de Pedidos. */
const btnOk =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-wa/45 bg-wa/12 px-5 text-xs font-bold uppercase tracking-[0.1em] text-wa-ink transition-colors hover:bg-wa/20 disabled:opacity-50";
/* Acción destructiva: pastilla rosa, la misma de Pedidos. */
const btnDanger =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-error/45 bg-error/10 px-5 text-xs font-bold uppercase tracking-[0.1em] text-error transition-colors hover:bg-error/20 disabled:opacity-50";
const btnIcono =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-well text-fg-soft transition-colors hover:text-fg";
/* Posición de lo que flota abajo: encima de la navegación del móvil (que
   publica su alto en --barra-inferior-h) y del borde seguro del iPhone. */
const flotanteStyle = {
  bottom: "calc(var(--barra-inferior-h) + env(safe-area-inset-bottom) + 0.75rem)",
};

/** "1 número" / "25 números": los avisos no pueden decir "1 números". */
function cantidad(n: number): string {
  return n === 1 ? "1 número" : `${n.toLocaleString("es-CO")} números`;
}

/** Sin tildes y en minúsculas: "Andrés" se encuentra escribiendo "andres". */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** "hace 5 min", "hace 3 horas", "hace 2 días". */
function haceCuanto(fecha: string, ahora: number): string {
  const min = Math.max(0, Math.round((ahora - new Date(fecha).getTime()) / 60_000));
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return horas === 1 ? "hace 1 hora" : `hace ${horas} horas`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "hace 1 día" : `hace ${dias} días`;
}

/** "en 40 min", "en 22 horas" o "ya venció". */
function venceEn(fecha: string, ahora: number): string {
  const min = Math.round((new Date(fecha).getTime() - ahora) / 60_000);
  if (min <= 0) return "ya venció";
  if (min < 60) return `en ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return horas === 1 ? "en 1 hora" : `en ${horas} horas`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "en 1 día" : `en ${dias} días`;
}

function metodoDePago(metodo: string | null): string {
  if (!metodo) return "Sin registrar";
  if (metodo === "manual") return "Manual";
  if (metodo === "bold") return "Bold";
  if (metodo === "wompi") return "Wompi";
  if (metodo === "whatsapp") return "WhatsApp";
  return metodo;
}

/**
 * Un pago que entró por la pasarela es plata que ya está en Bold o Wompi:
 * anularlo aquí liberaría los números sin devolver nada. Ese caso se arregla
 * con la pasarela, nunca con un botón del tablero.
 */
function esPagoEnLinea(metodo: string | null): boolean {
  return metodo === "bold" || metodo === "wompi";
}

/** Solo se anula desde aquí lo que el dueño marcó a mano. */
function esPagoManual(metodo: string | null): boolean {
  return !metodo || metodo === "manual";
}

/** Celular listo para wa.me: solo cifras. */
function cifrasDe(texto: string): string {
  return texto.replace(/\D/g, "");
}

/** Agrupa números sueltos en tramos seguidos: [3,4,5,9] → [[3,5],[9,9]]. */
function tramos(numeros: number[]): [number, number][] {
  const salida: [number, number][] = [];
  for (const n of [...numeros].sort((a, b) => a - b)) {
    const ultimo = salida[salida.length - 1];
    if (ultimo && n === ultimo[1] + 1) ultimo[1] = n;
    else salida.push([n, n]);
  }
  return salida;
}

/* Marca de cada estado: el color nunca es la única señal. */
function MarcaEstado({
  estado,
  className,
}: {
  estado: EstadoCasilla;
  className?: string;
}) {
  if (estado === "reservado") return <IconClock className={className} />;
  if (estado === "pagado") return <IconCheck className={className} />;
  if (estado === "bloqueado") return <IconCandado className={className} />;
  return null;
}

export default function NumbersGrid({
  raffle,
  canConfirm,
  canCancel,
  canBlock,
  recarga = 0,
  onCambio,
}: {
  raffle: RifaTablero;
  canConfirm: boolean;
  canCancel: boolean;
  canBlock: boolean;
  /** Al cambiar, el tablero se vuelve a pedir (por ejemplo, tras bloquear un rango abajo). */
  recarga?: number;
  /** Algo cambió aquí: sirve para refrescar las herramientas de abajo. */
  onCambio?: () => void;
}) {
  const uid = useId();
  const [datos, setDatos] = useState<TableroApi | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  // Hora de la última carga: de aquí salen "hace 5 min" y "vence en 3 horas"
  // sin leer el reloj mientras se pinta.
  const [ahora, setAhora] = useState(0);
  const [version, setVersion] = useState(0);

  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<number[]>([]);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  // Hoja de detalle de una casilla tomada. El paso guarda de qué pedido se
  // estaba hablando: si mientras tanto la casilla cambia de dueño, la
  // confirmación no se aplica al pedido nuevo.
  const [abierta, setAbierta] = useState<number | null>(null);
  const [paso, setPaso] = useState<{ tipo: Paso; pedidoId: string | null }>({
    tipo: "ver",
    pedidoId: null,
  });
  const [errorAccion, setErrorAccion] = useState("");

  // Apartar a mano.
  const [apartarAbierto, setApartarAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [yaPago, setYaPago] = useState(false);
  const [errorApartar, setErrorApartar] = useState("");

  // Bloquear lo escogido.
  const [bloquearAbierto, setBloquearAbierto] = useState(false);
  const [errorBloqueo, setErrorBloqueo] = useState("");

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  // Sin setState síncrono en el cuerpo del efecto: todo pasa después de la
  // respuesta. Si la petición falla con un tablero ya pintado, se deja el
  // tablero viejo a la vista con el aviso encima (mejor que una pantalla
  // vacía en medio de una venta).
  useEffect(() => {
    let vivo = true;
    const control = new AbortController();
    (async () => {
      try {
        const params = new URLSearchParams({ raffleId: raffle.id, grid: "1" });
        const res = await fetch(`/api/admin/numbers?${params.toString()}`, {
          cache: "no-store",
          signal: control.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!vivo) return;
        if (!res.ok || !data.grid) {
          setErrorCarga(data.error || "No fue posible cargar el tablero");
          return;
        }
        setErrorCarga("");
        setDatos(data.grid as TableroApi);
        setAhora(Date.now());
      } catch {
        if (vivo) {
          setErrorCarga(
            "Error de conexión: lo que ves puede no estar al día. Vuelve a intentarlo."
          );
        }
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
      control.abort();
    };
  }, [raffle.id, version, recarga]);

  // Al día sin tocar nada: cada 20 s mientras la pestaña está a la vista y en
  // cuanto el dueño vuelve a ella (por ejemplo, después de ir a WhatsApp a
  // cobrar). Con la pestaña oculta no se pide nada.
  useEffect(() => {
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") recargar();
    }, REFRESCO_MS);
    function alVolver() {
      if (document.visibilityState === "visible") recargar();
    }
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [recargar]);

  // El aviso de "listo" se retira solo; el dueño también puede cerrarlo.
  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(""), 9000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const total = datos?.total ?? raffle.totalNumbers;
  const digits = datos?.digits ?? raffle.digits;
  const fmt = (n: number) => formatNumber(n, digits);

  const casillas = useMemo(() => {
    const mapa = new Map<number, CasillaApi>();
    for (const c of datos?.casillas ?? []) mapa.set(c.value, c);
    return mapa;
  }, [datos]);
  const pedidos = useMemo(
    () => new Map((datos?.pedidos ?? []).map((p) => [p.id, p] as const)),
    [datos]
  );

  function estadoDe(n: number): EstadoCasilla {
    const c = casillas.get(n);
    return c ? ESTADO_DE_API[c.status] : "libre";
  }

  function pedidoDe(n: number): PedidoTablero | null {
    const id = casillas.get(n)?.orderId;
    return id ? (pedidos.get(id) ?? null) : null;
  }

  // Conteos y plata del tablero. Las reservas vencidas no llegan del API:
  // cuentan como libres, igual que en la página pública.
  const conteo: Record<EstadoCasilla, number> = {
    libre: 0,
    reservado: 0,
    pagado: 0,
    bloqueado: 0,
  };
  for (const c of casillas.values()) {
    if (c.value < total) conteo[ESTADO_DE_API[c.status]] += 1;
  }
  conteo.libre = Math.max(
    0,
    total - conteo.reservado - conteo.pagado - conteo.bloqueado
  );
  let cobrado = 0;
  let porCobrar = 0;
  for (const p of datos?.pedidos ?? []) {
    if (p.status === "PAID") cobrado += p.total;
    else if (p.status === "PENDING") porCobrar += p.total;
  }

  // Buscador: con cifras (hasta las de la rifa) busca el número; con más
  // cifras, el celular; con letras, el nombre o el código del pedido.
  const q = busqueda.trim();
  const cifrasQ = cifrasDe(q);
  const buscaNumero = /^\d+$/.test(q) && q.length <= digits;
  const buscaCelular =
    !buscaNumero && cifrasQ.length > digits && /^[\d\s+().-]+$/.test(q);
  const textoQ = normalizar(q);

  function coincide(n: number): boolean {
    if (filtro !== "todos" && estadoDe(n) !== filtro) return false;
    if (!q) return true;
    if (buscaNumero) return fmt(n).includes(q);
    const pedido = pedidoDe(n);
    if (!pedido) return false;
    if (buscaCelular) {
      return cifrasDe(pedido.participant.phone ?? "").includes(cifrasQ);
    }
    return (
      normalizar(pedido.participant.name).includes(textoQ) ||
      pedido.code.toLowerCase().includes(textoQ)
    );
  }

  // De 100 en 100 cuando la rifa pasa de 100 números: un encabezado por
  // centena y los botones de salto de arriba.
  const porCentenas = total > 100;
  const centenas = Array.from(
    { length: porCentenas ? Math.ceil(total / 100) : 1 },
    (_, k) => k
  );
  const visiblesPorCentena = new Map<number, number[]>();
  let visibles = 0;
  for (let n = 0; n < total; n++) {
    if (!coincide(n)) continue;
    const k = porCentenas ? Math.floor(n / 100) : 0;
    const lista = visiblesPorCentena.get(k) ?? [];
    lista.push(n);
    visiblesPorCentena.set(k, lista);
    visibles += 1;
  }
  const filtrando = filtro !== "todos" || q !== "";
  const idCentena = (k: number) => `${uid}-centena-${k}`;

  const estadoRifa = datos?.status ?? raffle.status;
  const enVenta = estadoRifa !== "FINISHED" && estadoRifa !== "CANCELLED";
  const puedeApartar = canConfirm && enVenta;
  const puedeSeleccionar = puedeApartar || canBlock;

  // Lo escogido que sigue libre. Si mientras escogía alguien reservó uno, ese
  // ya no se aparta (y se le dice en la barra).
  const seleccionLibre = seleccion
    .filter((n) => estadoDe(n) === "libre")
    .sort((a, b) => a - b);
  const seleccionPerdida = seleccion
    .filter((n) => estadoDe(n) !== "libre")
    .sort((a, b) => a - b);
  const listaSeleccion = listaDeNumeros(seleccionLibre.map(fmt));
  const totalEstimado = seleccionLibre.length * raffle.pricePerNumber;
  const plazoReserva = formatearPlazo(raffle.reservationMinutes ?? 1440);

  function tocar(n: number) {
    setAviso("");
    if (estadoDe(n) === "libre") {
      if (!puedeSeleccionar) return;
      setSeleccion((s) =>
        s.includes(n)
          ? s.filter((x) => x !== n)
          : [...s.filter((x) => estadoDe(x) === "libre"), n]
      );
      return;
    }
    setErrorAccion("");
    setPaso({ tipo: "ver", pedidoId: null });
    setAbierta(n);
  }

  function irACentena(k: number) {
    const destino = document.getElementById(idCentena(k));
    if (!destino) return;
    // Sin "behavior": el navegador usa el scroll-behavior de la página, que
    // ya se apaga solo con "reducir movimiento".
    destino.scrollIntoView({ block: "start" });
    destino.focus({ preventScroll: true });
  }

  const cerrarHoja = useCallback(() => {
    setAbierta(null);
    setPaso({ tipo: "ver", pedidoId: null });
    setErrorAccion("");
  }, []);
  const hojaRef = useModalA11y(abierta !== null, cerrarHoja);

  const cerrarApartar = useCallback(() => {
    setApartarAbierto(false);
    setErrorApartar("");
  }, []);
  const apartarRef = useModalA11y(apartarAbierto, cerrarApartar);

  const cerrarBloquear = useCallback(() => {
    setBloquearAbierto(false);
    setErrorBloqueo("");
  }, []);
  const bloquearRef = useModalA11y(bloquearAbierto, cerrarBloquear);

  /** Marcar pagado o liberar un pedido COMPLETO (todos sus números). */
  async function accionPedido(
    pedido: PedidoTablero,
    accion: "confirm" | "cancel",
    exito: string
  ) {
    setOcupado(true);
    setErrorAccion("");
    try {
      const res = await fetch(`/api/admin/orders/${pedido.id}/${accion}`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorAccion(
          data.error ||
            (accion === "confirm"
              ? "No fue posible marcar el pago"
              : "No fue posible liberar los números")
        );
        recargar();
        return;
      }
      cerrarHoja();
      setAviso(exito);
      recargar();
      onCambio?.();
    } catch {
      setErrorAccion("Error de conexión. Intenta de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  async function desbloquear(n: number) {
    setOcupado(true);
    setErrorAccion("");
    try {
      const res = await fetch("/api/admin/numbers/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raffleId: raffle.id, from: n, action: "unblock" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorAccion(data.error || "No fue posible desbloquear el número");
        return;
      }
      cerrarHoja();
      setAviso(`El ${fmt(n)} quedó libre otra vez.`);
      recargar();
      onCambio?.();
    } catch {
      setErrorAccion("Error de conexión. Intenta de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  /**
   * El endpoint de bloqueo trabaja por rangos: lo escogido se parte en tramos
   * seguidos (07-09, 23) y se manda uno por uno. Solo bloquea casillas
   * libres: si alguien reservó una entre tanto, el servidor la deja quieta.
   */
  async function bloquearSeleccion() {
    if (seleccionLibre.length === 0) return;
    setOcupado(true);
    setErrorBloqueo("");
    let bloqueados = 0;
    let omitidos = 0;
    try {
      for (const [desde, hasta] of tramos(seleccionLibre)) {
        const res = await fetch("/api/admin/numbers/block", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            raffleId: raffle.id,
            from: desde,
            ...(hasta !== desde ? { to: hasta } : {}),
            action: "block",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorBloqueo(data.error || "No fue posible bloquear los números");
          return;
        }
        bloqueados += data.blocked ?? 0;
        omitidos += data.skipped ?? 0;
      }
      setBloquearAbierto(false);
      setSeleccion([]);
      setAviso(
        omitidos > 0
          ? `${cantidad(bloqueados)} bloqueados. ${cantidad(omitidos)} ya estaban tomados y se dejaron como estaban.`
          : `${cantidad(bloqueados)} bloqueados: nadie los puede reservar.`
      );
    } catch {
      setErrorBloqueo("Error de conexión. Intenta de nuevo.");
    } finally {
      setOcupado(false);
      // Aunque falle a mitad, los tramos que alcanzaron a entrar ya están
      // bloqueados: el tablero tiene que mostrarlos.
      recargar();
      onCambio?.();
    }
  }

  async function apartar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (seleccionLibre.length === 0 || ocupado) return;
    const nombreLimpio = nombre.trim();
    if (nombreLimpio.length < 2) {
      setErrorApartar("Escribe el nombre de la persona.");
      return;
    }
    const numeros = [...seleccionLibre];
    const lista = listaSeleccion;
    setOcupado(true);
    setErrorApartar("");
    try {
      const res = await fetch("/api/admin/orders/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raffleId: raffle.id,
          numbers: numeros,
          name: nombreLimpio,
          ...(celular.trim() ? { phone: celular.trim() } : {}),
          markPaid: yaPago,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const conflicto: number[] = Array.isArray(data.conflicting)
        ? data.conflicting.filter((v: unknown): v is number => Number.isInteger(v))
        : [];
      if (res.status === 409 && conflicto.length > 0) {
        // Alguien los tomó un instante antes: se sacan de lo escogido y se
        // refresca, para que el dueño vea en qué color quedaron.
        setSeleccion((s) => s.filter((n) => !conflicto.includes(n)));
        setErrorApartar(
          `${
            conflicto.length === 1
              ? "Este número ya no está libre"
              : "Estos números ya no están libres"
          }: ${listaDeNumeros(conflicto.sort((a, b) => a - b).map(fmt))}. Los quitamos de lo escogido; revisa y vuelve a apartar.`
        );
        recargar();
        return;
      }
      if (!res.ok) {
        setErrorApartar(data.error || "No fue posible apartar los números.");
        return;
      }
      setApartarAbierto(false);
      setSeleccion([]);
      setNombre("");
      setCelular("");
      setYaPago(false);
      setAviso(
        data.confirmado
          ? `Listo: ${lista} a nombre de ${nombreLimpio}, pagados. Pedido ${data.code}.`
          : yaPago
            ? `Se apartaron ${lista} (pedido ${data.code}), pero no se pudo marcar el pago: quedaron en amarillo. Tócalos para marcarlos pagados.`
            : `Listo: ${lista} apartados a nombre de ${nombreLimpio}. Pedido ${data.code}.`
      );
      recargar();
      onCambio?.();
    } catch {
      setErrorApartar("Error de conexión. Intenta de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  /* ---------------- Hoja de detalle ---------------- */

  const estadoAbierta = abierta !== null ? estadoDe(abierta) : "libre";
  const pedidoAbierto = abierta !== null ? pedidoDe(abierta) : null;
  // Un paso de confirmación solo vale para el pedido y el estado con que se
  // abrió: si la casilla cambió (se pagó en línea, venció, la tomó otro), se
  // vuelve a "ver" y el dueño lee lo nuevo antes de decidir.
  const pasoValido =
    paso.tipo === "ver" ||
    (paso.pedidoId !== null &&
      paso.pedidoId === pedidoAbierto?.id &&
      ((paso.tipo === "pagar" || paso.tipo === "liberar")
        ? estadoAbierta === "reservado"
        : estadoAbierta === "pagado"));
  const pasoActual: Paso = pasoValido ? paso.tipo : "ver";

  // Si el refresco cambia lo que hay en la hoja (la reserva venció, el pago
  // entró por otro lado), el botón que tenía el foco desaparece y el foco cae
  // al fondo de la página, fuera del diálogo. Se devuelve al panel para que el
  // teclado y el lector de pantalla sigan dentro de la hoja.
  const idPedidoAbierto = pedidoAbierto?.id ?? null;
  useEffect(() => {
    if (abierta === null) return;
    const panel = hojaRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();
  }, [abierta, estadoAbierta, pasoActual, idPedidoAbierto, hojaRef]);

  function irAPaso(tipo: Paso) {
    setErrorAccion("");
    setPaso({ tipo, pedidoId: pedidoAbierto?.id ?? null });
  }

  function hojaDePedido(n: number, p: PedidoTablero) {
    const numerosTexto = listaDeNumeros(p.numbers);
    const varios = p.numbers.length > 1;
    const persona = p.participant;
    const telefono = persona.phone ? cifrasDe(persona.phone) : "";
    const reservado = estadoAbierta === "reservado";
    const enLinea = esPagoEnLinea(p.paymentMethod);
    return (
      <>
        {/* Quién es: nombre, cómo escribirle y lo que haya dejado. */}
        <div className="mt-4 rounded-xl border border-line bg-well p-3.5">
          <p className="break-words font-display text-lg font-extrabold leading-tight text-fg">
            {persona.name}
          </p>
          {telefono ? (
            <a
              href={`https://wa.me/${telefono}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2.5 inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-wa/45 bg-wa/12 px-3.5 text-sm font-bold text-wa-ink transition-colors hover:bg-wa/20"
            >
              <IconWhatsApp width={16} height={16} className="shrink-0" />
              <span className="truncate">
                Escribir por WhatsApp ·{" "}
                <span className="font-mono tabular-nums">{persona.phone}</span>
              </span>
            </a>
          ) : (
            <p className="mt-1.5 text-sm text-fg-faint">Sin celular</p>
          )}
          {persona.idNumber || persona.city ? (
            <dl className="mt-2.5 grid grid-cols-2 gap-2 text-sm">
              {persona.idNumber ? (
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-fg-faint">
                    Cédula
                  </dt>
                  <dd className="font-mono tabular-nums text-fg-soft">
                    {persona.idNumber}
                  </dd>
                </div>
              ) : null}
              {persona.city ? (
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-fg-faint">
                    Ciudad
                  </dt>
                  <dd className="text-fg-soft">{persona.city}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>

        {/* El pedido: código, tiempos y todos sus números. */}
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-fg-faint">
              Pedido
            </dt>
            <dd className="font-mono uppercase tracking-[0.08em] text-brand-violet">
              {p.code}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-fg-faint">
              {reservado ? "Reservó" : "Pidió"}
            </dt>
            <dd className="text-fg-soft">
              {haceCuanto(p.createdAt, ahora)}
              <span className="block text-xs text-fg-faint">
                {formatDate(p.createdAt)}
              </span>
            </dd>
          </div>
          {reservado && p.reservedUntil ? (
            <div className="col-span-2">
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-fg-faint">
                Vence
              </dt>
              <dd className="text-fg-soft">
                {formatDate(p.reservedUntil)} ({venceEn(p.reservedUntil, ahora)}).
                Si no paga, los números se liberan solos.
              </dd>
            </div>
          ) : null}
          {!reservado ? (
            <>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-fg-faint">
                  Pagado el
                </dt>
                <dd className="text-fg-soft">{formatDate(p.paidAt)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-fg-faint">
                  Método
                </dt>
                <dd className="text-fg-soft">{metodoDePago(p.paymentMethod)}</dd>
              </div>
            </>
          ) : null}
        </dl>

        <p className={`${labelCls} mt-4`}>
          {varios ? `Los ${p.numbers.length} números del pedido` : "Número del pedido"}
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {p.numbers.map((x) => (
            <li
              key={x}
              className={`inline-flex min-h-9 items-center rounded-lg border-2 px-2.5 font-display text-sm font-extrabold tabular-nums text-cell-ink ${CASILLA_CLS[estadoAbierta]} ${
                x === fmt(n) ? "ring-2 ring-brand ring-offset-2 ring-offset-card" : ""
              }`}
            >
              {x}
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-fg-faint">
            Total
          </span>
          <span className="font-display text-2xl font-black tabular-nums text-fg">
            {formatCop(p.total)}
          </span>
        </p>

        {errorAccion ? (
          <p role="alert" className={`mt-3 ${alertCls}`}>
            {errorAccion}
          </p>
        ) : null}

        {/* Acciones, según el paso. */}
        {pasoActual === "ver" ? (
          <div className="mt-4 flex flex-col gap-2">
            {reservado ? (
              <>
                {canConfirm ? (
                  <button
                    type="button"
                    onClick={() => irAPaso("pagar")}
                    disabled={ocupado}
                    autoFocus
                    className={btnOk}
                  >
                    <IconCheck width={16} height={16} />
                    Marcar pagado
                  </button>
                ) : null}
                {canCancel ? (
                  // Sin "Marcar pagado" encima, el foco cae aquí al volver de
                  // la confirmación; si no, se perdería en el fondo de la página.
                  <button
                    type="button"
                    onClick={() => irAPaso("liberar")}
                    disabled={ocupado}
                    autoFocus={!canConfirm}
                    className={btnDanger}
                  >
                    <IconX width={16} height={16} />
                    Liberar
                  </button>
                ) : null}
                {!canConfirm && !canCancel ? (
                  <p className={helpCls}>
                    Tu usuario puede ver la reserva, pero no marcar pagos ni
                    liberar números.
                  </p>
                ) : null}
              </>
            ) : enLinea ? (
              <p className="rounded-xl border border-line bg-well px-4 py-3 text-sm text-fg-soft">
                Pagado en línea: no se anula desde aquí.
              </p>
            ) : canCancel && esPagoManual(p.paymentMethod) ? (
              <button
                type="button"
                onClick={() => irAPaso("anular")}
                disabled={ocupado}
                autoFocus
                className={btnDanger}
              >
                <IconX width={16} height={16} />
                Anular venta
              </button>
            ) : canCancel ? (
              <p className={helpCls}>
                Este pago no se anula desde el tablero; revísalo en Pedidos.
              </p>
            ) : null}
          </div>
        ) : null}

        {pasoActual === "pagar" ? (
          <div className="mt-4 rounded-xl border border-wa/40 bg-wa/10 p-3.5">
            <p className="text-sm font-semibold leading-relaxed text-fg">
              ¿Ya te pagaron? Se marcan como pagados{" "}
              {varios ? `los ${p.numbers.length} números` : "el número"}{" "}
              <strong className="font-mono tabular-nums">{numerosTexto}</strong>{" "}
              por <strong className="tabular-nums">{formatCop(p.total)}</strong>.
              Quedan en verde.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => irAPaso("ver")}
                disabled={ocupado}
                className={btnOutline}
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() =>
                  accionPedido(
                    p,
                    "confirm",
                    `${varios ? "Pagados" : "Pagado"}: ${numerosTexto} de ${persona.name}.`
                  )
                }
                disabled={ocupado}
                autoFocus
                className={btnOk}
              >
                {ocupado ? "Marcando…" : "Sí, pagó"}
              </button>
            </div>
          </div>
        ) : null}

        {pasoActual === "liberar" ? (
          <div className="mt-4 rounded-xl border-2 border-error/60 bg-error/10 p-3.5 text-error">
            <p className="text-sm font-semibold leading-relaxed">
              {varios
                ? `Se liberan TODOS los números de este pedido, no solo el ${fmt(n)}: `
                : "Se libera el número "}
              <strong className="font-mono tabular-nums">{numerosTexto}</strong>.
              Vuelven a quedar en blanco y cualquiera los puede reservar.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => irAPaso("ver")}
                disabled={ocupado}
                autoFocus
                className={btnOutline}
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() =>
                  accionPedido(
                    p,
                    "cancel",
                    `${varios ? "Liberados" : "Liberado"}: ${numerosTexto}.`
                  )
                }
                disabled={ocupado}
                className={btnDanger}
              >
                {ocupado ? "Liberando…" : varios ? `Liberar los ${p.numbers.length}` : "Liberar"}
              </button>
            </div>
          </div>
        ) : null}

        {pasoActual === "anular" ? (
          <div className="mt-4 rounded-xl border-2 border-error/60 bg-error/10 p-3.5 text-error">
            <p className="text-sm font-semibold leading-relaxed">
              Anular la venta deja libres TODOS sus números:{" "}
              <strong className="font-mono tabular-nums">{numerosTexto}</strong>{" "}
              ({formatCop(p.total)}). La plata no se devuelve sola: eso lo
              arreglas tú con {persona.name}.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => irAPaso("ver")}
                disabled={ocupado}
                autoFocus
                className={btnOutline}
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => irAPaso("anular2")}
                disabled={ocupado}
                className={btnDanger}
              >
                Continuar
              </button>
            </div>
          </div>
        ) : null}

        {pasoActual === "anular2" ? (
          <div className="mt-4 rounded-xl border-2 border-error/60 bg-error/10 p-3.5 text-error">
            <p className="text-sm font-bold leading-relaxed">
              Última confirmación: ¿anular la venta de {persona.name}? No se
              puede deshacer.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => irAPaso("ver")}
                disabled={ocupado}
                autoFocus
                className={btnOutline}
              >
                No, dejarla
              </button>
              <button
                type="button"
                onClick={() =>
                  accionPedido(
                    p,
                    "cancel",
                    `Venta anulada: ${numerosTexto} quedaron libres.`
                  )
                }
                disabled={ocupado}
                className={btnDanger}
              >
                {ocupado ? "Anulando…" : "Sí, anular"}
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  /* ---------------- Pintado ---------------- */

  if (cargando && !datos) {
    return (
      <div className="flex flex-col gap-3" aria-hidden="true">
        <div className="h-20 animate-pulse rounded-2xl border border-line bg-card motion-reduce:animate-none" />
        <div className="h-64 animate-pulse rounded-2xl border border-line bg-card motion-reduce:animate-none" />
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className={alertCls}>
          {errorCarga || "No fue posible cargar el tablero"}
        </p>
        <button type="button" onClick={recargar} className={btnOutline}>
          Reintentar
        </button>
      </div>
    );
  }

  const filtrosVisibles = FILTROS.filter(
    (f) => f.value !== "bloqueado" || conteo.bloqueado > 0 || filtro === "bloqueado"
  );
  const hayBarra = seleccion.length > 0 && puedeSeleccionar;

  return (
    <div className="flex flex-col gap-3">
      {errorCarga ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className={`${alertCls} flex-1`}>
            {errorCarga}
          </p>
          <button type="button" onClick={recargar} className={btnOutline}>
            Reintentar
          </button>
        </div>
      ) : null}

      {/* Plata del tablero: lo cobrado (verde) y lo apartado sin pagar. */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-line bg-well px-3 py-2.5">
          <p className="font-display text-lg font-extrabold tabular-nums text-wa-ink sm:text-xl">
            {formatCop(cobrado)}
          </p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-fg-faint">
            Cobrado
          </p>
        </div>
        <div className="rounded-xl border border-line bg-well px-3 py-2.5">
          <p className="font-display text-lg font-extrabold tabular-nums text-warn sm:text-xl">
            {formatCop(porCobrar)}
          </p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-fg-faint">
            Por cobrar
          </p>
        </div>
      </div>

      {/* Conteos que a la vez son los filtros y la leyenda de colores. */}
      <div
        role="group"
        aria-label="Filtrar el tablero"
        className={`grid grid-cols-2 gap-2 ${
          filtrosVisibles.length === 5 ? "sm:grid-cols-5" : "sm:grid-cols-4"
        }`}
      >
        {filtrosVisibles.map((f) => {
          const activo = filtro === f.value;
          const numero = f.value === "todos" ? total : conteo[f.value];
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFiltro(f.value)}
              aria-pressed={activo}
              className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                activo
                  ? "glow-brand-sm border-brand bg-brand/12"
                  : "border-line bg-well hover:border-brand/60"
              }`}
            >
              {f.value === "todos" ? null : (
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-cell-ink ${CASILLA_CLS[f.value]}`}
                >
                  <MarcaEstado estado={f.value} className="h-3.5 w-3.5" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-display text-base font-extrabold leading-tight tabular-nums text-fg">
                  {numero.toLocaleString("es-CO")}
                </span>
                <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-fg-soft">
                  {f.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div>
        <label htmlFor={`${uid}-buscar`} className="sr-only">
          Buscar en el tablero
        </label>
        <input
          id={`${uid}-buscar`}
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Número, nombre, celular o código"
          autoComplete="off"
          className={inputCls}
        />
      </div>

      {porCentenas ? (
        <nav aria-label="Ir a una centena" className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
          {centenas.map((k) => {
            const hay = (visiblesPorCentena.get(k)?.length ?? 0) > 0;
            return (
              <button
                key={k}
                type="button"
                onClick={() => irACentena(k)}
                disabled={!hay}
                aria-label={`Ir del ${fmt(k * 100)} al ${fmt(Math.min(total, k * 100 + 100) - 1)}`}
                className="min-h-11 rounded-xl border border-line bg-well font-mono text-xs font-bold tabular-nums text-fg-soft transition-colors hover:border-brand hover:text-fg disabled:opacity-40"
              >
                {fmt(k * 100)}
              </button>
            );
          })}
        </nav>
      ) : null}

      <p aria-live="polite" className="text-xs text-fg-faint">
        {filtrando
          ? visibles === 0
            ? "Ningún número coincide con este filtro."
            : `Mostrando ${cantidad(visibles)} de ${total.toLocaleString("es-CO")}.`
          : puedeApartar
            ? "Toca un número amarillo, verde o gris para ver de quién es. Toca los blancos para apartarlos a nombre de alguien."
            : "Toca un número amarillo, verde o gris para ver de quién es."}
      </p>

      {!enVenta ? (
        <p className="rounded-xl border border-line bg-well px-4 py-3 text-sm text-fg-soft">
          Esta rifa ya no está en venta: no se pueden apartar números nuevos.
        </p>
      ) : null}

      {/* El tablero: todos los números en orden, con sus ceros. */}
      <div className="flex flex-col gap-5">
        {centenas.map((k) => {
          const nums = visiblesPorCentena.get(k) ?? [];
          if (nums.length === 0) return null;
          return (
            <section
              key={k}
              aria-labelledby={porCentenas ? idCentena(k) : undefined}
              aria-label={porCentenas ? undefined : "Tablero de números"}
            >
              {porCentenas ? (
                <h3
                  id={idCentena(k)}
                  tabIndex={-1}
                  className="mb-2 scroll-mt-20 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-brand-violet outline-none"
                >
                  {fmt(k * 100)} – {fmt(Math.min(total, k * 100 + 100) - 1)}
                </h3>
              ) : null}
              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
                {nums.map((n) => {
                  const estado = estadoDe(n);
                  const pedido = estado === "libre" ? null : pedidoDe(n);
                  const elegida = estado === "libre" && seleccion.includes(n);
                  const libreSinAccion = estado === "libre" && !puedeSeleccionar;
                  const quien = pedido ? `, ${pedido.participant.name}` : "";
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => tocar(n)}
                      disabled={libreSinAccion}
                      aria-pressed={
                        estado === "libre" && puedeSeleccionar ? elegida : undefined
                      }
                      aria-label={`${fmt(n)}: ${TITULO_ESTADO[estado].toLowerCase()}${quien}${
                        elegida ? ", escogido" : ""
                      }`}
                      title={pedido ? pedido.participant.name : undefined}
                      className={`relative flex min-h-11 items-center justify-center rounded-lg border-2 font-display text-sm font-extrabold tabular-nums text-cell-ink transition-shadow disabled:cursor-default ${
                        CASILLA_CLS[estado]
                      } ${elegida ? "ring-[3px] ring-brand ring-offset-2 ring-offset-card" : ""}`}
                    >
                      {fmt(n)}
                      <MarcaEstado
                        estado={estado}
                        className="absolute right-0.5 top-0.5 h-2.5 w-2.5"
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-fg-faint">
          Se actualiza solo cada 20 segundos.
        </p>
        <button type="button" onClick={recargar} className={btnOutline}>
          Actualizar ahora
        </button>
      </div>

      {/* Hueco para que la barra flotante no tape la última fila. */}
      {hayBarra ? <div aria-hidden="true" className="h-32" /> : null}

      {/* Barra de lo escogido: aparece con la primera casilla blanca. */}
      {hayBarra ? (
        <div style={flotanteStyle} className="fixed inset-x-0 z-[45] px-4 lg:pl-64">
          <div className="glow-brand-sm mx-auto w-full max-w-3xl rounded-2xl border border-brand/50 bg-card px-4 py-3 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-fg-faint">
                  {seleccionLibre.length === 1
                    ? "1 número escogido"
                    : `${cantidad(seleccionLibre.length)} escogidos`}
                  {seleccionLibre.length > 0 && puedeApartar
                    ? ` · ${formatCop(totalEstimado)}`
                    : ""}
                </p>
                <p className="mt-0.5 truncate font-mono text-sm font-bold tabular-nums text-fg">
                  {listaSeleccion || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSeleccion([])}
                aria-label="Quitar todo lo escogido"
                className={btnIcono}
              >
                <IconX width={18} height={18} />
              </button>
            </div>
            {seleccionPerdida.length > 0 ? (
              <p role="status" className="mt-2 text-xs font-semibold leading-relaxed text-warn">
                {seleccionPerdida.length === 1
                  ? `El ${fmt(seleccionPerdida[0])} lo tomó alguien más mientras escogías: no se incluye.`
                  : `${listaDeNumeros(seleccionPerdida.map(fmt))} los tomó alguien más mientras escogías: no se incluyen.`}
              </p>
            ) : null}
            <div className="mt-2.5 flex flex-wrap gap-2">
              {canBlock ? (
                <button
                  type="button"
                  onClick={() => {
                    setErrorBloqueo("");
                    setBloquearAbierto(true);
                  }}
                  disabled={seleccionLibre.length === 0}
                  className={btnOutline}
                >
                  <IconCandado width={15} height={15} />
                  Bloquear
                </button>
              ) : null}
              {puedeApartar ? (
                <button
                  type="button"
                  onClick={() => {
                    setErrorApartar("");
                    setApartarAbierto(true);
                  }}
                  disabled={seleccionLibre.length === 0}
                  className={`${btnPrimary} flex-1 px-4`}
                >
                  Apartar {cantidad(seleccionLibre.length)}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Aviso de "listo". La región existe siempre para que el lector de
          pantalla anuncie el texto en cuanto aparece. */}
      <div
        role="status"
        aria-live="polite"
        style={flotanteStyle}
        className="pointer-events-none fixed inset-x-0 z-[45] px-4 lg:pl-64"
      >
        {aviso && !hayBarra ? (
          <div className="pointer-events-auto mx-auto flex w-full max-w-3xl items-start gap-3 rounded-2xl border border-wa/45 bg-card px-4 py-3 shadow-card">
            <IconCheck width={18} height={18} className="mt-0.5 shrink-0 text-wa-ink" />
            <p className="min-w-0 flex-1 text-sm font-semibold leading-relaxed text-fg">
              {aviso}
            </p>
            <button
              type="button"
              onClick={() => setAviso("")}
              aria-label="Cerrar el aviso"
              className="-my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-fg-soft hover:text-fg"
            >
              <IconX width={16} height={16} />
            </button>
          </div>
        ) : null}
      </div>

      {/* Hoja de detalle de una casilla tomada. */}
      {abierta !== null ? (
        <div
          className={overlayCls}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${uid}-hoja`}
          onClick={cerrarHoja}
        >
          <div
            ref={hojaRef}
            tabIndex={-1}
            className={modalPanelCls}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`relative flex h-14 min-w-14 shrink-0 items-center justify-center rounded-xl border-2 px-2 font-display text-xl font-black tabular-nums text-cell-ink ${CASILLA_CLS[estadoAbierta]}`}
                >
                  {fmt(abierta)}
                  <MarcaEstado
                    estado={estadoAbierta}
                    className="absolute right-1 top-1 h-3 w-3"
                  />
                </span>
                <div className="min-w-0">
                  <h2
                    id={`${uid}-hoja`}
                    className="font-display text-lg font-extrabold uppercase leading-tight text-fg"
                  >
                    Número {fmt(abierta)}
                  </h2>
                  <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.1em] text-fg-soft">
                    {TITULO_ESTADO[estadoAbierta]}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={cerrarHoja}
                aria-label="Cerrar"
                className={btnIcono}
              >
                <IconX width={18} height={18} />
              </button>
            </div>

            {estadoAbierta === "libre" ? (
              <p className="mt-4 rounded-xl border border-line bg-well px-4 py-3 text-sm text-fg-soft">
                Este número ya está libre: la reserva se venció o la liberaron.
              </p>
            ) : estadoAbierta === "bloqueado" ? (
              <>
                <p className="mt-4 text-sm leading-relaxed text-fg-soft">
                  Nadie lo puede reservar mientras siga bloqueado.
                </p>
                {errorAccion ? (
                  <p role="alert" className={`mt-3 ${alertCls}`}>
                    {errorAccion}
                  </p>
                ) : null}
                {canBlock ? (
                  <button
                    type="button"
                    onClick={() => desbloquear(abierta)}
                    disabled={ocupado}
                    className={`${btnPrimary} mt-4 w-full`}
                  >
                    {ocupado ? "Desbloqueando…" : "Desbloquear"}
                  </button>
                ) : (
                  <p className={helpCls}>Tu usuario no puede desbloquear números.</p>
                )}
              </>
            ) : pedidoAbierto ? (
              hojaDePedido(abierta, pedidoAbierto)
            ) : (
              <p className="mt-4 rounded-xl border border-line bg-well px-4 py-3 text-sm text-fg-soft">
                No encontramos el pedido de este número. Actualiza el tablero o
                búscalo en Números tomados, abajo.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {/* Apartar a mano lo escogido. */}
      {apartarAbierto ? (
        <div
          className={overlayCls}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${uid}-apartar`}
          onClick={cerrarApartar}
        >
          <div
            ref={apartarRef}
            tabIndex={-1}
            className={modalPanelCls}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2
                id={`${uid}-apartar`}
                className="font-display text-xl font-extrabold uppercase leading-tight text-fg"
              >
                Apartar {cantidad(seleccionLibre.length)}
              </h2>
              <button
                type="button"
                onClick={cerrarApartar}
                aria-label="Cerrar"
                className={btnIcono}
              >
                <IconX width={18} height={18} />
              </button>
            </div>

            <ul className="mt-3 flex flex-wrap gap-1.5">
              {seleccionLibre.map((n) => (
                <li
                  key={n}
                  className="inline-flex min-h-9 items-center rounded-lg border-2 border-cell-line bg-cell-free px-2.5 font-display text-sm font-extrabold tabular-nums text-cell-ink"
                >
                  {fmt(n)}
                </li>
              ))}
            </ul>

            <form onSubmit={apartar} className="mt-4 flex flex-col gap-4" noValidate>
              <div>
                <label htmlFor={`${uid}-nombre`} className={labelCls}>
                  Nombre *
                </label>
                <input
                  id={`${uid}-nombre`}
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  maxLength={120}
                  autoComplete="off"
                  placeholder="Ej: Ana Pérez"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor={`${uid}-celular`} className={labelCls}>
                  Celular (opcional)
                </label>
                <input
                  id={`${uid}-celular`}
                  type="tel"
                  inputMode="tel"
                  value={celular}
                  onChange={(e) => setCelular(e.target.value)}
                  maxLength={20}
                  autoComplete="off"
                  placeholder="Ej: 300 123 4567"
                  aria-describedby={`${uid}-celular-ayuda`}
                  className={`${inputCls} font-mono tabular-nums`}
                />
                <p id={`${uid}-celular-ayuda`} className={helpCls}>
                  Con el celular le puedes escribir desde el tablero.
                </p>
              </div>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-line bg-well px-4 py-3">
                <input
                  type="checkbox"
                  checked={yaPago}
                  onChange={(e) => setYaPago(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-cell-paid"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-fg">
                    Ya pagó: marcar en verde
                  </span>
                  <span className={helpCls}>
                    {yaPago
                      ? "Los números quedan pagados de una vez."
                      : `Si no, quedan en amarillo (reservados) por ${plazoReserva} y después se liberan solos.`}
                  </span>
                </span>
              </label>
              <div className="flex items-baseline justify-between gap-3 rounded-xl border border-line bg-bg2 px-4 py-3">
                <span>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-fg-faint">
                    Total estimado
                  </span>
                  <span className="block text-xs tabular-nums text-fg-faint">
                    {cantidad(seleccionLibre.length)} ×{" "}
                    {formatCop(raffle.pricePerNumber)}
                  </span>
                </span>
                <span className="font-display text-2xl font-black tabular-nums text-brand-light">
                  {formatCop(totalEstimado)}
                </span>
              </div>
              {errorApartar ? (
                <p role="alert" className={alertCls}>
                  {errorApartar}
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={cerrarApartar}
                  className={`${btnOutline} min-h-12`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={ocupado || seleccionLibre.length === 0}
                  className={`${btnPrimary} px-3`}
                >
                  {ocupado ? "Apartando…" : yaPago ? "Apartar pagados" : "Apartar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Bloquear lo escogido. */}
      {bloquearAbierto ? (
        <div
          className={overlayCls}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${uid}-bloquear`}
          onClick={cerrarBloquear}
        >
          <div
            ref={bloquearRef}
            tabIndex={-1}
            className={modalPanelCls}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id={`${uid}-bloquear`}
              className="font-display text-xl font-extrabold uppercase leading-tight text-fg"
            >
              Bloquear {cantidad(seleccionLibre.length)}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-fg-soft">
              <strong className="font-mono tabular-nums text-fg">{listaSeleccion}</strong>{" "}
              quedan en gris y nadie los podrá reservar hasta que los
              desbloquees.
            </p>
            {errorBloqueo ? (
              <p role="alert" className={`mt-3 ${alertCls}`}>
                {errorBloqueo}
              </p>
            ) : null}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={cerrarBloquear}
                autoFocus
                className={`${btnOutline} min-h-12`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={bloquearSeleccion}
                disabled={ocupado || seleccionLibre.length === 0}
                className={`${btnPrimary} px-3`}
              >
                {ocupado ? "Bloqueando…" : "Bloquear"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
