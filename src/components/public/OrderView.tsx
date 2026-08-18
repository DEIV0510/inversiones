"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatCop } from "@/lib/format";
import {
  IconCalendar,
  IconCandado,
  IconCheck,
  IconClock,
  IconTicket,
  IconTrophy,
  IconWhatsApp,
} from "@/components/icons";

type OrderData = {
  code: string;
  status: string;
  raffleTitle: string;
  raffleSlug: string;
  prize: string;
  drawDateText: string | null;
  participantName: string;
  /**
   * Los números SOLO llegan con el pago confirmado. Con el pedido pendiente
   * (o expirado) esta lista viene vacía a propósito: el servidor no los
   * manda, así que no están ni en el código de la página.
   */
  numbers: string[];
  quantity: number;
  unitPrice: number;
  total: number;
  reservedUntil: string | null;
  createdAt: string;
  paidAt: string | null;
  companyName: string;
  /** Premios instantáneos ganados con los números comprados. */
  prizesWon?: { number: string; prize: string }[];
};

const dateFmt = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Fecha corta para el pie de la boleta (cabe en una línea en móvil). */
const dateShortFmt = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/* ==========================================================================
   Descarga de la boleta como imagen (Canvas 2D, sin dependencias externas)
   ========================================================================== */

/** Lienzo lógico de la boleta; se dibuja a 2x para que se vea nítido. */
const IMG_W = 720;
const IMG_H = 1000;
const IMG_ESCALA = 2;

/**
 * Paleta en crudo: el canvas no entiende las variables CSS de Tailwind, así
 * que aquí se replican los mismos tokens de globals.css.
 */
const PALETA = {
  bg: "#0a0714", // bg
  card: "#171029", // card
  line: "#40316b", // line-strong
  fg: "#f4f2fb", // fg
  fgSoft: "#a9a2c6", // fg-soft
  fgFaint: "#948cb6", // fg-faint
  brand: "#c026d3", // brand
  brandLight: "#e879f9", // brand-light
  brandViolet: "#a855f7", // brand-violet
  wa: "#25d366", // wa
  waDark: "#1da851", // wa-dark
  waLight: "#7fe6a8", // wa aclarado (mismo verde, solo más claro)
  blanco: "#ffffff",
};

type DatosBoleta = {
  titulo: string;
  numeros: string[];
  estado: string;
  fecha: string;
  codigo: string;
  empresa: string;
  fuente: string;
  /** Números de ESTE pedido que resultaron premiados (van en verde). */
  premiados: { number: string; prize: string }[];
};

/** Rectángulo redondeado dibujado a mano (no depende de ctx.roundRect). */
function rectRedondeado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radio = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.lineTo(x + w - radio, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radio);
  ctx.lineTo(x + w, y + h - radio);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radio, y + h);
  ctx.lineTo(x + radio, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radio);
  ctx.lineTo(x, y + radio);
  ctx.quadraticCurveTo(x, y, x + radio, y);
  ctx.closePath();
}

/** Ancho que ocupará un texto con espaciado manual entre letras. */
function anchoEspaciado(ctx: CanvasRenderingContext2D, texto: string, espaciado: number) {
  const letras = Array.from(texto);
  if (letras.length === 0) return 0;
  let total = 0;
  for (const letra of letras) total += ctx.measureText(letra).width + espaciado;
  return total - espaciado;
}

/** Texto con letter-spacing (el canvas no lo soporta de forma fiable). */
function textoEspaciado(
  ctx: CanvasRenderingContext2D,
  texto: string,
  x: number,
  y: number,
  espaciado: number,
  alineacion: "left" | "center" | "right" = "left"
) {
  const total = anchoEspaciado(ctx, texto, espaciado);
  let cursor = x;
  if (alineacion === "center") cursor = x - total / 2;
  if (alineacion === "right") cursor = x - total;
  const alineacionPrevia = ctx.textAlign;
  ctx.textAlign = "left";
  for (const letra of Array.from(texto)) {
    ctx.fillText(letra, cursor, y);
    cursor += ctx.measureText(letra).width + espaciado;
  }
  ctx.textAlign = alineacionPrevia;
  return total;
}

/** Recorta con puntos suspensivos cuando el texto no cabe en el ancho dado. */
function recortarTexto(ctx: CanvasRenderingContext2D, texto: string, maxAncho: number) {
  if (ctx.measureText(texto).width <= maxAncho) return texto;
  let corto = texto;
  while (corto.length > 1 && ctx.measureText(`${corto}…`).width > maxAncho) {
    corto = corto.slice(0, -1);
  }
  return `${corto}…`;
}

/** Parte el título en varias líneas sin salirse nunca del ancho disponible. */
function envolverTexto(
  ctx: CanvasRenderingContext2D,
  texto: string,
  maxAncho: number,
  maxLineas: number
) {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = "";
  let sobran = false;

  for (let i = 0; i < palabras.length; i++) {
    const prueba = actual ? `${actual} ${palabras[i]}` : palabras[i];
    if (!actual || ctx.measureText(prueba).width <= maxAncho) {
      actual = prueba;
      continue;
    }
    lineas.push(actual);
    actual = palabras[i];
    if (lineas.length >= maxLineas) {
      sobran = true;
      actual = "";
      break;
    }
  }
  if (actual && lineas.length < maxLineas) lineas.push(actual);
  if (lineas.length === 0) lineas.push("");

  const ajustadas = lineas.map((linea) => recortarTexto(ctx, linea, maxAncho));
  if (sobran) {
    const ultima = ajustadas.length - 1;
    let corto = ajustadas[ultima].replace(/…$/, "");
    while (corto.length > 1 && ctx.measureText(`${corto}…`).width > maxAncho) {
      corto = corto.slice(0, -1);
    }
    ajustadas[ultima] = `${corto}…`;
  }
  return ajustadas;
}

/**
 * Pinta la boleta completa en el canvas recibido.
 * Devuelve false si el navegador no ofrece contexto 2D.
 */
function dibujarBoleta(canvas: HTMLCanvasElement, datos: DatosBoleta) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  canvas.width = IMG_W * IMG_ESCALA;
  canvas.height = IMG_H * IMG_ESCALA;
  ctx.scale(IMG_ESCALA, IMG_ESCALA);

  const fuente = datos.fuente;

  // ---- Fondo violeta muy oscuro con halo fucsia ----
  ctx.fillStyle = PALETA.bg;
  ctx.fillRect(0, 0, IMG_W, IMG_H);
  const halo = ctx.createRadialGradient(IMG_W * 0.82, 120, 8, IMG_W * 0.82, 120, 380);
  halo.addColorStop(0, "rgba(192, 38, 211, 0.34)");
  halo.addColorStop(1, "rgba(192, 38, 211, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, IMG_W, IMG_H);

  // ---- Tarjeta con borde fucsia ----
  rectRedondeado(ctx, 36, 36, IMG_W - 72, IMG_H - 72, 40);
  ctx.fillStyle = PALETA.card;
  ctx.fill();
  ctx.strokeStyle = PALETA.brand;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // ---- Marca ----
  ctx.font = `700 14px ${fuente}`;
  ctx.fillStyle = PALETA.brandLight;
  textoEspaciado(ctx, datos.empresa.toUpperCase(), IMG_W / 2, 92, 3.5, "center");

  // ---- Etiqueta "BOLETA OFICIAL" con el cuadrito fucsia ----
  ctx.font = `700 15px ${fuente}`;
  const etiqueta = "BOLETA OFICIAL";
  const anchoEtiqueta = anchoEspaciado(ctx, etiqueta, 4);
  const inicioEtiqueta = (IMG_W - (anchoEtiqueta + 22)) / 2;
  ctx.fillStyle = PALETA.brand;
  ctx.fillRect(inicioEtiqueta, 116, 10, 10);
  ctx.fillStyle = PALETA.fgFaint;
  textoEspaciado(ctx, etiqueta, inicioEtiqueta + 22, 126, 4, "left");

  // ---- Sello de aprobado (círculo verde con chulo) ----
  ctx.beginPath();
  ctx.arc(IMG_W - 96, 112, 30, 0, Math.PI * 2);
  ctx.strokeStyle = PALETA.wa;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(IMG_W - 109, 112);
  ctx.lineTo(IMG_W - 100, 121);
  ctx.lineTo(IMG_W - 83, 103);
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.lineCap = "butt";

  // ---- Nombre del sorteo (máximo 2 líneas; encoge antes de recortar) ----
  ctx.fillStyle = PALETA.fg;
  ctx.textAlign = "center";
  const titulo = datos.titulo.toUpperCase();
  let tamTitulo = 40;
  let lineasTitulo: string[] = [];
  for (const tam of [40, 34, 29, 25]) {
    tamTitulo = tam;
    ctx.font = `800 ${tam}px ${fuente}`;
    lineasTitulo = envolverTexto(ctx, titulo, 452, 2);
    if (!lineasTitulo[lineasTitulo.length - 1].endsWith("…")) break;
  }
  ctx.font = `800 ${tamTitulo}px ${fuente}`;
  const altoLinea = Math.round(tamTitulo * 1.16);
  let y = 186;
  for (const linea of lineasTitulo) {
    ctx.fillText(linea, IMG_W / 2, y);
    y += altoLinea;
  }
  y -= altoLinea;

  // ---- Separador punteado ----
  y += 42;
  ctx.setLineDash([6, 8]);
  ctx.strokeStyle = PALETA.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(84, y);
  ctx.lineTo(IMG_W - 84, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // ---- Etiqueta "TUS NÚMEROS" ----
  y += 46;
  ctx.font = `700 16px ${fuente}`;
  ctx.fillStyle = PALETA.fgFaint;
  textoEspaciado(ctx, "TUS NÚMEROS", IMG_W / 2, y, 4.5, "center");

  // ---- Fichas con los números ----
  // Mapa número → premio: solo lo que de verdad ganó este pedido.
  const premios = new Map(datos.premiados.map((p) => [p.number, p.prize]));
  const hayPremio = premios.size > 0;

  const contenidoX = 72;
  const contenidoW = IMG_W - 144;
  const gridArriba = y + 28;
  // Cuando hay premio, la rejilla cede espacio para la felicitación.
  const gridAbajo = hayPremio ? 700 : 782;
  const total = datos.numeros.length;
  const separacion = 16;
  const alturaGrid = gridAbajo - gridArriba;

  // Se reparte en más columnas solo cuando hace falta: se elige la primera
  // distribución en la que caben todos los números.
  const distribuciones = [
    { columnas: 2, alto: 96, tam: 38 },
    { columnas: 2, alto: 78, tam: 34 },
    { columnas: 3, alto: 64, tam: 26 },
    { columnas: 4, alto: 54, tam: 20 },
  ];
  let elegida = distribuciones[0];
  let filas = 1;
  for (const opcion of distribuciones) {
    elegida = opcion;
    filas = Math.max(1, Math.floor((alturaGrid + separacion) / (opcion.alto + separacion)));
    if (opcion.columnas * filas >= total) break;
  }

  const columnas = elegida.columnas;
  const altoFicha = elegida.alto;
  const tamFicha = elegida.tam;
  const anchoFicha = (contenidoW - separacion * (columnas - 1)) / columnas;

  let capacidad = columnas * filas;
  let restantes = 0;
  if (total > capacidad) {
    // Ni con la rejilla más densa caben: se reserva una línea para el "y N más"
    filas = Math.max(
      1,
      Math.floor((alturaGrid - 36 + separacion) / (altoFicha + separacion))
    );
    capacidad = columnas * filas;
    restantes = Math.max(0, total - capacidad);
  }

  let visibles = datos.numeros.slice(0, capacidad);
  if (restantes > 0 && hayPremio) {
    // Si hubo que recortar la rejilla, un número premiado nunca se queda
    // fuera de la boleta: se adelanta al principio.
    const fuera = datos.numeros.filter(
      (n) => premios.has(n) && !visibles.includes(n)
    );
    if (fuera.length > 0) visibles = [...fuera, ...visibles].slice(0, capacidad);
  }

  // Con pocos números la rejilla se equilibra un poco en vertical para que la
  // boleta no quede con un hueco enorme antes del pie.
  const filasUsadas = Math.max(1, Math.ceil(visibles.length / columnas));
  const alturaUsada =
    filasUsadas * (altoFicha + separacion) - separacion + (restantes > 0 ? 32 : 0);
  const desplazamiento = Math.max(0, (alturaGrid - alturaUsada) / 2);

  ctx.textBaseline = "middle";
  visibles.forEach((numero, i) => {
    const col = i % columnas;
    const fila = Math.floor(i / columnas);
    // Una fila incompleta (la última, o la única cuando hay un solo número) se
    // centra en horizontal para que la boleta no quede coja.
    const enEstaFila = Math.min(columnas, visibles.length - fila * columnas);
    const sangria = ((columnas - enEstaFila) * (anchoFicha + separacion)) / 2;
    const fx = contenidoX + sangria + col * (anchoFicha + separacion);
    const fy = gridArriba + desplazamiento + fila * (altoFicha + separacion);
    const premiado = premios.has(numero);
    const degradado = ctx.createLinearGradient(fx, fy, fx + anchoFicha, fy + altoFicha);
    if (premiado) {
      // Ficha ganadora: verde de la casa, texto oscuro y borde marcado.
      degradado.addColorStop(0, PALETA.waDark);
      degradado.addColorStop(0.55, PALETA.wa);
      degradado.addColorStop(1, PALETA.waLight);
    } else {
      degradado.addColorStop(0, PALETA.brandViolet);
      degradado.addColorStop(0.55, PALETA.brand);
      degradado.addColorStop(1, PALETA.brandLight);
    }
    rectRedondeado(ctx, fx, fy, anchoFicha, altoFicha, 20);
    ctx.fillStyle = degradado;
    ctx.fill();
    if (premiado) {
      ctx.strokeStyle = PALETA.blanco;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    // En la ficha premiada el número sube un poco para dejarle sitio a la
    // palabra "PREMIADO": el color nunca va solo.
    const subeNumero = premiado ? (altoFicha >= 78 ? 11 : 7) : 0;
    ctx.font = `800 ${tamFicha}px ${fuente}`;
    ctx.fillStyle = premiado ? PALETA.bg : PALETA.blanco;
    const etiquetaNumero = recortarTexto(ctx, numero, anchoFicha - 16);
    textoEspaciado(
      ctx,
      etiquetaNumero,
      fx + anchoFicha / 2,
      fy + altoFicha / 2 + 1 - subeNumero,
      3,
      "center"
    );
    if (premiado) {
      const tamSello = altoFicha >= 78 ? 13 : 10;
      ctx.font = `800 ${tamSello}px ${fuente}`;
      ctx.fillStyle = PALETA.bg;
      // Si la ficha quedó muy angosta, se deja solo la estrella.
      const sello =
        anchoEspaciado(ctx, "★ PREMIADO", 1.5) <= anchoFicha - 12
          ? "★ PREMIADO"
          : "★";
      textoEspaciado(
        ctx,
        sello,
        fx + anchoFicha / 2,
        fy + altoFicha / 2 + (altoFicha >= 78 ? 22 : 15),
        1.5,
        "center"
      );
    }
  });
  ctx.textBaseline = "alphabetic";

  if (restantes > 0) {
    ctx.font = `700 18px ${fuente}`;
    ctx.fillStyle = PALETA.fgSoft;
    ctx.textAlign = "center";
    ctx.fillText(
      `y ${restantes} más`,
      IMG_W / 2,
      Math.min(
        gridArriba + desplazamiento + filasUsadas * (altoFicha + separacion) + 14,
        gridAbajo + 18
      )
    );
  }

  // ---- Felicitación por los números premiados ----
  if (hayPremio) {
    let yFel = gridAbajo + 30;
    ctx.textAlign = "center";
    ctx.font = `800 22px ${fuente}`;
    ctx.fillStyle = PALETA.wa;
    textoEspaciado(ctx, "¡FELICITACIONES!", IMG_W / 2, yFel, 2.5, "center");
    yFel += 26;
    ctx.fillStyle = PALETA.fg;
    const visiblesPremio = datos.premiados.slice(0, 2);
    const anchoFel = IMG_W - 180;
    for (const p of visiblesPremio) {
      const frase = `Te ganaste ${p.prize} con el número ${p.number}`;
      // El nombre del premio lo escribe el dueño y puede ser largo: antes se
      // recortaba con puntos suspensivos y se perdía justo el número premiado.
      // Ahora la frase encoge hasta caber; solo si ni al tamaño más pequeño
      // entra se recorta.
      let tamFrase = 17;
      for (const tam of [17, 15, 13]) {
        tamFrase = tam;
        ctx.font = `600 ${tam}px ${fuente}`;
        if (ctx.measureText(frase).width <= anchoFel) break;
      }
      ctx.font = `600 ${tamFrase}px ${fuente}`;
      ctx.fillText(recortarTexto(ctx, frase, anchoFel), IMG_W / 2, yFel);
      yFel += 23;
    }
    const restoPremios = datos.premiados.length - visiblesPremio.length;
    if (restoPremios > 0) {
      ctx.font = `700 15px ${fuente}`;
      ctx.fillStyle = PALETA.fgSoft;
      ctx.fillText(
        restoPremios === 1 ? "y 1 premio más" : `y ${restoPremios} premios más`,
        IMG_W / 2,
        yFel
      );
    }
  }

  // ---- Pie: fecha, estado y código ----
  ctx.setLineDash([6, 8]);
  ctx.strokeStyle = PALETA.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(84, 806);
  ctx.lineTo(IMG_W - 84, 806);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(88, 840, 5, 0, Math.PI * 2);
  ctx.fillStyle = PALETA.brand;
  ctx.fill();
  ctx.textAlign = "left";
  ctx.font = `600 17px ${fuente}`;
  ctx.fillStyle = PALETA.fgSoft;
  ctx.fillText(recortarTexto(ctx, datos.fecha, 260), 104, 846);

  ctx.font = `700 15px ${fuente}`;
  ctx.fillStyle = PALETA.wa;
  textoEspaciado(ctx, datos.estado.toUpperCase(), IMG_W - 84, 846, 3, "right");

  ctx.font = `700 13px ${fuente}`;
  ctx.fillStyle = PALETA.fgFaint;
  textoEspaciado(ctx, "CÓDIGO DE PARTICIPACIÓN", IMG_W / 2, 884, 3.5, "center");
  ctx.font = `800 26px ${fuente}`;
  ctx.fillStyle = PALETA.brandLight;
  textoEspaciado(ctx, datos.codigo.toUpperCase(), IMG_W / 2, 916, 6, "center");

  ctx.font = `700 12px ${fuente}`;
  ctx.fillStyle = PALETA.fgFaint;
  textoEspaciado(ctx, "GUARDA ESTA IMAGEN COMO COMPROBANTE", IMG_W / 2, 946, 3, "center");

  return true;
}

/** Icono de descarga (solo se usa en esta vista). */
function IconDescargar({ width = 18, height = 18 }: { width?: number; height?: number }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M4 20h16" />
    </svg>
  );
}

function Countdown({ until, onExpired }: { until: string; onExpired: () => void }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(until).getTime() - Date.now())
  );
  // El aviso de expiración se dispara UNA sola vez: si el reloj del
  // dispositivo va adelantado respecto al servidor, la página no entra en
  // un bucle de recargas.
  const firedRef = useRef(false);
  useEffect(() => {
    const id = setInterval(() => {
      const ms = Math.max(0, new Date(until).getTime() - Date.now());
      setRemaining(ms);
      if (ms === 0) {
        clearInterval(id);
        if (!firedRef.current) {
          firedRef.current = true;
          onExpired();
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [until, onExpired]);

  const totalSec = Math.floor(remaining / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  // El reloj se calcula con la hora del dispositivo, así que el segundo que
  // pinta el servidor y el que pinta el navegador casi nunca coinciden. Se
  // avisa a React de que esa diferencia es esperada: si no, la hidratación
  // fallaba y dejaba un error en la consola del comprador.
  return (
    <span
      suppressHydrationWarning
      className="font-display text-3xl font-black tabular-nums text-brand"
    >
      {`${mm}:${ss}`}
    </span>
  );
}

/** Título de sección: mayúsculas con el punto fucsia de la plataforma. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 font-display text-base font-black uppercase tracking-wide text-fg">
      <span
        aria-hidden
        className="glow-brand-sm h-[7px] w-[7px] shrink-0 rounded-full bg-brand"
      />
      {children}
    </h2>
  );
}

/** Cuántas fichas tapadas se pintan como máximo antes del "y N más". */
const MAX_FICHAS_TAPADAS = 20;

/**
 * Tarjeta de boleta: es lo que el comprador guarda como captura de pantalla.
 * Se usa en todos los estados del pedido; solo el pago aprobado lleva el
 * sello verde y el resplandor.
 *
 * Con `oculta` (pedido sin pagar) las fichas van tapadas: se ve cuántos
 * números son, pero no cuáles. Los números ni siquiera llegan al navegador.
 */
function BoletaCard({
  title,
  numbers,
  cantidad,
  estado,
  fecha,
  tono,
  nota,
  premios,
  oculta = false,
}: {
  title: string;
  numbers: string[];
  /** Cuántos números tiene el pedido (sirve también con la boleta tapada). */
  cantidad: number;
  estado: string;
  fecha: string;
  tono: "pagada" | "espera" | "inactiva";
  nota?: string;
  /** Números de este pedido que ganaron premio: van en verde. */
  premios?: { number: string; prize: string }[];
  /** true = números tapados hasta que se confirme el pago. */
  oculta?: boolean;
}) {
  const pagada = tono === "pagada";
  const inactiva = tono === "inactiva";
  const tapadas = Math.min(MAX_FICHAS_TAPADAS, Math.max(0, cantidad));
  const tapadasRestantes = Math.max(0, cantidad - tapadas);
  // Mapa número → premio para pintar la ficha ganadora sin recorrer la lista
  // en cada número.
  const ganadores = inactiva ? [] : (premios ?? []);
  const mapaGanadores = new Map(ganadores.map((p) => [p.number, p.prize]));
  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-card px-4 py-6 sm:px-6 ${
        inactiva ? "border border-line" : "neon-card"
      }`}
    >
      {/* Halo difuso de fucsia, igual que el fondo de la plataforma */}
      {inactiva ? null : (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 h-48 w-48 rounded-full bg-brand/20 blur-3xl"
        />
      )}

      {/* Sello de estado en la esquina superior derecha */}
      <span
        className={`absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border ${
          pagada ? "glow-wa border-wa text-wa" : "border-line-strong text-fg-faint"
        }`}
      >
        {pagada ? (
          <IconCheck width={18} height={18} strokeWidth={3} />
        ) : (
          <IconClock width={18} height={18} />
        )}
      </span>

      <div className="relative">
        <p className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-fg-faint">
          <span
            aria-hidden
            className="glow-brand-sm h-[7px] w-[7px] shrink-0 rounded-[2px] bg-brand"
          />
          Boleta oficial
        </p>
        <p className="mt-2 px-10 text-center font-display text-xl font-black uppercase leading-tight text-fg sm:text-2xl">
          {title}
        </p>

        <div className="my-5 border-t border-dashed border-line-strong" />

        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-fg-faint">
          {oculta ? <IconCandado width={13} height={13} /> : null}
          Tus números
        </p>

        {/* Sin pago confirmado: fichas tapadas del mismo tamaño. Se ve
            cuántos números son y que ya están apartados, pero no cuáles. */}
        {oculta ? (
          <>
            <ul className="mt-3 grid grid-cols-2 gap-2.5" aria-hidden>
              {Array.from({ length: tapadas }).map((_, i) => (
                <li
                  key={i}
                  className="flex min-h-14 items-center justify-center rounded-2xl border border-dashed border-line-strong bg-well px-1 font-display text-xl font-black tracking-[0.3em] text-fg-faint sm:text-2xl"
                >
                  •••••
                </li>
              ))}
            </ul>
            {tapadasRestantes > 0 ? (
              <p aria-hidden className="mt-2 text-center text-xs text-fg-faint">
                y {tapadasRestantes} más
              </p>
            ) : null}
            <p className="mt-3 text-center text-sm leading-relaxed text-fg-soft">
              {inactiva
                ? cantidad === 1
                  ? "Este pedido tenía 1 número. Como el pago no se confirmó, no se muestra."
                  : `Este pedido tenía ${cantidad} números. Como el pago no se confirmó, no se muestran.`
                : cantidad === 1
                  ? "Tienes 1 número apartado a tu nombre."
                  : `Tienes ${cantidad} números apartados a tu nombre.`}
            </p>
          </>
        ) : null}

        {oculta ? null : (
          <ul className="mt-3 grid grid-cols-2 gap-2.5">
            {numbers.map((n) => {
              // El número premiado va en verde Y con la palabra "Premiado":
              // el color por sí solo no basta para distinguirlo.
              const premio = mapaGanadores.get(n);
              if (premio) {
                return (
                  <li
                    key={n}
                    className="ticket-chip-win flex min-h-14 flex-col items-center justify-center rounded-2xl px-1 py-1.5"
                  >
                    <span className="font-display text-xl font-black tabular-nums tracking-[0.12em] text-bg sm:text-2xl">
                      {n}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-bg">
                      <span aria-hidden>★ </span>Premiado
                    </span>
                    <span className="sr-only">: te ganaste {premio}</span>
                  </li>
                );
              }
              return (
                <li
                  key={n}
                  className={`flex min-h-14 items-center justify-center rounded-2xl px-1 font-display text-xl font-black tabular-nums tracking-[0.12em] sm:text-2xl ${
                    inactiva
                      ? "border border-line bg-well text-fg-soft"
                      : "ticket-chip text-white"
                  }`}
                >
                  {n}
                </li>
              );
            })}
          </ul>
        )}

        {/* La felicitación viaja dentro de la boleta: es lo que el comprador
            guarda como captura o descarga como imagen. */}
        {ganadores.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-wa/50 bg-well px-3 py-3 text-center">
            <p className="font-display text-sm font-black uppercase tracking-wide text-wa">
              <span aria-hidden>★ </span>¡Felicitaciones!
            </p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {ganadores.map((p) => (
                <li key={p.number} className="text-[13px] leading-relaxed text-fg">
                  Te ganaste{" "}
                  <strong className="font-black text-wa">{p.prize}</strong> con el
                  número{" "}
                  <strong className="font-black tabular-nums tracking-wider text-wa">
                    {p.number}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-fg-soft">
            <IconCalendar width={13} height={13} className="shrink-0 text-brand" />
            {fecha}
          </span>
          <span
            className={`text-right text-[11px] font-bold uppercase tracking-[0.14em] ${
              pagada ? "text-wa" : "text-fg-faint"
            }`}
          >
            {estado}
          </span>
        </div>
        {nota ? (
          <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-fg-faint">
            {nota}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function OrderView({
  order,
  whatsappUrl,
  wompiUrl,
  autoEnviarWhatsApp = false,
}: {
  order: OrderData;
  /** null cuando la rifa está configurada sin WhatsApp. */
  whatsappUrl: string | null;
  wompiUrl: string | null;
  autoEnviarWhatsApp?: boolean;
}) {
  const router = useRouter();
  const yaEnviado = useRef(false);

  // Rifas que cierran por WhatsApp: apenas se crea el pedido, se abre la
  // conversación con el código, la cantidad y el total (nunca los números).
  // Solo una vez.
  useEffect(() => {
    if (!autoEnviarWhatsApp || !whatsappUrl || yaEnviado.current) return;
    yaEnviado.current = true;
    const id = window.setTimeout(() => {
      window.location.href = whatsappUrl;
    }, 1200);
    return () => window.clearTimeout(id);
  }, [autoEnviarWhatsApp, whatsappUrl]);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState(false);

  // Números premiados de ESTE pedido (la página solo los envía si el pedido
  // está pagado y el premio quedó a su nombre).
  const premiados = order.prizesWon ?? [];

  async function verifyPayment() {
    setVerifying(true);
    setVerifyMsg("");
    try {
      const res = await fetch(`/api/public/orders/${order.code}/verify`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (data.status === "PAID") {
        router.refresh();
      } else {
        setVerifyMsg(
          "Aún no registramos el pago. Si ya pagaste, espera un momento y verifica de nuevo."
        );
      }
    } catch {
      setVerifyMsg("Error de conexión. Intenta de nuevo.");
    } finally {
      setVerifying(false);
    }
  }

  /**
   * Dibuja la boleta en un canvas y la descarga como PNG.
   * Funciona sin conexión; si el navegador no soporta canvas, se avisa y
   * queda el mensaje de "guarda una captura de pantalla".
   *
   * SOLO con el pago confirmado: el botón únicamente existe en la vista
   * pagada, y este cerrojo evita que se dispare por otra vía (por ejemplo
   * desde la consola del navegador). Sin pagar no hay números que dibujar.
   */
  async function descargarBoleta() {
    if (order.status !== "PAID" || order.numbers.length === 0) return;
    if (descargando) return;
    setDescargando(true);
    setErrorDescarga(false);
    let url = "";
    try {
      const canvas = document.createElement("canvas");
      // Reutilizamos la tipografía del sitio si ya está cargada.
      const fuente =
        (typeof window !== "undefined" &&
          window.getComputedStyle(document.body).fontFamily) ||
        "system-ui, sans-serif";
      const fechaBoleta = order.paidAt
        ? dateShortFmt.format(new Date(order.paidAt))
        : dateShortFmt.format(new Date(order.createdAt));

      const dibujada = dibujarBoleta(canvas, {
        titulo: order.raffleTitle,
        numeros: order.numbers,
        estado: "Aprobado",
        fecha: fechaBoleta,
        codigo: order.code,
        empresa: order.companyName,
        fuente,
        premiados,
      });
      if (!dibujada) throw new Error("sin-canvas");

      url = await new Promise<string>((resolve, reject) => {
        if (typeof canvas.toBlob === "function") {
          canvas.toBlob((blob) => {
            if (blob) resolve(URL.createObjectURL(blob));
            else reject(new Error("sin-blob"));
          }, "image/png");
        } else {
          resolve(canvas.toDataURL("image/png"));
        }
      });

      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `boleta-${order.code}.png`;
      enlace.rel = "noopener";
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      if (url.startsWith("blob:")) {
        const objetoUrl = url;
        window.setTimeout(() => URL.revokeObjectURL(objetoUrl), 4000);
      }
    } catch {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      setErrorDescarga(true);
    } finally {
      setDescargando(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(order.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // sin clipboard: el código sigue visible
    }
  }

  /** Ficha del código: la credencial para consultar las boletas. */
  const codigoBox = (
    <button
      type="button"
      onClick={copyCode}
      className="w-full rounded-2xl border border-dashed border-line-strong bg-well px-4 py-4 text-center transition-colors hover:border-brand"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-faint">
        Código de participación {copied ? "· copiado ✓" : "· toca para copiar"}
      </p>
      <p className="mt-1.5 font-display text-2xl font-black tracking-[0.24em] text-brand sm:text-3xl">
        {order.code}
      </p>
    </button>
  );

  // ============ PAGADA: comprobante ============
  if (order.status === "PAID") {
    const fechaPago = order.paidAt
      ? dateShortFmt.format(new Date(order.paidAt))
      : dateShortFmt.format(new Date(order.createdAt));

    return (
      <div className="flex flex-col gap-5">
        <div className="text-center">
          <h1 className="font-display text-3xl font-black leading-tight text-fg sm:text-4xl">
            <span aria-hidden className="mr-1.5">
              🎉
            </span>
            ¡Pago aprobado!
          </h1>
          <p className="mt-2 text-sm text-fg-soft">
            Guarda una captura de pantalla de tus boletas
          </p>
        </div>

        {/* Ticket premiado: la mejor noticia del pedido, arriba de todo y en
            el verde de la casa (el mismo de la ficha ganadora). */}
        {premiados.length > 0 ? (
          <div className="glow-wa rounded-2xl border border-wa/50 bg-card p-5 text-center">
            <span className="glow-wa mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-wa text-bg">
              <IconTrophy width={28} height={28} />
            </span>
            <p className="mt-3 font-display text-2xl font-black uppercase leading-tight text-wa sm:text-3xl">
              ¡Felicitaciones!
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {premiados.map((p) => (
                <li
                  key={p.number}
                  className="rounded-xl bg-well px-4 py-3 text-sm leading-relaxed text-fg"
                >
                  Te ganaste{" "}
                  <strong className="font-display text-base font-black text-wa">
                    {p.prize}
                  </strong>{" "}
                  con el número{" "}
                  <strong className="font-display text-base font-black tabular-nums tracking-wider text-wa">
                    {p.number}
                  </strong>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-fg-soft">
              {premiados.length === 1
                ? "Tu número premiado sale en verde y marcado con ★ en la boleta."
                : "Tus números premiados salen en verde y marcados con ★ en la boleta."}
            </p>
            {whatsappUrl ? (
              <p className="mt-1.5 text-xs leading-relaxed text-fg-soft">
                Escríbenos por WhatsApp con tu código para reclamarlo.
              </p>
            ) : (
              <p className="mt-1.5 text-xs leading-relaxed text-fg-soft">
                Guarda tu código: es la credencial para reclamarlo.
              </p>
            )}
          </div>
        ) : null}

        {/* Boleta oficial */}
        <BoletaCard
          title={order.raffleTitle}
          numbers={order.numbers}
          cantidad={order.quantity}
          estado="Aprobado"
          fecha={fechaPago}
          tono="pagada"
          nota="Guarda esta imagen como comprobante"
          premios={premiados}
        />

        {/* Descarga del comprobante como PNG (se dibuja en el navegador) */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={descargarBoleta}
            disabled={descargando}
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent-blue px-5 text-sm font-bold uppercase tracking-wide text-white transition-all hover:bg-accent-blue/85 active:scale-[0.98] disabled:opacity-60"
          >
            <IconDescargar width={18} height={18} />
            {descargando ? "Generando imagen…" : "Descargar como imagen"}
          </button>
          {errorDescarga ? (
            <p role="alert" className="text-center text-xs leading-relaxed text-fg-soft">
              No pudimos generar la imagen en este dispositivo. Guarda una captura de
              pantalla de tus boletas.
            </p>
          ) : null}
        </div>

        {/* Detalle de la compra */}
        <div className="rounded-2xl border border-line bg-card p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-light">
            {order.companyName}
          </p>
          <div className="mt-1.5">
            <SectionTitle>Detalle de tu compra</SectionTitle>
          </div>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-fg-faint">Premio</span>
              <span className="text-right font-semibold text-fg">{order.prize}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-fg-faint">Participante</span>
              <span className="text-right font-semibold text-fg">{order.participantName}</span>
            </div>
            {order.drawDateText ? (
              <div className="flex justify-between gap-3">
                <span className="text-fg-faint">Fecha del sorteo</span>
                <span className="text-right font-semibold text-fg">{order.drawDateText}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-3 border-t border-line pt-3">
              <span className="text-fg-faint">
                {order.quantity} × {formatCop(order.unitPrice)}
              </span>
              <span className="font-display text-lg font-black tabular-nums text-brand">
                {formatCop(order.total)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-fg-faint">Pagado</span>
              <span className="text-right font-semibold text-wa">
                {order.paidAt ? dateFmt.format(new Date(order.paidAt)) : "Confirmado"}
              </span>
            </div>
          </div>
          <div className="mt-4">{codigoBox}</div>
        </div>

        <div className={`grid gap-3 ${whatsappUrl ? "grid-cols-2" : ""}`}>
          <Link
            href="/boletas"
            className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-bold uppercase tracking-wide text-fg hover:border-brand hover:text-brand"
          >
            <IconTicket width={17} height={17} />
            Mis boletas
          </Link>
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="glow-wa inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-wa px-4 text-sm font-bold uppercase tracking-wide text-white hover:bg-wa-dark"
            >
              <IconWhatsApp width={17} height={17} />
              WhatsApp
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  // ============ PENDIENTE: pagar ============
  if (order.status === "PENDING") {
    return (
      <div className="flex flex-col gap-5">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-light">
            Paso 3 de 3
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-black leading-tight text-fg sm:text-4xl">
            Realiza el pago
          </h1>
          {/* Se le dice de una vez lo que va a pasar: no perdió nada, sus
              números ya son suyos y los verá al confirmarse el pago. */}
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-fg-soft">
            Tus números ya están apartados a tu nombre. Los verás aquí y te
            llegarán al correo en cuanto confirmemos tu pago.
          </p>
        </div>

        {order.reservedUntil ? (
          <div className="neon-card flex items-center justify-between gap-3 rounded-2xl bg-card px-5 py-4">
            {/* El reloj se nombra por lo que de verdad hace: guardar los
                números mientras el comprador paga. Nada de "reserva". */}
            <span className="flex items-center gap-2.5 text-sm font-semibold text-fg-soft">
              <IconClock width={20} height={20} className="text-brand" />
              Te guardamos tus números
            </span>
            <Countdown
              until={order.reservedUntil}
              onExpired={() => router.refresh()}
            />
          </div>
        ) : null}

        {/* Boleta con los números tapados: se revelan al confirmar el pago */}
        <BoletaCard
          title={order.raffleTitle}
          numbers={[]}
          cantidad={order.quantity}
          estado="Pendiente de pago"
          fecha={dateShortFmt.format(new Date(order.createdAt))}
          tono="espera"
          nota="Tus números se revelan al confirmar el pago"
          oculta
        />

        <div className="rounded-2xl border border-line bg-card p-5">
          {/* Cuántos números son y cuánto cuestan: lo único que se le sigue
              mostrando del detalle mientras no haya pagado. */}
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-fg-faint">
              {order.quantity} × {formatCop(order.unitPrice)}
            </span>
            <span className="font-semibold text-fg">
              {order.quantity === 1 ? "1 número" : `${order.quantity} números`}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-fg-faint">
              Total a pagar
            </span>
            <span className="font-display text-2xl font-black tabular-nums text-brand">
              {formatCop(order.total)}
            </span>
          </div>
          <div className="mt-4">{codigoBox}</div>
        </div>

        <div className="flex flex-col gap-3">
          {wompiUrl ? (
            <a
              href={wompiUrl}
              className="glow-brand inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-base font-bold uppercase tracking-wide text-white transition-all hover:bg-brand-dark active:scale-[0.98]"
            >
              Pagar en línea (Nequi, PSE, tarjeta)
            </a>
          ) : null}
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="glow-wa inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-wa px-6 text-base font-bold uppercase tracking-wide text-white transition-all hover:bg-wa-dark active:scale-[0.98]"
            >
              <IconWhatsApp width={20} height={20} />
              {autoEnviarWhatsApp ? "Enviar mi compra por WhatsApp" : "Coordinar pago por WhatsApp"}
            </a>
          ) : null}
          {/* Solo se nombra WhatsApp cuando el canal existe de verdad */}
          {autoEnviarWhatsApp && whatsappUrl ? (
            <p className="text-center text-xs text-fg-soft">
              Te estamos llevando a WhatsApp… si no abre, toca el botón verde.
            </p>
          ) : null}
          {wompiUrl ? (
            <button
              type="button"
              onClick={verifyPayment}
              disabled={verifying}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line-strong px-5 text-sm font-bold uppercase tracking-wide text-fg-soft hover:border-brand hover:text-fg disabled:opacity-50"
            >
              {verifying ? "Verificando…" : "Ya pagué — verificar"}
            </button>
          ) : null}
          {verifyMsg ? (
            <p role="alert" className="text-center text-sm text-fg-soft">
              {verifyMsg}
            </p>
          ) : null}
        </div>

        <p className="text-center text-xs leading-relaxed text-fg-faint">
          Guarda tu código de participación para consultar tus boletas.
        </p>
      </div>
    );
  }

  // ============ EXPIRADA / CANCELADA / RECHAZADA ============
  const title =
    order.status === "EXPIRED"
      ? "Tu reserva expiró"
      : order.status === "CANCELLED"
        ? "Pedido cancelado"
        : "No pudimos confirmar este pedido";
  // El texto de contacto solo nombra WhatsApp si la rifa tiene ese canal.
  const detail =
    order.status === "EXPIRED"
      ? "El tiempo de reserva terminó y los números volvieron a estar disponibles. Puedes intentarlo de nuevo."
      : order.status === "CANCELLED"
        ? "Este pedido fue cancelado. Si crees que es un error, comunícate con nosotros."
        : whatsappUrl
          ? "Hubo un problema con este pedido. Escríbenos por WhatsApp y lo resolvemos."
          : "Hubo un problema con este pedido. Comunícate con nosotros para resolverlo.";
  const estado =
    order.status === "EXPIRED"
      ? "Reserva expirada"
      : order.status === "CANCELLED"
        ? "Cancelada"
        : "Sin confirmar";

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-well text-fg-faint">
          <IconClock width={30} height={30} />
        </span>
        <h1 className="mt-4 font-display text-2xl font-black leading-tight text-fg sm:text-3xl">
          {title}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-fg-soft">{detail}</p>
      </div>

      {/* Boleta sin validez: mismo formato, sin resplandor. Los números
          siguen tapados: este pedido nunca llegó a pagarse. */}
      <BoletaCard
        title={order.raffleTitle}
        numbers={[]}
        cantidad={order.quantity}
        estado={estado}
        fecha={dateShortFmt.format(new Date(order.createdAt))}
        tono="inactiva"
        nota="Esta boleta ya no participa"
        oculta
      />

      <div className={`grid w-full gap-3 ${whatsappUrl ? "grid-cols-2" : ""}`}>
        <Link
          href={`/sorteo/${order.raffleSlug}`}
          className="glow-brand-sm inline-flex min-h-13 items-center justify-center rounded-xl bg-brand px-4 text-sm font-bold uppercase tracking-wide text-white hover:bg-brand-dark"
        >
          Intentar de nuevo
        </Link>
        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-bold uppercase tracking-wide text-fg hover:border-brand"
          >
            <IconWhatsApp width={17} height={17} />
            WhatsApp
          </a>
        ) : null}
      </div>
    </div>
  );
}
