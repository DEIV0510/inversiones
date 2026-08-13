"use client";

/** Piezas compartidas del panel: chips, paginación, tabla y estados. */

export const inputCls =
  "min-h-12 w-full rounded-xl border border-line bg-well px-4 text-base text-fg placeholder:text-fg-soft/70 focus:border-brand focus:outline-none";
export const labelCls = "mb-1.5 block text-sm font-semibold text-fg";
export const helpCls = "mt-1 text-xs text-fg-soft";
export const btnPrimary =
  "glow-red-sm inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark disabled:opacity-50";
export const btnOutline =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 text-xs font-bold uppercase tracking-wide text-fg transition-colors hover:border-brand hover:text-brand disabled:opacity-50";

const TONES = {
  ok: "bg-wa/15 text-wa",
  warn: "bg-well text-fg-soft",
  bad: "bg-brand-deep/40 text-error",
  info: "bg-brand/15 text-brand",
  muted: "bg-well text-fg-faint",
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
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${TONES[tone]}`}
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
      <span className="text-xs font-semibold tabular-nums text-fg-soft">
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
    <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-fg-soft">
      {text}
    </p>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-well" />
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
