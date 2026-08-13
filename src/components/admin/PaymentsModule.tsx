"use client";

import { useEffect, useState } from "react";
import { formatCop } from "@/lib/format";
import {
  Chip,
  EmptyState,
  LoadingRows,
  Pager,
  formatDate,
  inputCls,
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

const STATUS_CHIP: Record<
  string,
  { text: string; tone: "ok" | "warn" | "bad" }
> = {
  APPROVED: { text: "Aprobado", tone: "ok" },
  DECLINED: { text: "Rechazado", tone: "bad" },
  ERROR: { text: "Error", tone: "bad" },
  PENDING: { text: "Pendiente", tone: "warn" },
  VOIDED: { text: "Anulado", tone: "warn" },
};

function providerLabel(provider: string): string {
  if (provider === "wompi") return "Wompi";
  if (provider === "manual") return "Manual";
  return provider;
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
      <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card p-4 sm:flex-row">
        <select
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
        <select
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

      {current?.error ? (
        <p
          role="alert"
          className="rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm font-medium text-error"
        >
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
            const chip = STATUS_CHIP[payment.status] ?? {
              text: payment.status,
              tone: "warn" as const,
            };
            return (
              <article
                key={payment.id}
                className="rounded-2xl border border-line bg-card p-4 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-xl font-extrabold tabular-nums text-fg">
                    {formatCop(payment.amount)}
                  </p>
                  <Chip tone={chip.tone}>{chip.text}</Chip>
                </div>

                <p className="mt-1.5 text-sm text-fg">
                  {providerLabel(payment.provider)}
                  <span className="text-fg-soft">
                    {" "}
                    · Pedido {payment.orderCode}
                  </span>
                </p>
                <p className="mt-1 truncate text-sm text-fg-soft">
                  {payment.participant.name} · {payment.participant.phone}
                </p>
                <p className="mt-0.5 truncate text-xs text-fg-faint">
                  {payment.raffleTitle}
                </p>

                {payment.reference || payment.providerTxId ? (
                  <p className="mt-2 break-all font-mono text-xs text-fg-faint">
                    {payment.reference ? `Ref: ${payment.reference}` : ""}
                    {payment.reference && payment.providerTxId ? " · " : ""}
                    {payment.providerTxId ? `Tx: ${payment.providerTxId}` : ""}
                  </p>
                ) : null}

                <p className="mt-1.5 text-xs tabular-nums text-fg-faint">
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
