"use client";

/** Piezas compartidas del panel: chips, paginación, tabla y estados. */

/* Campos: pozo muy oscuro, borde tenue y foco fucsia, como la referencia. */
export const inputCls =
  "min-h-12 w-full rounded-xl border border-line bg-bg2 px-4 text-base text-fg placeholder:text-fg-faint/70 transition-colors focus:border-brand focus:outline-none";
/* Etiquetas: mayúsculas pequeñas con tracking muy abierto. */
export const labelCls =
  "mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-fg-faint";
export const helpCls = "mt-1.5 text-xs leading-relaxed text-fg-faint";
/* Acción principal: pastilla fucsia sólida con resplandor. */
export const btnPrimary =
  "glow-brand inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-brand-dark disabled:opacity-50";
/* Acción secundaria: pastilla oscura de borde finísimo. */
export const btnOutline =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-well/60 px-4 text-xs font-bold uppercase tracking-[0.1em] text-fg-soft transition-colors hover:border-brand/60 hover:text-brand disabled:opacity-50";

/* Cabecera de página: titular display en mayúsculas y bajada pequeña. */
export const pageTitleCls =
  "font-display text-2xl font-extrabold uppercase tracking-[0.02em] text-fg sm:text-3xl";
export const pageSubtitleCls = "mt-1 text-sm text-fg-soft";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className={pageTitleCls}>{title}</h1>
        {subtitle ? <p className={pageSubtitleCls}>{subtitle}</p> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/* Fichas de estado: fondo translúcido, borde del mismo color y texto vivo. */
const TONES = {
  ok: "border border-wa/40 bg-wa/15 text-wa",
  warn: "border border-line-strong bg-well text-fg-soft",
  bad: "border border-error/40 bg-brand-deep/25 text-error",
  info: "border border-brand/40 bg-brand/15 text-brand-light",
  muted: "border border-line bg-well text-fg-faint",
} as const;

export function Chip({
  tone = "muted",
  children,
}: {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export const ORDER_STATUS_CHIP: Record<
  string,
  { text: string; tone: keyof typeof TONES }
> = {
  PENDING: { text: "Pendiente", tone: "warn" },
  PAID: { text: "Pagada", tone: "ok" },
  EXPIRED: { text: "Expirada", tone: "muted" },
  CANCELLED: { text: "Cancelada", tone: "muted" },
  REJECTED: { text: "En revisión", tone: "bad" },
};

export function Pager({
  page,
  total,
  perPage,
  onPage,
}: {
  page: number;
  total: number;
  perPage: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className={btnOutline}
      >
        Anterior
      </button>
      <span className="text-center text-[11px] font-bold uppercase tracking-[0.12em] tabular-nums text-fg-faint">
        Página {page} de {pages} · {total} registros
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        className={btnOutline}
      >
        Siguiente
      </button>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-line bg-card p-8 text-center text-sm text-fg-soft">
      {text}
    </p>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-2xl border border-line bg-card"
        />
      ))}
    </div>
  );
}

const dateFmt = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return dateFmt.format(new Date(value));
}
