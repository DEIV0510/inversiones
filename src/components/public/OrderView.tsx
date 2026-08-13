"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatCop } from "@/lib/format";
import {
  IconCheck,
  IconClock,
  IconTicket,
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
  numbers: string[];
  quantity: number;
  unitPrice: number;
  total: number;
  reservedUntil: string | null;
  createdAt: string;
  paidAt: string | null;
  companyName: string;
};

const dateFmt = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

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
  return (
    <span className="font-display text-3xl font-black tabular-nums text-brand">
      {mm}:{ss}
    </span>
  );
}

export default function OrderView({
  order,
  whatsappUrl,
  wompiUrl,
}: {
  order: OrderData;
  whatsappUrl: string;
  wompiUrl: string | null;
}) {
  const router = useRouter();
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState("");
  const [copied, setCopied] = useState(false);

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

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(order.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // sin clipboard: el código sigue visible
    }
  }

  // ============ PAGADA: comprobante ============
  if (order.status === "PAID") {
    return (
      <div className="flex flex-col gap-5">
        <div className="text-center">
          <span className="glow-wa mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-wa text-white">
            <IconCheck width={30} height={30} strokeWidth={3} />
          </span>
          <h1 className="mt-4 font-display text-2xl font-black uppercase text-fg sm:text-3xl">
            ¡Participación confirmada!
          </h1>
          <p className="mt-1 text-sm text-fg-soft">
            Guarda este comprobante. Tu código es tu credencial para consultar
            tus boletas.
          </p>
        </div>

        {/* Comprobante */}
        <div className="neon-card overflow-hidden rounded-3xl bg-card">
          <div className="border-b border-line bg-bg2 px-5 py-4 text-center">
            <p className="font-display text-base font-extrabold uppercase tracking-wide text-fg">
              {order.companyName}
            </p>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-fg-faint">
              Comprobante de participación
            </p>
          </div>
          <div className="flex flex-col gap-3 px-5 py-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-fg-faint">Sorteo</span>
              <span className="text-right font-semibold text-fg">{order.raffleTitle}</span>
            </div>
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
            <div>
              <p className="text-fg-faint">Tus números</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {order.numbers.map((n) => (
                  <span
                    key={n}
                    className="rounded-lg bg-brand px-2.5 py-1.5 font-display text-sm font-bold tracking-wider text-white"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-3">
              <span className="text-fg-faint">
                {order.quantity} × {formatCop(order.unitPrice)}
              </span>
              <span className="font-display text-lg font-black tabular-nums text-fg">
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
          <button
            type="button"
            onClick={copyCode}
            className="w-full border-t border-dashed border-line bg-bg2 px-5 py-4 text-center transition-colors hover:bg-well"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-fg-faint">
              Código de participación {copied ? "· copiado ✓" : "· toca para copiar"}
            </p>
            <p className="mt-1 font-display text-3xl font-black tracking-[0.3em] text-brand">
              {order.code}
            </p>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/boletas"
            className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-bold uppercase tracking-wide text-fg hover:border-brand hover:text-brand"
          >
            <IconTicket width={17} height={17} />
            Mis boletas
          </Link>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="glow-wa inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-wa px-4 text-sm font-bold uppercase tracking-wide text-white hover:bg-wa-dark"
          >
            <IconWhatsApp width={17} height={17} />
            WhatsApp
          </a>
        </div>
      </div>
    );
  }

  // ============ PENDIENTE: pagar ============
  if (order.status === "PENDING") {
    return (
      <div className="flex flex-col gap-5">
        <div className="text-center">
          <h1 className="font-display text-2xl font-black uppercase text-fg sm:text-3xl">
            Paso 3 de 3 · <span className="text-brand">Realiza el pago</span>
          </h1>
          <p className="mt-1 text-sm text-fg-soft">
            Tus números están reservados mientras completas el pago.
          </p>
        </div>

        {order.reservedUntil ? (
          <div className="neon-card flex items-center justify-between gap-3 rounded-2xl bg-card px-5 py-4">
            <span className="flex items-center gap-2.5 text-sm font-semibold text-fg-soft">
              <IconClock width={20} height={20} className="text-brand" />
              Reserva activa
            </span>
            <Countdown
              until={order.reservedUntil}
              onExpired={() => router.refresh()}
            />
          </div>
        ) : null}

        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-fg-faint">Sorteo</span>
            <span className="text-right font-semibold text-fg">{order.raffleTitle}</span>
          </div>
          <div className="mt-2">
            <p className="text-sm text-fg-faint">Tus números reservados</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {order.numbers.map((n) => (
                <span
                  key={n}
                  className="rounded-lg bg-well px-2.5 py-1.5 font-display text-sm font-bold tracking-wider text-fg"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-3 flex justify-between gap-3 border-t border-line pt-3">
            <span className="text-sm text-fg-faint">Total a pagar</span>
            <span className="font-display text-2xl font-black tabular-nums text-fg">
              {formatCop(order.total)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {wompiUrl ? (
            <a
              href={wompiUrl}
              className="glow-red inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-base font-bold uppercase tracking-wide text-white transition-all hover:bg-brand-dark active:scale-[0.98]"
            >
              Pagar en línea (Nequi, PSE, tarjeta)
            </a>
          ) : null}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="glow-wa inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-wa px-6 text-base font-bold uppercase tracking-wide text-white transition-all hover:bg-wa-dark active:scale-[0.98]"
          >
            <IconWhatsApp width={20} height={20} />
            Coordinar pago por WhatsApp
          </a>
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
          Código de tu pedido: <strong className="text-fg-soft">{order.code}</strong>.
          Guárdalo para consultar tus boletas.
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
  const detail =
    order.status === "EXPIRED"
      ? "El tiempo de reserva terminó y los números volvieron a estar disponibles. Puedes intentarlo de nuevo."
      : order.status === "CANCELLED"
        ? "Este pedido fue cancelado. Si crees que es un error, escríbenos."
        : "Hubo un problema con este pedido. Escríbenos por WhatsApp y lo resolvemos.";

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-well text-fg-faint">
        <IconClock width={30} height={30} />
      </span>
      <div>
        <h1 className="font-display text-2xl font-black uppercase text-fg">{title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-fg-soft">{detail}</p>
      </div>
      <div className="grid w-full grid-cols-2 gap-3">
        <Link
          href={`/sorteo/${order.raffleSlug}`}
          className="glow-red-sm inline-flex min-h-13 items-center justify-center rounded-xl bg-brand px-4 text-sm font-bold uppercase tracking-wide text-white hover:bg-brand-dark"
        >
          Intentar de nuevo
        </Link>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-bold uppercase tracking-wide text-fg hover:border-brand"
        >
          <IconWhatsApp width={17} height={17} />
          WhatsApp
        </a>
      </div>
    </div>
  );
}
