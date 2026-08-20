"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { slugify } from "@/lib/slug";
import { formatCop } from "@/lib/format";
import { RAFFLE_STATUSES_V2, STATUS_META_V2, type RaffleStatusV2 } from "@/lib/raffle-status";
import { digitsForTotal } from "@/lib/numbers";
import { btnOutline, btnPrimary, helpCls, inputCls, labelCls } from "./ui";
import { IconImage, IconPlus, IconTrash, IconX } from "@/components/icons";

export type RafflePrizeInitial = {
  label: string;
  title: string;
  amount: string;
  note: string;
};

export type RafflePrizedNumberInitial = { number: number; prize: string };

/**
 * Un paquete tal como sale de la base, ya normalizado: cantidad, etiqueta de
 * color (vacía si no tiene) y descuento en porcentaje (0 si no tiene). Es la
 * misma forma que devuelve `parseTicketPacks` de src/lib/public.ts, que es
 * quien lee el JSON guardado; aquí se repite el tipo porque este componente
 * corre en el navegador y ese módulo habla con Prisma.
 */
export type RaffleTicketPackInitial = {
  qty: number;
  label: string;
  discountPct: number;
};

export type RaffleFormInitial = {
  id: string;
  slug: string;
  title: string;
  description: string;
  prize: string;
  imageUrl: string | null;
  imageAspect: string;
  gallery: string[];
  pricePerNumber: number;
  totalNumbers: number;
  digits: number;
  selectionMode: string;
  whatsappCheckout: boolean;
  gatewayCheckout: boolean;
  showPrize: boolean;
  showDrawDate: boolean;
  ticketPacks: RaffleTicketPackInitial[];
  prizes: RafflePrizeInitial[];
  prizedNumbers: RafflePrizedNumberInitial[];
  drawDateText: string | null;
  status: string;
  progressMode: string;
  manualProgressPct: number;
  reservationMinutes: number;
  minNumbersPerOrder: number;
  maxNumbersPerOrder: number;
  terms: string;
  displayOrder: number;
  hasOrders: boolean;
};

/* Lenguaje visual del panel: tarjeta violeta oscura de esquina 2xl. */
const cardCls = "rounded-2xl border border-line bg-card p-4 shadow-card";
/* Aviso de error: rosa sobre violeta, igual en todos los módulos. */
const alertCls =
  "rounded-xl border border-error/35 bg-error/10 px-4 py-3 text-sm font-medium text-error";
/* Aviso ámbar: no impide guardar, solo advierte de algo que quedaría raro. */
const warnCls =
  "rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-xs font-semibold leading-relaxed text-warn";
/* Aviso rojo grande: se reserva para lo que NO se puede publicar así, no para
   lo que queda feo. Borde de 2px y más aire que el resto para que se vea a
   medio metro del celular. */
const dangerCls =
  "rounded-xl border-2 border-error/60 bg-error/10 px-4 py-3.5 text-error";
/* Botón dentro de un aviso rojo: la salida a un toque del problema. */
const dangerBtnCls =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-error/50 bg-error/15 px-4 text-[11px] font-bold uppercase tracking-[0.1em] text-error transition-colors hover:bg-error/25";
/* Etiqueta menuda de campo secundario dentro de una fila repetida. */
const subLabelCls =
  "mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-fg-faint";
/* Botón de opción (cifras, cantidades, modos): apagado oscuro, encendido fucsia. */
const chipBtnIdle =
  "border border-line bg-well text-fg-soft transition-colors hover:border-brand hover:text-fg disabled:opacity-40";
const chipBtnActive = "glow-brand-sm border border-brand bg-brand text-white";

/* Epígrafe de bloque: mayúsculas violetas con una línea que llena el ancho,
   igual que los formularios de la referencia. */
function SectionTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-violet">
        {children}
      </h2>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
      {aside ? (
        <span className="shrink-0 text-[11px] font-bold tabular-nums text-fg-faint">
          {aside}
        </span>
      ) : null}
    </div>
  );
}

/* Interruptor de una línea: etiqueta + ayuda a la izquierda y palanca fucsia a
   la derecha. Todos los del formulario se ven exactamente igual porque salen
   de aquí. El área que responde al dedo es de 44px de alto.

   `disabled` es para el interruptor que hoy no puede hacer nada (la pasarela
   sin configurar): se ve apagado, no responde al dedo y se atenúa entero,
   pero el texto de ayuda sigue legible porque justo ahí está la explicación
   de por qué no se puede encender. */
function SwitchRow({
  label,
  help,
  checked,
  ariaLabel,
  onToggle,
  disabled = false,
}: {
  label: string;
  help: string;
  checked: boolean;
  ariaLabel: string;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex min-h-11 select-none items-center justify-between gap-3 rounded-xl border border-line bg-well px-4 py-3 ${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <span className="min-w-0">
        <span
          className={`block text-sm font-semibold ${
            disabled ? "text-fg-soft" : "text-fg"
          }`}
        >
          {label}
        </span>
        <span className={helpCls}>{help}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={onToggle}
        className={`flex h-11 w-12 shrink-0 items-center justify-center ${
          disabled ? "cursor-not-allowed opacity-45" : ""
        }`}
      >
        <span
          className={`relative block h-7 w-12 rounded-full transition-colors ${
            checked ? "bg-brand" : "bg-line"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
              checked ? "left-6" : "left-1"
            }`}
          />
        </span>
      </button>
    </label>
  );
}

const TOTAL_PRESETS = [100, 1000, 10000, 100000, 1000000];
const DIGIT_PRESETS = [2, 3, 4, 5, 6, 7];
const MIN_DIGITS = 2;
const MAX_DIGITS = 7;
const DEFAULT_PACK_QTYS = [1, 2, 5, 10];
const MAX_PACKS = 12;
/* Un paquete no puede traer más números que estos (mismo tope del servidor). */
const MAX_PACK_QTY = 5000;
/* Tope del servidor para la etiqueta. Es una pastilla encima de la tarjeta:
   pasando de LABEL_COMODA se le avisa que en el móvil se verá cortada. */
const MAX_PACK_LABEL = 24;
const LABEL_COMODA = 16;
const MIN_PACK_OFF = 1;
const MAX_PACK_OFF = 90;
/* Las cuatro etiquetas de siempre, a un toque para no tener que escribirlas. */
const PACK_LABEL_SUGERENCIAS = [
  "Más vendido",
  "Recomendado",
  "VIP",
  "Mejor precio",
];

/**
 * Proporciones de la foto del sorteo. Los flyers del dueño son verticales
 * (933×1400 y parecidos): metidos en un marco horizontal se les corta arriba y
 * abajo, y ahí es donde van los premios anticipados, el precio de la ficha y la
 * fecha. Por eso puede elegir el marco, y debajo ve el recorte de verdad.
 * Los tres valores son los mismos de IMAGE_ASPECTS en src/lib/public.ts (se
 * repiten aquí, con su nombre y su silueta, porque ese módulo habla con Prisma
 * y este componente corre en el navegador).
 * `frame` y `box` van escritos enteros porque Tailwind lee las clases del
 * código: armadas con plantillas no se generarían.
 */
const IMAGE_ASPECT_OPCIONES = [
  {
    value: "4/3",
    name: "Horizontal (4:3)",
    help: "El marco de siempre. Ideal para fotos apaisadas.",
    frame: "aspect-[4/3]",
    box: "w-full",
    shape: "h-8 w-11",
    ratio: 4 / 3,
  },
  {
    value: "1/1",
    name: "Cuadrada (1:1)",
    help: "Como una publicación de Instagram.",
    frame: "aspect-square",
    box: "mx-auto w-full max-w-72",
    shape: "h-10 w-10",
    ratio: 1,
  },
  {
    value: "9/16",
    name: "Vertical (9:16)",
    help: "El flyer completo: no se corta arriba ni abajo.",
    frame: "aspect-[9/16]",
    box: "mx-auto w-full max-w-60",
    shape: "h-11 w-[25px]",
    ratio: 9 / 16,
  },
] as const;

type ImageAspectValue = (typeof IMAGE_ASPECT_OPCIONES)[number]["value"];

const DEFAULT_ASPECT: ImageAspectValue = "4/3";
const MAX_PRIZES = 12;
/* Tope del servidor: 200 números premiados sumando todos los apartados. */
const MAX_PRIZED_NUMBERS = 200;
const MAX_PRIZED_GROUPS = 10;
/* Minutos de reserva que acepta el servidor. Si se sale de aquí, el mensaje
   que devuelve zod viene en inglés y de técnico: se avisa antes, en cristiano. */
const MIN_RESERVA = 3;
const MAX_RESERVA = 1440;

/** "1 número" / "25 números": los avisos no pueden decir "1 números". */
function cantidadNumeros(n: number): string {
  return n === 1 ? "1 número" : `${n.toLocaleString("es-CO")} números`;
}

/**
 * Cuánto se pierde de la foto dentro de un marco. 0 = entra entera; 0,47 = se
 * corta el 47%. Sale de comparar las dos proporciones: la foto se agranda
 * hasta tapar el marco (object-cover), así que lo que sobra se queda fuera.
 */
function recorteEn(ratioFoto: number, ratioMarco: number): number {
  if (ratioFoto <= 0 || ratioMarco <= 0) return 0;
  return 1 - Math.min(ratioFoto, ratioMarco) / Math.max(ratioFoto, ratioMarco);
}

/**
 * Una fila de paquete mientras se edita: la cantidad y el descuento viven como
 * texto para que el campo pueda quedarse vacío mientras el dueño escribe.
 */
type PackRow = { id: string; qty: string; label: string; off: string };

/** Un paquete ya revisado: precios calculados y el aviso que le corresponda. */
type PackParsed = {
  row: PackRow;
  qty: number;
  off: number;
  /** Lo que costaría sin descuento. */
  base: number;
  /** Lo que pagaría el comprador. */
  total: number;
  ahorro: number;
  /** Impide guardar. */
  error: string;
  /** No impide guardar: solo avisa de que el comprador no lo verá. */
  aviso: string;
};

/**
 * Revisa todos los paquetes de una: cantidades escritas y sin repetir,
 * descuentos dentro de rango y etiquetas que quepan. De aquí salen también los
 * precios de la vista previa, calculados igual que los calcula el servidor: el
 * descuento se aplica sobre el total del paquete.
 */
function reviewPacks(
  rows: PackRow[],
  price: number,
  minPorPedido: number,
  maxPorPedido: number
): PackParsed[] {
  /* Dónde salió cada cantidad, para cazar los paquetes repetidos. */
  const cantidadVista = new Map<number, number>();
  return rows.map((row, i) => {
    const qty = parseInt(row.qty || "0", 10) || 0;
    const off = parseInt(row.off || "0", 10) || 0;
    const label = row.label.trim();
    let error = "";
    let aviso = "";
    if (qty < 1) {
      error = `Escribe cuántos números trae el paquete ${i + 1}.`;
    } else if (qty > MAX_PACK_QTY) {
      error = `El paquete ${i + 1} no puede pasar de ${MAX_PACK_QTY.toLocaleString("es-CO")} números.`;
    } else {
      const antes = cantidadVista.get(qty);
      if (antes !== undefined) {
        error = `El paquete ${i + 1} tiene la misma cantidad que el paquete ${antes + 1} (${cantidadNumeros(qty)}). Cámbiala o quita uno de los dos.`;
      } else {
        cantidadVista.set(qty, i);
      }
    }
    if (
      !error &&
      row.off !== "" &&
      (off < MIN_PACK_OFF || off > MAX_PACK_OFF)
    ) {
      error = `El descuento del paquete ${i + 1} va del ${MIN_PACK_OFF}% al ${MAX_PACK_OFF}%. Déjalo vacío si ese paquete no lleva descuento.`;
    }
    if (!error && label.length > MAX_PACK_LABEL) {
      error = `La etiqueta del paquete ${i + 1} es muy larga: máximo ${MAX_PACK_LABEL} caracteres y llevas ${label.length}.`;
    }
    /* Los avisos solo se miran cuando la fila está bien escrita: si no, el
       dueño leería dos cosas a la vez sobre el mismo paquete. */
    if (!error && qty > 0) {
      if (maxPorPedido > 0 && qty > maxPorPedido) {
        aviso = `Al comprador no le aparecerá: pasa del máximo de ${cantidadNumeros(maxPorPedido)} por pedido. Sube ese máximo o baja la cantidad.`;
      } else if (minPorPedido > 0 && qty < minPorPedido) {
        aviso = `Al comprador no le aparecerá: queda por debajo de la compra mínima de ${cantidadNumeros(minPorPedido)}. Baja esa compra mínima o sube la cantidad.`;
      } else if (label.length > LABEL_COMODA) {
        aviso = `La etiqueta es larga (${label.length} caracteres): en el celular la pastilla se verá cortada. Con ${LABEL_COMODA} o menos entra completa.`;
      }
    }
    const aplicaOff = off >= MIN_PACK_OFF && off <= MAX_PACK_OFF ? off : 0;
    const base = qty * price;
    const total = aplicaOff > 0 ? Math.round((base * (100 - aplicaOff)) / 100) : base;
    return { row, qty, off: aplicaOff, base, total, ahorro: base - total, error, aviso };
  });
}

/** Arma las filas de paquetes de partida (los guardados o los de siempre). */
function initialPackRows(packs: RaffleTicketPackInitial[] | undefined): PackRow[] {
  const base: RaffleTicketPackInitial[] = packs?.length
    ? packs
    : DEFAULT_PACK_QTYS.map((q) => ({ qty: q, label: "", discountPct: 0 }));
  /* El id sale del índice (no de un contador de módulo) para que el servidor y
     el navegador pinten exactamente lo mismo. */
  return base.map((p, i) => ({
    id: `paquete-${i}`,
    qty: String(p.qty),
    label: p.label ?? "",
    off: p.discountPct > 0 ? String(p.discountPct) : "",
  }));
}

/**
 * Estados en los que la página del sorteo ya es pública (misma lista que
 * PUBLIC_STATUSES de src/lib/public.ts y que la del listado; se repite aquí
 * porque ese módulo habla con Prisma y no puede entrar en un componente de
 * cliente). En los demás, ese botón abre una VISTA PREVIA que solo ve quien
 * tiene sesión de panel.
 */
const ESTADOS_PUBLICOS = new Set([
  "COMING_SOON",
  "ACTIVE",
  "SOLD_OUT",
  "FINISHED",
]);

/**
 * Estados en los que la rifa está de cara al público y puede terminar con un
 * comprador delante de la pantalla «Realiza el pago»: ACTIVA vende de verdad y
 * PRÓXIMAMENTE está a un solo toque de hacerlo. Agotada, finalizada, cancelada
 * y borrador no toman pedidos nuevos, así que ahí no se frena nada.
 */
const ESTADOS_QUE_COBRAN = new Set(["COMING_SOON", "ACTIVE"]);

const SELECTION_MODES = [
  { value: "MANUAL", label: "Solo manual" },
  { value: "RANDOM", label: "Solo al azar" },
  { value: "BOTH", label: "Las dos" },
] as const;

type SelectionModeValue = (typeof SELECTION_MODES)[number]["value"];

type PrizeRow = {
  id: string;
  label: string;
  title: string;
  amount: string;
  note: string;
};

/**
 * Un apartado de números premiados: el premio se escribe UNA vez y debajo van
 * todos sus números juntos, tal como los dicta el dueño ("10 stickers de un
 * millón"). `numbers` es el texto crudo del campo; se revisa en cada render.
 */
type PrizedGroupRow = { id: string; prize: string; numbers: string };

/** Un apartado ya revisado: sus números limpios y el primer error, si lo hay. */
type PrizedGroupParsed = {
  row: PrizedGroupRow;
  numbers: string[];
  error: string;
};

/**
 * Trocea el texto de un apartado. Acepta comas, espacios, saltos de línea y
 * punto y coma; los puntos de mil (1.845) se quitan para no partir el número.
 */
function splitNumberTokens(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((t) => t.replace(/\./g, ""))
    .filter((t) => t !== "");
}

/**
 * Revisa todos los apartados de una: números válidos, dentro de las cifras de
 * la rifa, sin repetidos (ni dentro del apartado ni entre apartados) y sin dos
 * apartados con el mismo premio (se verían juntos en una sola tarjeta).
 * Devuelve los números ya ordenados y con ceros a la izquierda, como los ve el
 * comprador, más el error explicado en cristiano.
 */
function reviewPrizedGroups(
  rows: PrizedGroupRow[],
  digits: number
): PrizedGroupParsed[] {
  const capacity = Math.pow(10, digits);
  /* Dónde salió cada número y cada premio, para cazar los repetidos. */
  const numeroVisto = new Map<number, number>();
  const premioVisto = new Map<string, number>();
  return rows.map((row, i) => {
    const prize = row.prize.trim();
    const numbers: string[] = [];
    let error = "";
    for (const token of splitNumberTokens(row.numbers)) {
      if (!/^\d+$/.test(token)) {
        if (!error) error = `Aquí solo van números: revisa «${token}».`;
        continue;
      }
      const value = parseInt(token, 10);
      if (value >= capacity) {
        if (!error)
          error = `El número ${token} no existe en esta rifa: con ${digits} cifras van del ${"0".repeat(digits)} al ${"9".repeat(digits)}.`;
        continue;
      }
      const padded = String(value).padStart(digits, "0");
      const antes = numeroVisto.get(value);
      if (antes !== undefined) {
        if (!error)
          error =
            antes === i
              ? `El número ${padded} está repetido en este apartado.`
              : `El número ${padded} ya está en el apartado ${antes + 1}.`;
        continue;
      }
      numeroVisto.set(value, i);
      numbers.push(padded);
    }
    if (!error && numbers.length > 0 && prize === "")
      error = "Escribe el premio de este apartado (por ejemplo $1.000.000).";
    const clave = prize.toLowerCase();
    if (prize !== "") {
      const antes = premioVisto.get(clave);
      if (antes !== undefined) {
        if (!error)
          error = `El apartado ${antes + 1} ya tiene este mismo premio: al comprador le saldrían juntos en una sola tarjeta. Cambia el texto o pasa los números a ese apartado.`;
      } else {
        premioVisto.set(clave, i);
      }
    }
    /* Mismo orden que la página del sorteo: de menor a mayor. */
    numbers.sort();
    return { row, numbers, error };
  });
}

/** Agrupa el arreglo plano guardado en la base para rearmar los apartados. */
function groupInitialPrized(
  rows: RafflePrizedNumberInitial[],
  digits: number
): PrizedGroupRow[] {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const prize = row.prize ?? "";
    const list = map.get(prize) ?? [];
    list.push(String(row.number).padStart(digits, "0"));
    map.set(prize, list);
  }
  /* El id sale del índice (nunca de un contador de módulo) para que el
     servidor y el navegador pinten exactamente lo mismo. */
  return [...map.entries()].map(([prize, numbers], i) => ({
    id: `apartado-${i}`,
    prize,
    numbers: [...numbers].sort().join(", "),
  }));
}

/**
 * Ids solo para las keys de React y los `htmlFor` (no se guardan ni se
 * envían). Las filas iniciales usan su posición para que el servidor y el
 * navegador generen exactamente los mismos ids; las que agrega el usuario
 * (ya en el navegador) usan un contador que no afecta la hidratación.
 */
let addedRowSeq = 0;
function nextRowId(): string {
  addedRowSeq += 1;
  return `nueva-${addedRowSeq}`;
}

/** Cifras mínimas que necesita una cantidad total de números. */
function neededDigits(total: number): number {
  if (total <= 0) return MIN_DIGITS;
  return Math.min(MAX_DIGITS, Math.max(MIN_DIGITS, digitsForTotal(total)));
}

export default function RaffleFormV2({
  mode,
  initial,
  pasarelaLista,
}: {
  mode: "create" | "edit";
  initial?: RaffleFormInitial;
  /**
   * Si la tienda tiene ALGUNA pasarela de pago configurada (Wompi o Bold). Lo
   * decide el SERVIDOR (hayPasarela, de src/lib/pasarela.ts, en la
   * página que monta este formulario) y baja al navegador convertido en un
   * simple sí o no: las llaves de la pasarela no salen nunca del servidor.
   */
  pasarelaLista: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [prize, setPrize] = useState(initial?.prize ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null);
  const [imageAspect, setImageAspect] = useState<ImageAspectValue>(() =>
    IMAGE_ASPECT_OPCIONES.some((a) => a.value === initial?.imageAspect)
      ? (initial!.imageAspect as ImageAspectValue)
      : DEFAULT_ASPECT
  );
  /* Proporción real de la foto subida (ancho ÷ alto). Se sabe cuando el
     navegador la termina de cargar, así que hasta entonces vale 0 y no se
     habla de recortes. */
  const [imgRatio, setImgRatio] = useState(0);
  const [gallery, setGallery] = useState<string[]>(initial?.gallery ?? []);
  const [price, setPrice] = useState(
    initial ? String(initial.pricePerNumber) : "10000"
  );
  const [totalNumbers, setTotalNumbers] = useState(
    initial ? String(initial.totalNumbers) : "10000"
  );
  const [digits, setDigits] = useState(() =>
    initial?.digits
      ? Math.min(MAX_DIGITS, Math.max(MIN_DIGITS, initial.digits))
      : neededDigits(initial?.totalNumbers ?? 10000)
  );
  const [digitsNote, setDigitsNote] = useState("");
  const [selectionMode, setSelectionMode] = useState<SelectionModeValue>(() =>
    SELECTION_MODES.some((m) => m.value === initial?.selectionMode)
      ? (initial!.selectionMode as SelectionModeValue)
      : "BOTH"
  );
  const [whatsappCheckout, setWhatsappCheckout] = useState(
    initial?.whatsappCheckout ?? true
  );
  /* Lo que el dueño eligió para el cobro con pasarela. Se guarda tal cual
     aunque hoy el entorno no tenga pasarela: apagarlo por su cuenta le
     borraría la decisión al dueño y el día que se configure la pasarela
     tendría que volver a encenderla rifa por rifa. Lo que de verdad va a
     pasar es `cobraPorPasarela`, unas líneas más abajo. */
  const [gatewayCheckout, setGatewayCheckout] = useState(
    initial?.gatewayCheckout ?? true
  );
  // Filas opcionales de la ficha del sorteo. El premio nace apagado porque el
  // titular ya lo dice y repetirlo abajo recarga la tarjeta; la fecha nace
  // encendida porque el comprador siempre quiere saber cuándo se juega, y si
  // todavía no hay día en firme la ficha le muestra "Por anunciar".
  const [showPrize, setShowPrize] = useState(initial?.showPrize ?? false);
  const [showDrawDate, setShowDrawDate] = useState(
    initial?.showDrawDate ?? true
  );
  const [packs, setPacks] = useState<PackRow[]>(() =>
    initialPackRows(initial?.ticketPacks)
  );
  const [prizes, setPrizes] = useState<PrizeRow[]>(() =>
    (initial?.prizes ?? []).map((p, i) => ({
      id: `premio-${i}`,
      label: p.label ?? "",
      title: p.title ?? "",
      amount: p.amount ?? "",
      note: p.note ?? "",
    }))
  );
  const [prizedGroups, setPrizedGroups] = useState<PrizedGroupRow[]>(() =>
    groupInitialPrized(
      initial?.prizedNumbers ?? [],
      initial?.digits
        ? Math.min(MAX_DIGITS, Math.max(MIN_DIGITS, initial.digits))
        : neededDigits(initial?.totalNumbers ?? 10000)
    )
  );
  const [drawDateText, setDrawDateText] = useState(initial?.drawDateText ?? "");
  const [status, setStatus] = useState<RaffleStatusV2>(
    (RAFFLE_STATUSES_V2 as readonly string[]).includes(initial?.status ?? "")
      ? (initial!.status as RaffleStatusV2)
      : "DRAFT"
  );
  const [progressMode, setProgressMode] = useState(initial?.progressMode ?? "AUTO");
  const [manualPct, setManualPct] = useState(initial?.manualProgressPct ?? 0);
  const [reservationMinutes, setReservationMinutes] = useState(
    String(initial?.reservationMinutes ?? 10)
  );
  const [minPerOrder, setMinPerOrder] = useState(
    String(initial?.minNumbersPerOrder ?? 1)
  );
  const [maxPerOrder, setMaxPerOrder] = useState(
    String(initial?.maxNumbersPerOrder ?? 20)
  );
  const [terms, setTerms] = useState(initial?.terms ?? "");
  const [displayOrder, setDisplayOrder] = useState(
    String(initial?.displayOrder ?? 0)
  );

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /**
   * Mide la foto en cuanto su nodo entra en la página. Hace falta además del
   * `onLoad`: una foto que ya está en la memoria del navegador termina de
   * cargar ANTES de que React ate el manejador, así que ese evento no lo
   * vería nadie y los avisos de recorte no saldrían nunca.
   */
  const medirFoto = useCallback((node: HTMLImageElement | null) => {
    if (node && node.complete && node.naturalHeight > 0) {
      setImgRatio(node.naturalWidth / node.naturalHeight);
    }
  }, []);

  const totalInt = parseInt(totalNumbers || "0", 10) || 0;
  const capacity = Math.pow(10, digits);
  const numbersLocked = mode === "edit" && !!initial?.hasOrders;
  /* Con el estado GUARDADO (no el del desplegable, que todavía no se ha
     enviado) se decide si el botón abre la página pública o la vista previa. */
  const yaEsPublica = ESTADOS_PUBLICOS.has(initial?.status ?? "");
  /* Marco elegido para la foto y cuánto le recorta a la que está subida. */
  const aspectActual =
    IMAGE_ASPECT_OPCIONES.find((a) => a.value === imageAspect) ?? IMAGE_ASPECT_OPCIONES[0];
  const recorteElegido = recorteEn(imgRatio, aspectActual.ratio);
  /* El marco que menos le corta a ESTA foto: es el que se ofrece cuando el
     elegido se está comiendo media imagen. */
  const mejorAspecto = IMAGE_ASPECT_OPCIONES.reduce((mejor, op) =>
    recorteEn(imgRatio, op.ratio) < recorteEn(imgRatio, mejor.ratio) ? op : mejor
  );
  const fotoVertical = imgRatio > 0 && imgRatio < 1;
  const maxPorPedido = parseInt(maxPerOrder || "0", 10) || 0;
  const minPorPedido = parseInt(minPerOrder || "0", 10) || 0;
  const precioNumero = parseInt(price || "0", 10) || 0;
  /* Paquetes revisados en cada render (sin estado duplicado): de aquí salen la
     vista previa con el precio, los avisos y lo que se guarda. */
  const packsParsed = reviewPacks(packs, precioNumero, minPorPedido, maxPorPedido);
  /* Lo primero que esté mal escrito en los paquetes. Como las cantidades, se
     recalcula en cada render para que el aviso se apague solo al corregirlo. */
  const errorPaquetes = packsParsed.find((p) => p.error)?.error ?? "";
  /* Cantidades ya escritas: sirven para el resto de avisos del formulario. */
  const packQtys = packsParsed.map((p) => p.qty).filter((q) => q > 0);
  /* El paquete más pequeño manda: lo normal es que la compra mínima sea
     exactamente esa cantidad, para que el primer botón siga sirviendo. */
  const paqueteMinimo = packQtys.length > 0 ? Math.min(...packQtys) : 0;
  /* Se avisa cuando la compra mínima y el paquete más pequeño no coinciden:
     por arriba el paquete deja de poderse ofrecer, por abajo el mínimo no
     hace nada porque ningún botón baja hasta ahí. */
  const minDesencajado =
    paqueteMinimo > 0 && minPorPedido > 0 && minPorPedido !== paqueteMinimo;
  /* La ayuda del campo cambia con lo escrito: con 1 no hay exigencia ninguna,
     y de 2 en adelante se dice qué le pasa al comprador que pide menos. */
  const ayudaCompraMinima =
    minPorPedido === 1
      ? "Compra mínima: con 1 no exiges nada, el comprador puede llevarse un solo número."
      : minPorPedido > 1
        ? `Compra mínima: si el comprador pide menos de ${cantidadNumeros(minPorPedido)}, el sistema le rechaza la compra y le avisa ahí mismo.`
        : "Compra mínima: por debajo de esa cantidad el sistema le rechaza la compra al comprador y le avisa ahí mismo.";
  const minutosReserva = parseInt(reservationMinutes || "0", 10) || 0;
  /**
   * Lo que impide guardar y NO depende de escribir texto libre: las tres
   * cantidades que se pisan entre sí. Se revisa en cada render (no con
   * `setError`) para que el aviso se apague solo en cuanto el dueño arregla el
   * campo; si se guardara en estado, quedaría en pantalla un mensaje con
   * cifras viejas después de corregirlo.
   */
  const errorCantidades =
    minPorPedido < 1
      ? "Escribe la compra mínima: es de al menos 1 número. Ponla igual a tu paquete más pequeño."
      : maxPorPedido < 1
        ? "Escribe el máximo de números por pedido: es lo más que se puede llevar un comprador de una sola vez."
        : minPorPedido > maxPorPedido
          ? `La compra mínima es de ${cantidadNumeros(minPorPedido)} y el máximo por pedido es de ${cantidadNumeros(maxPorPedido)}: nadie podría comprar. Sube el máximo o baja la compra mínima.`
          : minutosReserva < MIN_RESERVA || minutosReserva > MAX_RESERVA
            ? `Los minutos de reserva van de ${MIN_RESERVA} a ${MAX_RESERVA} (un día entero). Escribe una cantidad dentro de ese rango.`
            : "";

  /**
   * ¿Esta rifa va a cobrar de verdad con la pasarela? Hacen falta las dos
   * cosas: que el dueño la haya encendido AQUÍ y que el entorno tenga una
   * pasarela configurada. Encendida en una tienda sin pasarela no ofrece
   * ningún botón, así que para todo lo que sigue cuenta como apagada.
   */
  const cobraPorPasarela = gatewayCheckout && pasarelaLista;
  /**
   * Sin WhatsApp y sin pasarela no queda NINGUNA forma de cobrar: el comprador
   * aparta sus números, llega a la pantalla «Realiza el pago» y ahí no le sale
   * ni un solo botón. Le pasó de verdad al dueño con sus dos rifas activas.
   * Ahora hay dos maneras de caer en ese hueco: que no haya pasarela en la
   * tienda, o que la haya y el dueño la haya apagado en esta rifa.
   */
  const sinFormaDeCobro = !whatsappCheckout && !cobraPorPasarela;
  /* El estado del desplegable (lo que va a quedar guardado), no el de la base. */
  const estadoCobra = ESTADOS_QUE_COBRAN.has(status);
  /* La salida corta cambia según por qué se quedó sin caja: si la tienda tiene
     pasarela, basta con encenderla en esta rifa; si no la tiene, hay que
     pedirle al desarrollador que la configure. */
  const salidaPasarela = pasarelaLista
    ? "enciende el cobro con pasarela de pago"
    : "pide que configuren la pasarela de pago";
  /**
   * Se FRENA el guardado, no se pide confirmación. Un diálogo de «¿seguro?» es
   * justo lo que el dueño acepta sin leer cuando va de afán, y el precio de
   * equivocarse aquí es una rifa vendiendo sin poder cobrar. Además no hay
   * ningún caso legítimo de rifa pública sin forma de pago, así que no hay nada
   * que confirmar: se sale encendiendo WhatsApp, encendiendo la pasarela o
   * dejándola en borrador, y el aviso lleva las tres salidas a un toque.
   */
  const errorCobro =
    sinFormaDeCobro && estadoCobra
      ? `No se puede publicar en «${STATUS_META_V2[status].label}» una rifa sin forma de cobrar: WhatsApp está apagado y ${
          pasarelaLista
            ? "el cobro con pasarela también"
            : "esta tienda no tiene pasarela de pago configurada"
        }. Enciende WhatsApp, ${salidaPasarela} o déjala en borrador.`
      : "";

  /* Apartados de números premiados, revisados en cada render (sin estado
     duplicado): de aquí salen la vista previa, los avisos y lo que se guarda. */
  const prizedParsed = reviewPrizedGroups(prizedGroups, digits);
  const prizedTotal = prizedParsed.reduce((n, g) => n + g.numbers.length, 0);
  /* Números escritos que la rifa no vende: existen con estas cifras pero pasan
     de la cantidad total, así que nadie podría comprarlos. */
  const prizedSinVenta = prizedParsed
    .flatMap((g) => g.numbers)
    .filter((n) => totalInt > 0 && parseInt(n, 10) >= totalInt);
  const prizedError =
    prizedParsed.find((g) => g.error)?.error ||
    (prizedTotal > MAX_PRIZED_NUMBERS
      ? `Tienes ${prizedTotal} números premiados y el máximo son ${MAX_PRIZED_NUMBERS}. Quita ${prizedTotal - MAX_PRIZED_NUMBERS}.`
      : "");
  /* Ejemplo del campo, con la cantidad de cifras que tenga la rifa. */
  const prizedPlaceholder = [1845, 2578, 3269]
    .map((n) => String(n % capacity).padStart(digits, "0"))
    .join(", ");

  function onTitleChange(value: string) {
    setTitle(value);
    setError("");
    if (!slugTouched) setSlug(slugify(value));
  }

  /** Cambia las cifras y baja el total si ya no cabe. */
  function applyDigits(next: number) {
    setDigits(next);
    const cap = Math.pow(10, next);
    if (cap < totalInt) {
      setTotalNumbers(String(cap));
      setDigitsNote(
        `Bajamos la cantidad a ${cap.toLocaleString("es-CO")} números: es todo lo que cabe en ${next} cifras.`
      );
    } else {
      setDigitsNote("");
    }
  }

  /** Cambia el total y sube las cifras si hacen falta. */
  function applyTotal(raw: string) {
    const clean = raw.replace(/\D/g, "").slice(0, 8);
    setTotalNumbers(clean);
    const value = parseInt(clean || "0", 10) || 0;
    const need = neededDigits(value);
    if (value > 0 && need > digits) {
      setDigits(need);
      setDigitsNote(
        `Subimos a ${need} cifras para que quepan ${value.toLocaleString("es-CO")} números.`
      );
    } else {
      setDigitsNote("");
    }
  }

  function updatePack(id: string, patch: Partial<PackRow>) {
    setError("");
    setPacks((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  /** Agrega un paquete con la cantidad siguiente al más grande que ya haya. */
  function addPack() {
    if (packs.length >= MAX_PACKS) return;
    setError("");
    const mayor = packQtys.length > 0 ? Math.max(...packQtys) : 0;
    const sugerida = mayor > 0 ? Math.min(MAX_PACK_QTY, mayor * 2) : 1;
    /* Si la cantidad sugerida ya existe, se deja el campo vacío para que la
       escriba él: dos paquetes iguales no se pueden guardar. */
    const libre = !packQtys.includes(sugerida);
    setPacks((rows) => [
      ...rows,
      { id: nextRowId(), qty: libre ? String(sugerida) : "", label: "", off: "" },
    ]);
  }

  function updatePrize(id: string, patch: Partial<PrizeRow>) {
    setError("");
    setPrizes((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function updatePrizedGroup(id: string, patch: Partial<PrizedGroupRow>) {
    setError("");
    setPrizedGroups((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  }

  /** Quita un número suelto del apartado sin tocar lo demás que haya escrito. */
  function removeNumberFromGroup(id: string, value: string) {
    const objetivo = parseInt(value, 10);
    setError("");
    setPrizedGroups((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r;
        let quitado = false;
        const resto = splitNumberTokens(r.numbers).filter((token) => {
          if (quitado || !/^\d+$/.test(token)) return true;
          if (parseInt(token, 10) !== objetivo) return true;
          quitado = true;
          return false;
        });
        return { ...r, numbers: resto.join(", ") };
      })
    );
  }

  async function uploadFile(
    file: File,
    onDone: (url: string) => void
  ): Promise<void> {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No fue posible subir la imagen");
        return;
      }
      onDone(data.url);
    } catch {
      setError("Error de conexión al subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  function buildPayload() {
    return {
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim(),
      prize: prize.trim(),
      imageUrl,
      imageAspect,
      gallery,
      pricePerNumber: precioNumero,
      totalNumbers: totalInt,
      digits,
      selectionMode,
      whatsappCheckout,
      /* Se manda la decisión del dueño, no el efecto. Si hoy no hay pasarela
         en la tienda, el servidor ya sabe que este sí no cobra nada; el día
         que la configuren, la rifa queda como el dueño la dejó. */
      gatewayCheckout,
      showPrize,
      showDrawDate,
      /* Los paquetes van en la forma nueva: la cantidad siempre, y la etiqueta
         y el descuento solo cuando el dueño los puso. */
      ticketPacks: packsParsed
        .filter((p) => p.qty > 0)
        .map((p) => ({
          q: p.qty,
          ...(p.row.label.trim() ? { label: p.row.label.trim() } : {}),
          ...(p.off > 0 ? { off: p.off } : {}),
        })),
      prizes: prizes
        .filter(
          (p) =>
            p.label.trim() || p.title.trim() || p.amount.trim() || p.note.trim()
        )
        .map((p) => ({
          label: p.label.trim(),
          title: p.title.trim(),
          amount: p.amount.trim(),
          note: p.note.trim(),
        })),
      /* Los apartados se estiran al arreglo plano que espera el API: cada
         número lleva repetido el premio de su apartado, que es justo lo que
         vuelve a agrupar la página del sorteo. */
      prizedNumbers: prizedParsed
        .filter((g) => g.row.prize.trim() !== "" && g.numbers.length > 0)
        .flatMap((g) =>
          g.numbers.map((n) => ({
            number: parseInt(n, 10),
            prize: g.row.prize.trim(),
          }))
        ),
      drawDateText: drawDateText.trim(),
      status,
      progressMode: progressMode as "AUTO" | "MANUAL",
      manualProgressPct: manualPct,
      reservationMinutes: parseInt(reservationMinutes || "10", 10) || 10,
      minNumbersPerOrder: minPorPedido || 1,
      maxNumbersPerOrder: parseInt(maxPerOrder || "20", 10) || 20,
      terms: terms.trim(),
      displayOrder: parseInt(displayOrder || "0", 10) || 0,
    };
  }

  async function save() {
    setError("");
    /* Las cantidades, los paquetes y la falta de cobro ya se avisan solos
       debajo del botón: aquí solo se corta el envío para no llegar a la red
       con una rifa que nadie podría comprar ni pagar. */
    if (errorCantidades || errorPaquetes || errorCobro) return;
    /* Los apartados se revisan antes de salir a la red: el mensaje del
       servidor sería mucho más seco que el nuestro. */
    if (prizedError) {
      setError(prizedError);
      return;
    }
    /* Un premio adicional a medio llenar: el servidor solo diría "Escribe el
       premio", sin decir cuál de todas las filas es. */
    const premioSinNombre = prizes.findIndex(
      (p) =>
        (p.label.trim() || p.amount.trim() || p.note.trim()) && !p.title.trim()
    );
    if (premioSinNombre !== -1) {
      setError(
        `Al premio ${premioSinNombre + 1} le falta el nombre: escríbelo en «Premio» o borra esa fila.`
      );
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        mode === "create" ? "/api/admin/raffles" : `/api/admin/raffles/${initial!.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No fue posible guardar");
        return;
      }
      router.push("/admin/rifas");
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-5"
    >
      {/* Imagen principal */}
      <div className={`${cardCls} flex flex-col gap-4`}>
        <SectionTitle>Imagen del sorteo</SectionTitle>
        <div>
          <p className={labelCls}>Imagen principal del premio</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f)
                uploadFile(f, (url) => {
                  setImageUrl(url);
                  /* Foto nueva, medida nueva: hasta que cargue no se habla de
                     recortes con las medidas de la anterior. */
                  setImgRatio(0);
                });
            }}
            aria-label="Seleccionar imagen principal"
          />
          {imageUrl ? (
            <div className="overflow-hidden rounded-xl border border-line">
              {/* La foto se ve YA recortada por el marco elegido: es la misma
                  imagen que va a salir en la página del sorteo. */}
              <div className={aspectActual.box}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={imageUrl}
                  ref={medirFoto}
                  src={imageUrl}
                  alt="Imagen del sorteo"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalHeight > 0)
                      setImgRatio(img.naturalWidth / img.naturalHeight);
                  }}
                  className={`${aspectActual.frame} w-full object-cover`}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 p-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className={btnOutline}
                >
                  <IconImage width={15} height={15} />
                  {uploading ? "Subiendo…" : "Cambiar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImageUrl(null);
                    setImgRatio(0);
                  }}
                  disabled={uploading}
                  className={btnOutline}
                >
                  <IconTrash width={15} height={15} />
                  Quitar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className={`flex ${aspectActual.frame} ${aspectActual.box} flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-line bg-well text-fg-soft transition-colors hover:border-brand hover:text-brand disabled:opacity-50`}
            >
              <IconImage width={32} height={32} />
              <span className="text-sm font-bold uppercase tracking-wide">
                {uploading ? "Subiendo…" : "Subir imagen"}
              </span>
              <span className="text-xs">Desde la galería de tu celular</span>
            </button>
          )}
          <p className={helpCls}>
            {imageUrl
              ? "Así queda la foto en la página del sorteo, ya recortada por el marco de abajo."
              : "El marco de abajo decide cómo se recorta la foto en la página del sorteo."}
          </p>
        </div>

        {/* Formato (proporción) de la foto */}
        <div>
          <p className={labelCls}>Formato de la foto</p>
          <div className="flex flex-col gap-2">
            {IMAGE_ASPECT_OPCIONES.map((op) => {
              const activo = imageAspect === op.value;
              /* Cuánto se le corta a ESTA foto en este marco. Sin foto subida
                 todavía no se puede decir nada, así que no se dice. */
              const recortePct =
                imgRatio > 0 ? Math.round(recorteEn(imgRatio, op.ratio) * 100) : 0;
              return (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => setImageAspect(op.value)}
                  aria-pressed={activo}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    activo
                      ? "glow-brand-sm border-brand bg-brand/12"
                      : "border-line bg-well hover:border-brand/60"
                  }`}
                >
                  {/* Silueta del marco, para reconocerlo de un vistazo. */}
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center"
                  >
                    <span
                      className={`${op.shape} rounded-[3px] ${
                        activo ? "bg-brand" : "bg-line-strong"
                      }`}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm font-bold ${
                        activo ? "text-fg" : "text-fg-soft"
                      }`}
                    >
                      {op.name}
                    </span>
                    <span className="block text-[11px] leading-relaxed text-fg-faint">
                      {op.help}
                    </span>
                  </span>
                  {imgRatio > 0 ? (
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold tabular-nums ${
                        recortePct <= 2
                          ? "bg-wa/15 text-wa"
                          : recortePct >= 15
                            ? "bg-warn/15 text-warn"
                            : "bg-bg2 text-fg-soft"
                      }`}
                    >
                      {recortePct <= 2 ? "Entera" : `Corta ${recortePct}%`}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className={helpCls}>
            Si tu flyer es vertical (los que traen los premios anticipados, el
            precio de la ficha y la fecha), elige Vertical: en los otros marcos
            se le corta arriba y abajo.
          </p>
          {/* Solo se avisa cuando el recorte es gordo Y existe un marco mejor
              para ESA foto: si ya está en el que menos le corta, el aviso no
              tendría salida y la etiqueta de cada opción ya dice el recorte. */}
          {recorteElegido >= 0.15 && mejorAspecto.value !== imageAspect ? (
            <div role="status" className={`mt-2 ${warnCls}`}>
              <p>
                {`Tu foto es ${fotoVertical ? "vertical" : "apaisada"} y en este marco se le corta el ${Math.round(recorteElegido * 100)}% ${fotoVertical ? "(arriba y abajo)" : "(a los lados)"}: ahí es donde suele ir la información de venta del flyer.`}
              </p>
              <button
                type="button"
                onClick={() => setImageAspect(mejorAspecto.value)}
                aria-label={`Usar el formato ${mejorAspecto.name} para la foto`}
                className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full border border-warn/50 bg-warn/10 px-4 text-[11px] font-bold uppercase tracking-[0.1em] text-warn transition-colors hover:bg-warn/20"
              >
                Usar {mejorAspecto.name}
              </button>
            </div>
          ) : null}
        </div>

        {/* Galería adicional */}
        <div>
          <p className={labelCls}>
            Imágenes adicionales ({gallery.length}/4)
          </p>
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f && gallery.length < 4)
                uploadFile(f, (url) => setGallery((g) => [...g, url]));
            }}
            aria-label="Agregar imagen a la galería"
          />
          <div className="grid grid-cols-4 gap-2">
            {gallery.map((url) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="aspect-square w-full rounded-lg border border-line object-cover" />
                <button
                  type="button"
                  onClick={() => setGallery((g) => g.filter((u) => u !== url))}
                  aria-label="Quitar imagen"
                  /* Igual que en los paquetes: aspa pequeña, área táctil de 44px. */
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white after:absolute after:-inset-2.5 after:content-['']"
                >
                  <IconX width={12} height={12} />
                </button>
              </div>
            ))}
            {gallery.length < 4 ? (
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                disabled={uploading}
                className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-line text-fg-faint hover:border-brand hover:text-brand disabled:opacity-50"
                aria-label="Agregar imagen"
              >
                +
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Información */}
      <div className={`${cardCls} flex flex-col gap-4`}>
        <SectionTitle>Información del sorteo</SectionTitle>
        <div>
          <label htmlFor="rf-title" className={labelCls}>Nombre del sorteo *</label>
          <input id="rf-title" type="text" required value={title} onChange={(e) => onTitleChange(e.target.value)} className={inputCls} placeholder="Ej: Gran Sorteo Moto 0 KM" maxLength={120} />
        </div>
        <div>
          <label htmlFor="rf-slug" className={labelCls}>URL (slug)</label>
          <input
            id="rf-slug"
            type="text"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setError("");
              setSlug(slugify(e.target.value));
            }}
            className={`${inputCls} font-mono text-sm`}
            placeholder="gran-sorteo-moto"
          />
          <p className={helpCls}>La página será /sorteo/{slug || "…"}</p>
        </div>
        <div>
          <label htmlFor="rf-prize" className={labelCls}>Premio *</label>
          <input id="rf-prize" type="text" required value={prize} onChange={(e) => setPrize(e.target.value)} className={inputCls} placeholder="Ej: Motocicleta 0 KM + $2.000.000" maxLength={160} />
        </div>
        <SwitchRow
          label="Mostrar el premio en la ficha"
          checked={showPrize}
          onToggle={() => setShowPrize((v) => !v)}
          ariaLabel={
            showPrize
              ? "Dejar de mostrar el premio en la ficha del sorteo"
              : "Mostrar el premio en la ficha del sorteo"
          }
          help={
            showPrize
              ? "En la página del sorteo aparecerá la fila «Premio» con este texto."
              : "Apagado: el premio no se repite en la ficha, porque el nombre del sorteo ya lo dice. El dato sigue guardado y se usa en otras pantallas."
          }
        />
        <div>
          <label htmlFor="rf-desc" className={labelCls}>Descripción</label>
          <textarea id="rf-desc" value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} min-h-24 py-3`} placeholder="Descripción comercial del sorteo" maxLength={2000} rows={3} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rf-price" className={labelCls}>Precio por número *</label>
            <input id="rf-price" type="text" inputMode="numeric" required value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} className={`${inputCls} tabular-nums`} placeholder="10000" />
            {/* brand-light (no brand) para que el texto pequeño cumpla AA */}
            <p className="mt-1.5 text-sm font-bold tabular-nums text-brand-light">
              {price ? formatCop(parseInt(price, 10) || 0) : ""}
            </p>
          </div>
          <div>
            <label htmlFor="rf-date" className={labelCls}>Fecha del sorteo</label>
            <input id="rf-date" type="text" value={drawDateText} onChange={(e) => setDrawDateText(e.target.value)} className={inputCls} placeholder="Ej: 30 de agosto" maxLength={120} />
          </div>
        </div>
        <SwitchRow
          label="Mostrar la fecha en la ficha"
          checked={showDrawDate}
          onToggle={() => setShowDrawDate((v) => !v)}
          ariaLabel={
            showDrawDate
              ? "Dejar de mostrar la fecha en la ficha del sorteo"
              : "Mostrar la fecha en la ficha del sorteo"
          }
          help={
            showDrawDate
              ? drawDateText.trim()
                ? "En la página del sorteo aparece la fila «Fecha» con este texto."
                : "En la página del sorteo aparece la fila «Fecha». Como todavía no escribiste ninguna, el comprador lee «Por anunciar»."
              : "Apagado: la ficha no muestra la fecha por ningún lado. Lo normal es dejarlo encendido, porque sin fecha escrita el comprador lee «Por anunciar»."
          }
        />
      </div>

      {/* Números */}
      <div className={`${cardCls} flex flex-col gap-4`}>
        <SectionTitle>Números de la rifa</SectionTitle>
        <div>
          <p className={labelCls}>Cifras del número *</p>
          <div className="grid grid-cols-6 gap-1.5">
            {DIGIT_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => applyDigits(d)}
                disabled={numbersLocked}
                aria-pressed={digits === d}
                className={`min-h-11 rounded-xl text-sm font-bold tabular-nums ${
                  digits === d ? chipBtnActive : chipBtnIdle
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <p className={helpCls}>
            Con {digits} cifras los números van de {"0".repeat(digits)} a{" "}
            {"9".repeat(digits)} ({capacity.toLocaleString("es-CO")} posibles).
            {digitsNote ? <span className="text-fg"> {digitsNote}</span> : null}
            {numbersLocked ? " · Con pedidos existentes no se puede cambiar." : ""}
          </p>
        </div>
        <div>
          <label htmlFor="rf-total" className={labelCls}>Cantidad total de números *</label>
          <div className="mb-2 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {TOTAL_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyTotal(String(preset))}
                disabled={numbersLocked}
                aria-pressed={totalInt === preset}
                className={`min-h-11 rounded-xl px-1 text-[11px] font-bold tabular-nums ${
                  totalInt === preset ? chipBtnActive : chipBtnIdle
                }`}
              >
                {preset.toLocaleString("es-CO")}
              </button>
            ))}
          </div>
          <input
            id="rf-total"
            type="text"
            inputMode="numeric"
            required
            value={totalNumbers}
            onChange={(e) => applyTotal(e.target.value)}
            className={`${inputCls} tabular-nums`}
            disabled={numbersLocked}
          />
          <p className={helpCls}>
            {totalInt > 0
              ? `Se venden del ${"0".repeat(digits)} al ${String(totalInt - 1).padStart(digits, "0")}`
              : "Define la cantidad (10 a 10.000.000)"}
            {numbersLocked
              ? " · Con pedidos existentes no se puede cambiar."
              : ""}
          </p>
        </div>
        {/* Cuánto puede comprar de una sola vez: el mínimo que exige la rifa y
            el tope por pedido, juntos porque uno depende del otro. */}
        <div>
          <div className="grid grid-cols-2 items-end gap-3">
            <div>
              <label htmlFor="rf-min" className={labelCls}>
                Compra mínima{" "}
                <span className="text-[10px] text-warn">Obligatorio</span>
              </label>
              <input
                id="rf-min"
                type="text"
                inputMode="numeric"
                required
                value={minPerOrder}
                onChange={(e) =>
                  setMinPerOrder(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                aria-describedby="rf-min-ayuda"
                className={`${inputCls} tabular-nums`}
              />
            </div>
            <div>
              <label htmlFor="rf-max" className={labelCls}>
                Máx. por pedido{" "}
                <span className="text-[10px] text-warn">Obligatorio</span>
              </label>
              <input id="rf-max" type="text" inputMode="numeric" required value={maxPerOrder} onChange={(e) => setMaxPerOrder(e.target.value.replace(/\D/g, "").slice(0, 4))} className={`${inputCls} tabular-nums`} />
            </div>
          </div>
          <p id="rf-min-ayuda" className={helpCls}>
            {ayudaCompraMinima} Lo normal es ponerla igual a tu paquete más
            pequeño.
          </p>
          {minDesencajado ? (
            <div role="status" className={`mt-2 ${warnCls}`}>
              <p>
                {minPorPedido > paqueteMinimo
                  ? `Tu paquete más pequeño es de ${cantidadNumeros(paqueteMinimo)}. Con una compra mínima de ${minPorPedido.toLocaleString("es-CO")} ese paquete no se le podrá ofrecer al comprador.`
                  : `Tu paquete más pequeño es de ${cantidadNumeros(paqueteMinimo)} y la compra mínima está en ${minPorPedido.toLocaleString("es-CO")}: ningún botón baja hasta ahí, así que ese mínimo no le cambia nada al comprador.`}
              </p>
              <button
                type="button"
                onClick={() => setMinPerOrder(String(paqueteMinimo))}
                aria-label={`Poner la compra mínima en ${cantidadNumeros(paqueteMinimo)}`}
                className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full border border-warn/50 bg-warn/10 px-4 text-[11px] font-bold uppercase tracking-[0.1em] text-warn transition-colors hover:bg-warn/20"
              >
                Usar {paqueteMinimo.toLocaleString("es-CO")}
              </button>
            </div>
          ) : null}
        </div>
        <div>
          <label htmlFor="rf-reserva" className={labelCls}>Minutos de reserva</label>
          <input id="rf-reserva" type="text" inputMode="numeric" required value={reservationMinutes} onChange={(e) => setReservationMinutes(e.target.value.replace(/\D/g, "").slice(0, 4))} className={`${inputCls} tabular-nums`} />
          <p className={helpCls}>
            Tiempo para pagar antes de liberar. De {MIN_RESERVA} a{" "}
            {MAX_RESERVA} minutos (un día entero).
          </p>
        </div>
      </div>

      {/* Cómo compra el cliente */}
      <div className={`${cardCls} flex flex-col gap-4`}>
        <SectionTitle>Cómo compra el cliente</SectionTitle>
        <div>
          <p className={labelCls}>¿Cómo elige sus números el comprador?</p>
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-line bg-well p-1.5">
            {SELECTION_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setSelectionMode(m.value)}
                aria-pressed={selectionMode === m.value}
                className={`min-h-11 rounded-xl px-1 text-[11px] font-bold uppercase tracking-[0.06em] transition-colors ${
                  selectionMode === m.value
                    ? "glow-brand-sm bg-brand text-white"
                    : "text-fg-soft hover:text-fg"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className={helpCls}>
            {selectionMode === "MANUAL"
              ? "Solo verá el buscador para escoger sus números uno por uno."
              : selectionMode === "RANDOM"
                ? "El sistema le asigna los números al azar: no aparece la opción manual."
                : "Verá las dos opciones: escoger a mano o dejar que el sistema le asigne."}
          </p>
        </div>

        <SwitchRow
          label="Cerrar la compra por WhatsApp"
          checked={whatsappCheckout}
          onToggle={() => setWhatsappCheckout((v) => !v)}
          ariaLabel={
            whatsappCheckout
              ? "Desactivar el cierre de compra por WhatsApp"
              : "Activar el cierre de compra por WhatsApp"
          }
          help={
            whatsappCheckout
              ? "Al comprar, el cliente pasa directo a tu WhatsApp con el código del pedido, cuántos números son y el total. Los números los ves tú buscando ese código en el panel."
              : "Esta rifa no mostrará WhatsApp al cliente por ningún lado. El sistema le entrega los números y el comprobante cuando el pago quede confirmado."
          }
        />

        {/* Interruptor gemelo del de WhatsApp: la otra caja de la rifa. El
            dueño puede dejarla cobrando solo por WhatsApp, solo por pasarela o
            por las dos. Si la tienda no tiene pasarela configurada sale
            apagado y sin responder al dedo: encenderlo ahí no le pondría
            ningún botón al comprador, así que prometerlo sería mentirle. */}
        <SwitchRow
          label="Cobrar con pasarela de pago"
          checked={cobraPorPasarela}
          disabled={!pasarelaLista}
          onToggle={() => setGatewayCheckout((v) => !v)}
          ariaLabel={
            !pasarelaLista
              ? "No disponible: esta tienda todavía no tiene pasarela de pago configurada"
              : cobraPorPasarela
                ? "Desactivar el cobro con pasarela de pago en esta rifa"
                : "Activar el cobro con pasarela de pago en esta rifa"
          }
          help={
            !pasarelaLista
              ? "Todavía no se puede usar: falta configurar la pasarela de pago de la tienda. Pídeselo a tu desarrollador (son unas llaves que se guardan en el servidor, nunca en el celular). Mientras tanto esta rifa cobra por WhatsApp."
              : cobraPorPasarela
                ? "El cliente paga en línea desde la misma página y, en cuanto el pago queda aprobado, el sistema le entrega los números solo, sin que tú hagas nada."
                : "Esta rifa no le mostrará al cliente el botón de pagar en línea, aunque la tienda tenga la pasarela lista. Solo cobrará por lo que dejes encendido arriba."
          }
        />

        {/* Aviso rojo pegado a los interruptores: sin WhatsApp y sin pasarela,
            la pantalla de pago del comprador se queda literalmente vacía. Sale
            siempre que se apaga (aunque la rifa esté en borrador) para que el
            dueño lo lea en el momento exacto en que toca la palanca. */}
        {sinFormaDeCobro ? (
          <div role="alert" className={dangerCls}>
            <p className="font-display text-sm font-black uppercase leading-tight tracking-[0.06em]">
              Esta rifa se queda sin forma de cobrar
            </p>
            <p className="mt-2 text-xs font-semibold leading-relaxed">
              {pasarelaLista
                ? "Apagaste las dos cajas de esta rifa: ni WhatsApp ni pasarela de pago."
                : "Acabaste de apagar WhatsApp y esta tienda no tiene pasarela de pago configurada."}{" "}
              Tus compradores van a apartar sus números, van a llegar a la
              pantalla «Realiza el pago»… y ahí no les va a aparecer ni un solo
              botón para pagarte. Así no se debe publicar.
            </p>
            <p className="mt-2 text-xs font-semibold leading-relaxed">
              {pasarelaLista ? (
                <>
                  Sales de esto encendiendo <strong>una de las dos</strong>:
                  WhatsApp o la pasarela de pago. Mientras tanto, déjala en
                  borrador.
                </>
              ) : (
                <>
                  Tienes dos salidas: <strong>enciende WhatsApp</strong> otra
                  vez, o pídele a tu desarrollador que{" "}
                  <strong>configure la pasarela de pago</strong>. Mientras
                  tanto, déjala en borrador.
                </>
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setWhatsappCheckout(true)}
                aria-label="Volver a encender el cierre de compra por WhatsApp"
                className={dangerBtnCls}
              >
                Encender WhatsApp
              </button>
              {/* La pasarela solo se ofrece a un toque cuando de verdad se
                  puede encender; si la tienda no la tiene configurada, ese
                  botón no arreglaría nada. */}
              {pasarelaLista ? (
                <button
                  type="button"
                  onClick={() => setGatewayCheckout(true)}
                  aria-label="Encender el cobro con pasarela de pago en esta rifa"
                  className={dangerBtnCls}
                >
                  Encender pasarela
                </button>
              ) : null}
              {estadoCobra ? (
                <button
                  type="button"
                  onClick={() => setStatus("DRAFT")}
                  aria-label="Pasar la rifa a borrador para que el público no la vea"
                  className={dangerBtnCls}
                >
                  Pasarla a borrador
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Paquetes: cantidad, etiqueta de color y descuento, con la tarjeta
            que verá el comprador debajo de cada uno. */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            {/* Mismo aspecto que labelCls, pero sin su margen: el aire lo pone
                la fila para que la cuenta quede alineada con el título. */}
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-fg-faint">
              Paquetes de boletas
            </span>
            <span className="shrink-0 text-[11px] font-bold tabular-nums text-fg-faint">
              {packs.length}/{MAX_PACKS}
            </span>
          </div>

          {packs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-well px-4 py-6 text-center text-sm text-fg-soft">
              Sin paquetes: el comprador tendrá que escribir a mano cuántos
              números quiere.
            </p>
          ) : null}

          <div className="flex flex-col gap-3">
            {packsParsed.map(
              (
                { row, qty, off, base, total, ahorro, error: rowError, aviso },
                i
              ) => {
                const etiqueta = row.label.trim();
                return (
                  <div
                    key={row.id}
                    className="flex flex-col gap-2.5 rounded-xl border border-line bg-well p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-violet">
                        Paquete {i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setError("");
                          setPacks((rows) =>
                            rows.filter((x) => x.id !== row.id)
                          );
                        }}
                        aria-label={`Quitar el paquete ${i + 1}`}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-fg-soft transition-colors hover:text-brand"
                      >
                        <IconTrash width={16} height={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label
                          htmlFor={`rf-pack-qty-${row.id}`}
                          className={subLabelCls}
                        >
                          Números *
                        </label>
                        <input
                          id={`rf-pack-qty-${row.id}`}
                          type="text"
                          inputMode="numeric"
                          value={row.qty}
                          onChange={(e) =>
                            updatePack(row.id, {
                              qty: e.target.value.replace(/\D/g, "").slice(0, 4),
                            })
                          }
                          aria-invalid={rowError ? true : undefined}
                          className={`${inputCls} tabular-nums`}
                          placeholder="25"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`rf-pack-off-${row.id}`}
                          className={subLabelCls}
                        >
                          Descuento %
                        </label>
                        <input
                          id={`rf-pack-off-${row.id}`}
                          type="text"
                          inputMode="numeric"
                          value={row.off}
                          onChange={(e) =>
                            updatePack(row.id, {
                              off: e.target.value.replace(/\D/g, "").slice(0, 2),
                            })
                          }
                          className={`${inputCls} tabular-nums`}
                          placeholder="Sin dcto."
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor={`rf-pack-label-${row.id}`}
                        className={subLabelCls}
                      >
                        Etiqueta (opcional)
                      </label>
                      <input
                        id={`rf-pack-label-${row.id}`}
                        type="text"
                        value={row.label}
                        onChange={(e) =>
                          updatePack(row.id, { label: e.target.value })
                        }
                        className={inputCls}
                        placeholder="Ej: Más vendido"
                        maxLength={MAX_PACK_LABEL}
                      />
                      {/* Las cuatro de siempre, a un toque. Volver a tocarla la
                          quita, para no tener que borrar letra por letra. */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {PACK_LABEL_SUGERENCIAS.map((s) => {
                          const puesta =
                            etiqueta.toLowerCase() === s.toLowerCase();
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() =>
                                updatePack(row.id, { label: puesta ? "" : s })
                              }
                              aria-pressed={puesta}
                              className={`min-h-11 rounded-full px-3 text-[11px] font-bold ${
                                puesta ? chipBtnActive : chipBtnIdle
                              }`}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {rowError ? (
                      <p role="alert" className={alertCls}>
                        {rowError}
                      </p>
                    ) : null}
                    {aviso ? (
                      <p role="status" className={warnCls}>
                        {aviso}
                      </p>
                    ) : null}

                    {/* Vista previa: la misma tarjeta de la página del sorteo,
                        con el precio ya calculado y el ahorro. */}
                    <div className="rounded-xl border border-line bg-bg2 p-3">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-fg-faint">
                        Así lo verá el comprador
                      </p>
                      {qty < 1 ? (
                        <p className="text-xs leading-relaxed text-fg-soft">
                          Escribe cuántos números trae el paquete y aquí verás
                          el botón tal como le queda al comprador.
                        </p>
                      ) : (
                        <>
                          <div className="relative mx-auto flex w-full max-w-44 flex-col items-center gap-1 rounded-3xl border border-brand/40 bg-card px-3 py-4 text-center">
                            {etiqueta ? (
                              <span className="glow-brand-sm absolute -top-2.5 left-1/2 max-w-[92%] -translate-x-1/2 truncate rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-white">
                                {etiqueta}
                              </span>
                            ) : null}
                            <span className="font-display text-4xl font-black leading-none tabular-nums text-brand">
                              {qty.toLocaleString("es-CO")}
                            </span>
                            <span className="text-xs text-fg-soft">
                              {qty === 1 ? "Número" : "Números"}
                            </span>
                            {off > 0 && precioNumero > 0 ? (
                              <span className="text-[11px] font-bold tabular-nums text-fg-faint line-through">
                                {formatCop(base)}
                              </span>
                            ) : null}
                            <span className="mt-1 max-w-full rounded-full bg-brand px-3.5 py-1.5 font-display text-sm font-black tabular-nums text-white">
                              {formatCop(total)}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
                            {precioNumero < 1
                              ? "Escribe el precio por número para ver cuánto pagaría."
                              : off > 0
                                ? `${cantidadNumeros(qty)}: ${formatCop(total)} en vez de ${formatCop(base)}, ahorra ${formatCop(ahorro)} (${off}%).`
                                : `${cantidadNumeros(qty)}: ${formatCop(total)}, sin descuento.`}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>

          <button
            type="button"
            onClick={addPack}
            disabled={packs.length >= MAX_PACKS}
            className={`${btnOutline} mt-3`}
          >
            <IconPlus width={14} height={14} />
            Agregar paquete
          </button>
          <p className={helpCls}>
            Son los botones rápidos que verá el comprador (25 números, 55
            números…). La etiqueta sale como una pastilla encima de la tarjeta y
            el descuento se lo aplica el sistema al total de ese paquete.
          </p>
        </div>
      </div>

      {/* Premios adicionales */}
      <div className={`${cardCls} flex flex-col gap-3`}>
        <SectionTitle aside={`${prizes.length}/${MAX_PRIZES}`}>
          Premios adicionales
        </SectionTitle>
        {prizes.length === 0 ? (
          <p className="text-sm text-fg-soft">
            Todavía no hay premios. Agrega el premio mayor y los anticipados.
          </p>
        ) : null}
        {prizes.map((row, i) => (
          <div
            key={row.id}
            className="flex flex-col gap-2.5 rounded-xl border border-line bg-well p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-violet">
                Premio {i + 1}
              </span>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setPrizes((rows) => rows.filter((x) => x.id !== row.id));
                }}
                aria-label={`Quitar premio ${i + 1}`}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-fg-soft transition-colors hover:text-brand"
              >
                <IconTrash width={16} height={16} />
              </button>
            </div>
            <div>
              <label
                htmlFor={`rf-prize-label-${row.id}`}
                className={subLabelCls}
              >
                Etiqueta
              </label>
              <input
                id={`rf-prize-label-${row.id}`}
                type="text"
                value={row.label}
                onChange={(e) => updatePrize(row.id, { label: e.target.value })}
                className={inputCls}
                placeholder="Ej: ANTICIPADO · LUNES"
                maxLength={60}
              />
            </div>
            <div>
              <label
                htmlFor={`rf-prize-title-${row.id}`}
                className={subLabelCls}
              >
                Premio *
              </label>
              <input
                id={`rf-prize-title-${row.id}`}
                type="text"
                value={row.title}
                onChange={(e) => updatePrize(row.id, { title: e.target.value })}
                className={inputCls}
                placeholder="Ej: Premio mayor"
                maxLength={120}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor={`rf-prize-amount-${row.id}`}
                  className={subLabelCls}
                >
                  Monto
                </label>
                <input
                  id={`rf-prize-amount-${row.id}`}
                  type="text"
                  value={row.amount}
                  onChange={(e) => updatePrize(row.id, { amount: e.target.value })}
                  className={inputCls}
                  placeholder="1.000.000"
                  maxLength={60}
                />
              </div>
              <div>
                <label
                  htmlFor={`rf-prize-note-${row.id}`}
                  className={subLabelCls}
                >
                  Nota
                </label>
                <input
                  id={`rf-prize-note-${row.id}`}
                  type="text"
                  value={row.note}
                  onChange={(e) => updatePrize(row.id, { note: e.target.value })}
                  className={inputCls}
                  placeholder="Lotería de Cundinamarca"
                  maxLength={120}
                />
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setPrizes((rows) => [
              ...rows,
              { id: nextRowId(), label: "", title: "", amount: "", note: "" },
            ])
          }
          disabled={prizes.length >= MAX_PRIZES}
          className={btnOutline}
        >
          <IconPlus width={14} height={14} />
          Agregar premio
        </button>
        <p className={helpCls}>
          Se muestran en la página del sorteo, debajo del premio principal.
        </p>
      </div>

      {/* Números premiados por apartados */}
      <div className={`${cardCls} flex flex-col gap-3`}>
        <SectionTitle aside={`${prizedTotal}/${MAX_PRIZED_NUMBERS}`}>
          Números premiados
        </SectionTitle>
        <p className={helpCls}>
          Cada apartado es una tarjeta en la página del sorteo: escribes el
          premio una sola vez y debajo van todos sus números juntos. Es
          opcional: si no agregas ningún apartado, esa sección no le aparece al
          comprador.
        </p>

        {prizedGroups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-well px-4 py-6 text-center text-sm text-fg-soft">
            Todavía no hay apartados. Esta rifa no mostrará números premiados.
          </p>
        ) : null}

        {prizedParsed.map(({ row, numbers, error: rowError }, i) => (
          <div
            key={row.id}
            className="flex flex-col gap-2.5 rounded-xl border border-line bg-well p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-violet">
                Apartado {i + 1}
              </span>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setPrizedGroups((rows) =>
                    rows.filter((x) => x.id !== row.id)
                  );
                }}
                aria-label={`Quitar el apartado ${i + 1} completo`}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-fg-soft transition-colors hover:text-brand"
              >
                <IconTrash width={16} height={16} />
              </button>
            </div>
            <div>
              <label htmlFor={`rf-pg-prize-${row.id}`} className={subLabelCls}>
                Premio de este apartado *
              </label>
              <input
                id={`rf-pg-prize-${row.id}`}
                type="text"
                value={row.prize}
                onChange={(e) =>
                  updatePrizedGroup(row.id, { prize: e.target.value })
                }
                className={inputCls}
                placeholder="Ej: $1.000.000"
                maxLength={120}
              />
            </div>
            <div>
              <label
                htmlFor={`rf-pg-numbers-${row.id}`}
                className={subLabelCls}
              >
                Números de este apartado ({numbers.length})
              </label>
              <textarea
                id={`rf-pg-numbers-${row.id}`}
                value={row.numbers}
                onChange={(e) =>
                  updatePrizedGroup(row.id, { numbers: e.target.value })
                }
                aria-invalid={rowError ? true : undefined}
                className={`${inputCls} min-h-24 py-3 font-mono text-sm tracking-wide tabular-nums`}
                placeholder={prizedPlaceholder}
                maxLength={2000}
                rows={3}
              />
              <p className={helpCls}>
                Escríbelos todos aquí, separados por comas, espacios o saltos de
                línea.
              </p>
            </div>
            {rowError ? (
              <p role="alert" className={alertCls}>
                {rowError}
              </p>
            ) : null}

            {/* Vista previa: el mismo titular y las mismas fichas de la página
                del sorteo, para que el dueño vea cómo le queda el apartado. */}
            <div className="rounded-xl border border-line bg-bg2 p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-fg-faint">
                Así lo verá el comprador
              </p>
              {numbers.length === 0 ? (
                <p className="text-xs leading-relaxed text-fg-soft">
                  Sin números, este apartado no aparece en la página del sorteo.
                </p>
              ) : (
                <>
                  <h3 className="flex items-start gap-2.5 font-display text-sm font-black uppercase leading-tight tracking-[0.12em] text-fg">
                    <span
                      aria-hidden="true"
                      className="glow-brand-sm mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full bg-brand"
                    />
                    <span className="min-w-0">
                      {numbers.length}{" "}
                      {numbers.length === 1
                        ? "número premiado"
                        : "números premiados"}{" "}
                      con {row.prize.trim() || "…"}
                    </span>
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {numbers.map((n) => (
                      <span
                        key={n}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-well py-1.5 pl-2.5 pr-1.5 font-display text-sm font-bold tabular-nums tracking-wider text-brand-light ring-1 ring-brand/30"
                      >
                        {n}
                        <button
                          type="button"
                          onClick={() => removeNumberFromGroup(row.id, n)}
                          aria-label={`Quitar el número ${n} del apartado ${i + 1}`}
                          /* Se ve de 20px, pero el área que responde al dedo
                             llega a 44px con el pseudo-elemento. */
                          className="relative flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white after:absolute after:-inset-3 after:content-['']"
                        >
                          <IconX width={10} height={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
                    Toca la equis de un número para quitarlo del apartado.
                  </p>
                </>
              )}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            setPrizedGroups((rows) => [
              ...rows,
              { id: nextRowId(), prize: "", numbers: "" },
            ])
          }
          disabled={prizedGroups.length >= MAX_PRIZED_GROUPS}
          className={btnOutline}
        >
          <IconPlus width={14} height={14} />
          Agregar apartado
        </button>
        <p className={helpCls}>
          Puedes tener hasta {MAX_PRIZED_GROUPS} apartados y{" "}
          {MAX_PRIZED_NUMBERS} números premiados en total.
        </p>

        {prizedTotal > MAX_PRIZED_NUMBERS ? (
          <p role="alert" className={alertCls}>
            Tienes {prizedTotal} números premiados y el máximo son{" "}
            {MAX_PRIZED_NUMBERS}. Quita {prizedTotal - MAX_PRIZED_NUMBERS}.
          </p>
        ) : null}

        {prizedSinVenta.length > 0 ? (
          <p role="status" className={warnCls}>
            {prizedSinVenta.length === 1
              ? `El número ${prizedSinVenta[0]} no se vende en esta rifa`
              : `Estos números no se venden en esta rifa: ${prizedSinVenta
                  .slice(0, 8)
                  .join(", ")}${prizedSinVenta.length > 8 ? "…" : ""}`}{" "}
            (van del {"0".repeat(digits)} al{" "}
            {String(totalInt - 1).padStart(digits, "0")}), así que nadie podrá
            comprarlos.
          </p>
        ) : null}
      </div>

      {/* Estado y progreso */}
      <div className={`${cardCls} flex flex-col gap-4`}>
        <SectionTitle>Estado y publicación</SectionTitle>
        <div>
          <label htmlFor="rf-status" className={labelCls}>Estado</label>
          <select id="rf-status" value={status} onChange={(e) => setStatus(e.target.value as RaffleStatusV2)} className={inputCls}>
            {RAFFLE_STATUSES_V2.map((s) => (
              <option key={s} value={s}>{STATUS_META_V2[s].label}</option>
            ))}
          </select>
          {/* El interruptor de WhatsApp está en otra tarjeta, muy arriba: aquí,
              donde de verdad se decide publicar, se repite por qué no va a
              dejarse guardar. */}
          {errorCobro ? (
            <p role="alert" className={`mt-2 ${alertCls}`}>
              {errorCobro}
            </p>
          ) : null}
        </div>
        <div>
          <p className={labelCls}>Porcentaje de avance público</p>
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-line bg-well p-1.5">
            {(["AUTO", "MANUAL"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setProgressMode(m)}
                aria-pressed={progressMode === m}
                className={`min-h-11 rounded-xl text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
                  progressMode === m
                    ? "glow-brand-sm bg-brand text-white"
                    : "text-fg-soft hover:text-fg"
                }`}
              >
                {m === "AUTO" ? "Automático" : "Manual"}
              </button>
            ))}
          </div>
          {progressMode === "AUTO" ? (
            <p className={helpCls}>
              Se calcula solo: vendidos ÷ total. El público NUNCA ve cantidades,
              solo el porcentaje.
            </p>
          ) : (
            <div className="mt-3 rounded-xl border border-line bg-well px-4 py-3">
              <div className="flex items-baseline justify-between">
                <span className={labelCls}>Porcentaje manual</span>
                <span className="font-display text-2xl font-black tabular-nums text-brand">{manualPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={manualPct}
                onChange={(e) => setManualPct(parseInt(e.target.value, 10))}
                className="range-brand"
                aria-label="Porcentaje de avance manual"
              />
            </div>
          )}
        </div>
        <div>
          <label htmlFor="rf-order" className={labelCls}>Orden de aparición</label>
          <input id="rf-order" type="text" inputMode="numeric" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value.replace(/\D/g, "").slice(0, 4))} className={`${inputCls} tabular-nums`} />
          <p className={helpCls}>Menor número aparece primero.</p>
        </div>
        <div>
          <label htmlFor="rf-terms" className={labelCls}>Términos y condiciones del sorteo</label>
          <textarea id="rf-terms" value={terms} onChange={(e) => setTerms(e.target.value)} className={`${inputCls} min-h-24 py-3`} placeholder="Condiciones específicas de esta rifa (visibles en su página)" maxLength={5000} rows={4} />
        </div>
      </div>

      {/* Un solo aviso rojo junto al botón: primero lo que impide guardar y se
          arregla solo (las cantidades, los paquetes y la falta de cobro) y
          después lo que contestó el servidor. */}
      {errorCantidades || errorPaquetes || errorCobro || error ? (
        <p role="alert" className={alertCls}>
          {errorCantidades || errorPaquetes || errorCobro || error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {mode === "edit" ? (
          <Link
            href={`/sorteo/${initial!.slug}`}
            target="_blank"
            title={
              yaEsPublica
                ? "Abrir la página del sorteo en el sitio"
                : "Solo tú puedes verla: el público todavía no"
            }
            className={`${btnOutline} min-h-13 px-3 text-[11px] sm:text-xs`}
          >
            {yaEsPublica ? "Ver en el sitio" : "Vista previa"}
          </Link>
        ) : (
          <Link
            href="/admin/rifas"
            className={`${btnOutline} min-h-13 px-3 text-[11px] sm:text-xs`}
          >
            Cancelar
          </Link>
        )}
        <button
          type="submit"
          disabled={saving || uploading}
          className={`${btnPrimary} min-h-13 px-3 text-[11px] sm:text-sm`}
        >
          {saving ? "Guardando…" : mode === "create" ? "Crear rifa" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
