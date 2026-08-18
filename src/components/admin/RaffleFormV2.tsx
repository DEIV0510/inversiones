"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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

export type RaffleFormInitial = {
  id: string;
  slug: string;
  title: string;
  description: string;
  prize: string;
  imageUrl: string | null;
  gallery: string[];
  pricePerNumber: number;
  totalNumbers: number;
  digits: number;
  selectionMode: string;
  whatsappCheckout: boolean;
  showPrize: boolean;
  showDrawDate: boolean;
  ticketPacks: number[];
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
   de aquí. El área que responde al dedo es de 44px de alto. */
function SwitchRow({
  label,
  help,
  checked,
  ariaLabel,
  onToggle,
}: {
  label: string;
  help: string;
  checked: boolean;
  ariaLabel: string;
  onToggle: () => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer select-none items-center justify-between gap-3 rounded-xl border border-line bg-well px-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-fg">{label}</span>
        <span className={helpCls}>{help}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        onClick={onToggle}
        className="flex h-11 w-12 shrink-0 items-center justify-center"
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
const DEFAULT_PACKS = [1, 2, 5, 10];
const MAX_PACKS = 12;
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
}: {
  mode: "create" | "edit";
  initial?: RaffleFormInitial;
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
  // Filas opcionales de la ficha del sorteo. El premio nace apagado porque el
  // titular ya lo dice y repetirlo abajo recarga la tarjeta; la fecha nace
  // encendida porque el comprador siempre quiere saber cuándo se juega, y si
  // todavía no hay día en firme la ficha le muestra "Por anunciar".
  const [showPrize, setShowPrize] = useState(initial?.showPrize ?? false);
  const [showDrawDate, setShowDrawDate] = useState(
    initial?.showDrawDate ?? true
  );
  const [ticketPacks, setTicketPacks] = useState<number[]>(() =>
    initial?.ticketPacks?.length ? [...initial.ticketPacks] : [...DEFAULT_PACKS]
  );
  const [packDraft, setPackDraft] = useState("");
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

  const totalInt = parseInt(totalNumbers || "0", 10) || 0;
  const capacity = Math.pow(10, digits);
  const numbersLocked = mode === "edit" && !!initial?.hasOrders;
  /* Con el estado GUARDADO (no el del desplegable, que todavía no se ha
     enviado) se decide si el botón abre la página pública o la vista previa. */
  const yaEsPublica = ESTADOS_PUBLICOS.has(initial?.status ?? "");
  const maxPorPedido = parseInt(maxPerOrder || "0", 10) || 0;
  const minPorPedido = parseInt(minPerOrder || "0", 10) || 0;
  // Paquetes que el comprador NO llegaría a ver: la página del sorteo esconde
  // los que pasan del máximo por pedido, así que aquí se avisa antes.
  const packsOcultos = ticketPacks.filter(
    (q) => maxPorPedido > 0 && q > maxPorPedido
  );
  /* El paquete más pequeño manda: lo normal es que la compra mínima sea
     exactamente esa cantidad, para que el primer botón siga sirviendo. */
  const paqueteMinimo = ticketPacks.length > 0 ? Math.min(...ticketPacks) : 0;
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

  function addPack() {
    const value = parseInt(packDraft || "0", 10) || 0;
    if (value < 1 || value > 5000) return;
    setPackDraft("");
    if (ticketPacks.length >= MAX_PACKS || ticketPacks.includes(value)) return;
    setTicketPacks([...ticketPacks, value].sort((a, b) => a - b));
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
      gallery,
      pricePerNumber: parseInt(price || "0", 10) || 0,
      totalNumbers: totalInt,
      digits,
      selectionMode,
      whatsappCheckout,
      showPrize,
      showDrawDate,
      ticketPacks,
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
    /* Las cantidades ya se avisan solas debajo del botón: aquí solo se corta
       el envío para no llegar a la red con una rifa que nadie podría comprar. */
    if (errorCantidades) return;
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
              if (f) uploadFile(f, (url) => setImageUrl(url));
            }}
            aria-label="Seleccionar imagen principal"
          />
          {imageUrl ? (
            <div className="overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Imagen del sorteo" className="aspect-[4/3] w-full object-cover" />
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
                  onClick={() => setImageUrl(null)}
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
              className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-line bg-well text-fg-soft transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
            >
              <IconImage width={32} height={32} />
              <span className="text-sm font-bold uppercase tracking-wide">
                {uploading ? "Subiendo…" : "Subir imagen"}
              </span>
              <span className="text-xs">Desde la galería de tu celular</span>
            </button>
          )}
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

        <div>
          <p className={labelCls}>
            Paquetes de boletas ({ticketPacks.length}/{MAX_PACKS})
          </p>
          <div className="flex flex-wrap gap-2">
            {ticketPacks.length === 0 ? (
              <span className="text-sm text-fg-faint">
                Sin botones rápidos: el comprador escribe la cantidad.
              </span>
            ) : null}
            {ticketPacks.map((q) => (
              <span
                key={q}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand/40 bg-brand/12 pl-4 pr-2 text-sm font-bold text-brand-light"
              >
                <span className="tabular-nums">
                  {q === 1 ? "1 boleta" : `${q} boletas`}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setTicketPacks((packs) => packs.filter((x) => x !== q))
                  }
                  aria-label={`Quitar paquete de ${q}`}
                  /* El círculo se ve de 28px, pero el área que responde al dedo
                     crece a 44px con el pseudo-elemento, sin mover el diseño. */
                  className="relative flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white after:absolute after:-inset-2 after:content-['']"
                >
                  <IconX width={12} height={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              id="rf-pack"
              type="text"
              inputMode="numeric"
              value={packDraft}
              onChange={(e) =>
                setPackDraft(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPack();
                }
              }}
              className={`${inputCls} w-24 text-center tabular-nums`}
              placeholder="20"
              aria-label="Cantidad de boletas del paquete"
              disabled={ticketPacks.length >= MAX_PACKS}
            />
            <button
              type="button"
              onClick={addPack}
              disabled={ticketPacks.length >= MAX_PACKS || packDraft === ""}
              className={btnOutline}
            >
              <IconPlus width={14} height={14} />
              Agregar
            </button>
          </div>
          <p className={helpCls}>
            Son los botones rápidos que verá el comprador (ej. 2 boletas, 5
            boletas)
          </p>
          {packsOcultos.length > 0 ? (
            <p role="status" className={`mt-2 ${warnCls}`}>
              {packsOcultos.length === 1
                ? `El paquete de ${packsOcultos[0].toLocaleString("es-CO")} no le aparecerá al comprador: pasa del máximo`
                : `Los paquetes de ${packsOcultos
                    .map((q) => q.toLocaleString("es-CO"))
                    .join(", ")} no le aparecerán al comprador: pasan del máximo`}{" "}
              de {cantidadNumeros(maxPorPedido)} por pedido. Sube ese máximo o
              quita esos paquetes.
            </p>
          ) : null}
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
          arregla solo (las cantidades) y después lo que contestó el servidor. */}
      {errorCantidades || error ? (
        <p role="alert" className={alertCls}>
          {errorCantidades || error}
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
