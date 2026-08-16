"use client";

import { useEffect, useState } from "react";
import { formatCop } from "@/lib/format";
import {
  EmptyState,
  LoadingRows,
  Pager,
  formatDate,
  inputCls,
  labelCls,
} from "./ui";

type PaymentRow = {
  id: string;
  orderCode: string;
  raffleTitle: string;
  participant: { name: string; phone: string };
  provider: string;
  providerTxId: string | null;
  reference: string | null;
  amount: number;
  status: string;
  createdAt: string;
};

type Loaded = {
  key: string;
  items: PaymentRow[];
  total: number;
  perPage: number;
  error: string;
};

/* Lenguaje visual del panel: tarjeta violeta oscura de esquina 2xl. */
const cardCls = "rounded-2xl border border-line bg-card p-4 shadow-card";
/* Aviso de error: rosa sobre violeta, igual en todos los módulos. */
const alertCls =
  "rounded-xl border border-error/35 bg-error/10 px-4 py-3 text-sm font-medium text-error";
/* Fichas de estado: verde aprobado, ámbar en espera, rosa rechazado. */
const TAG_TONES = {
  ok: "border-wa/45 bg-wa/12 text-wa",
  warn: "border-warn/45 bg-warn/12 text-warn",
  bad: "border-error/45 bg-error/10 text-error",
  info: "border-brand/45 bg-brand/15 text-brand-light",
  muted: "border-line-strong bg-well text-fg-faint",
} as const;

function Tag({
  tone = "muted",
  children,
}: {
  tone?: keyof typeof TAG_TONES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${TAG_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

const PROVIDER_OPTIONS = [
  { value: "", label: "Todos los medios" },
  { value: "wompi", label: "Wompi" },
  { value: "manual", label: "Manual" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "APPROVED", label: "Aprobados" },
  { value: "DECLINED", label: "Rechazados" },
  { value: "PENDING", label: "Pendientes" },
  { value: "VOIDED", label: "Anulados" },
  { value: "ERROR", label: "Con error" },
];

/* Mismos textos de siempre; solo se fija el color de cada estado. */
const STATUS_TAG: Record<string, { text: string; tone: keyof typeof TAG_TONES }> =
  {
    APPROVED: { text: "Aprobado", tone: "ok" },
    DECLINED: { text: "Rechazado", tone: "bad" },
    ERROR: { text: "Error", tone: "bad" },
    PENDING: { text: "Pendiente", tone: "warn" },
    VOIDED: { text: "Anulado", tone: "muted" },
  };

function providerLabel(provider: string): string {
  if (provider === "wompi") return "Wompi";
  if (provider === "manual") return "Manual";
  return provider;
}

/**
 * Los pagos confirmados a mano no tienen transacción de pasarela: el sistema
 * les inventa un identificador interno "manual-<id del pedido>" solo para no
 * duplicarlos. Ese código no le dice nada a nadie, así que no se muestra.
 */
function txVisible(payment: PaymentRow): string | null {
  if (!payment.providerTxId) return null;
  if (payment.providerTxId.startsWith("manual-")) return null;
  return payment.providerTxId;
}

export default function PaymentsModule() {
  const [page, setPage] = useState(1);
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState("");
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const requestKey = `${page}|${provider}|${status}`;

  useEffect(() => {
    let alive = true;

    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set("status", status);
    if (provider) params.set("provider", provider);

    fetch(`/api/admin/payments?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "No fue posible cargar los pagos");
        }
        return data;
      })
      .then((data) => {
        if (!alive) return;
        setLoaded({
          key: requestKey,
          items: data.items ?? [],
          total: data.total ?? 0,
          perPage: data.perPage ?? 25,
          error: "",
        });
      })
      .catch((err) => {
        if (!alive) return;
        setLoaded({
          key: requestKey,
          items: [],
          total: 0,
          perPage: 25,
          error: err instanceof Error ? err.message : "Error de conexión",
        });
      });

    return () => {
      alive = false;
    };
  }, [requestKey, page, provider, status]);

  const current = loaded && loaded.key === requestKey ? loaded : null;
  const loading = !current;

  return (
    <div className="flex flex-col gap-4">
      <div className={`${cardCls} grid grid-cols-1 gap-3 sm:grid-cols-2`}>
        <div>
          <label htmlFor="pm-provider" className={labelCls}>
            Medio de pago
          </label>
          <select
            id="pm-provider"
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por medio de pago"
            className={inputCls}
          >
            {PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pm-status" className={labelCls}>
            Estado
          </label>
          <select
            id="pm-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por estado"
            className={inputCls}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {current?.error ? (
        <p role="alert" className={alertCls}>
          {current.error}
        </p>
      ) : null}

      {loading ? (
        <LoadingRows rows={5} />
      ) : current.items.length === 0 ? (
        current.error ? null : (
          <EmptyState text="No hay pagos registrados con estos filtros." />
        )
      ) : (
        <div className="flex flex-col gap-3">
          {current.items.map((payment) => {
            const tag = STATUS_TAG[payment.status] ?? {
              text: payment.status,
              tone: "warn" as const,
            };
            const tx = txVisible(payment);
            return (
              <article key={payment.id} className={cardCls}>
                {/* Importe grande en fucsia y estado a la derecha */}
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-2xl font-black leading-none tabular-nums text-brand">
                    {formatCop(payment.amount)}
                  </p>
                  <Tag tone={tag.tone}>{tag.text}</Tag>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Tag tone="info">{providerLabel(payment.provider)}</Tag>
                  <span className="text-xs text-fg-faint">
                    Pedido{" "}
                    <span className="font-mono uppercase tracking-[0.08em] text-brand-violet">
                      {payment.orderCode}
                    </span>
                  </span>
                </div>

                <p className="mt-2 truncate text-sm text-fg">
                  {payment.participant.name}
                  <span className="text-fg-soft">
                    {" · "}
                    {payment.participant.phone}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-xs text-fg-faint">
                  {payment.raffleTitle}
                </p>

                {payment.reference || tx ? (
                  <p className="mt-2 break-all rounded-xl border border-line bg-well px-3 py-2 font-mono text-[11px] leading-relaxed text-fg-faint">
                    {payment.reference ? `Ref: ${payment.reference}` : ""}
                    {payment.reference && tx ? " · " : ""}
                    {tx ? `Tx: ${tx}` : ""}
                  </p>
                ) : null}

                <p className="mt-2 text-xs tabular-nums text-fg-faint">
                  {formatDate(payment.createdAt)}
                </p>
              </article>
            );
          })}
        </div>
      )}

      {!loading ? (
        <Pager
          page={page}
          total={current.total}
          perPage={current.perPage}
          onPage={setPage}
        />
      ) : null}
    </div>
  );
}
