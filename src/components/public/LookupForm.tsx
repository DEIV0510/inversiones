"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCop } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { IconTicket, IconWhatsApp } from "@/components/icons";

const inputCls =
  "min-h-12 w-full rounded-xl border border-line bg-well px-4 text-base text-fg placeholder:text-fg-soft/70 focus:border-brand focus:outline-none";

type LookupOrder = {
  code: string;
  raffleTitle: string;
  drawDateText: string | null;
  numbers: string[];
  quantity: number;
  total: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
};

const STATUS_LABELS: Record<string, { text: string; cls: string }> = {
  PAID: { text: "Pagada", cls: "bg-wa/15 text-wa" },
  PENDING: { text: "Pendiente de pago", cls: "bg-well text-fg-soft" },
  EXPIRED: { text: "Expirada", cls: "bg-well text-fg-faint" },
  CANCELLED: { text: "Cancelada", cls: "bg-well text-fg-faint" },
  REJECTED: { text: "En revisión", cls: "bg-brand-deep/40 text-error" },
};

export default function LookupForm({ whatsappNumber }: { whatsappNumber: string }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    participant: { name: string };
    orders: LookupOrder[];
  } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/public/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No fue posible consultar");
        return;
      }
      setResult(data);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-5">
      <form
        onSubmit={onSubmit}
        className="neon-card flex flex-col gap-4 rounded-3xl bg-card p-5 sm:p-6"
      >
        <div>
          <label htmlFor="lk-phone" className="mb-1.5 block text-sm font-semibold text-fg">
            Tu WhatsApp
          </label>
          <input
            id="lk-phone"
            type="tel"
            inputMode="numeric"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputCls}
            placeholder="Ej: 3001234567"
            maxLength={15}
            autoComplete="tel"
          />
        </div>
        <div>
          <label htmlFor="lk-code" className="mb-1.5 block text-sm font-semibold text-fg">
            Código de participación
          </label>
          <input
            id="lk-code"
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
            className={`${inputCls} font-display text-lg font-bold tracking-[0.3em]`}
            placeholder="ABC12345"
            maxLength={8}
          />
          <p className="mt-1 text-xs text-fg-faint">
            Aparece en tu comprobante de participación (8 letras y números).
          </p>
        </div>
        {error ? (
          <p role="alert" className="text-sm font-semibold text-error">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="glow-red-sm inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          <IconTicket width={18} height={18} />
          {loading ? "Consultando…" : "Consultar mis boletas"}
        </button>
        <p className="text-center text-xs leading-relaxed text-fg-faint">
          ¿No tienes tu código?{" "}
          <a
            href={waLink(
              whatsappNumber,
              "Hola, quiero consultar mis boletas pero no tengo mi código de participación."
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-fg-soft underline-offset-2 hover:underline"
          >
            Escríbenos por WhatsApp
          </a>
        </p>
      </form>

      {result ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-fg-soft">
            Hola <strong className="text-fg">{result.participant.name}</strong>,
            estas son tus participaciones:
          </p>
          {result.orders.map((o) => {
            const meta = STATUS_LABELS[o.status] ?? STATUS_LABELS.PENDING;
            return (
              <Link
                key={o.code}
                href={`/pedido/${o.code}`}
                className="rounded-2xl border border-line bg-card p-4 transition-colors hover:border-brand/60"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-sm font-extrabold uppercase text-fg">
                    {o.raffleTitle}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${meta.cls}`}
                  >
                    {meta.text}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {o.numbers.slice(0, 10).map((n) => (
                    <span
                      key={n}
                      className="rounded-md bg-well px-2 py-1 font-display text-xs font-bold tracking-wider text-fg"
                    >
                      {n}
                    </span>
                  ))}
                  {o.numbers.length > 10 ? (
                    <span className="px-1 py-1 text-xs text-fg-faint">
                      +{o.numbers.length - 10} más
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-fg-faint">
                  <span>Código {o.code}</span>
                  <span className="font-display text-sm font-black tabular-nums text-fg">
                    {formatCop(o.total)}
                  </span>
                </div>
              </Link>
            );
          })}
          <a
            href={waLink(
              whatsappNumber,
              "Hola, tengo una consulta sobre mis boletas."
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line-strong px-5 text-sm font-bold uppercase tracking-wide text-fg-soft hover:border-brand hover:text-fg"
          >
            <IconWhatsApp width={17} height={17} />
            ¿Dudas? Escríbenos
          </a>
        </div>
      ) : null}
    </div>
  );
}
