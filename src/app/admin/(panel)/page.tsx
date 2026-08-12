import Link from "next/link";
import { prisma } from "@/lib/db";
import { statusMeta } from "@/lib/raffle-status";
import { IconPlus, IconSliders, IconTicket } from "@/components/icons";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export default async function AdminDashboard() {
  const raffles = await prisma.raffle.findMany({
    orderBy: { updatedAt: "desc" },
  });

  const counts = {
    active: raffles.filter((r) => r.status === "active" && r.isPublished).length,
    coming: raffles.filter((r) => r.status === "coming_soon" && r.isPublished).length,
    finished: raffles.filter((r) => r.status === "finished").length,
    hidden: raffles.filter((r) => !r.isPublished).length,
  };

  const recent = raffles.slice(0, 5);

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Hola
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Administra tus sorteos desde aquí. Los cambios se publican de
          inmediato en la página.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-brand p-5 text-white shadow-card">
          <p className="font-display text-3xl font-black tabular-nums">
            {counts.active}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-white/85">
            Rifas activas
          </p>
        </div>
        <div className="rounded-2xl bg-well p-5 text-white shadow-card">
          <p className="font-display text-3xl font-black tabular-nums">
            {counts.coming}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-white/85">
            Próximas
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-card">
          <p className="font-display text-3xl font-black tabular-nums text-fg">
            {counts.finished}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-fg-soft">
            Finalizadas
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-card">
          <p className="font-display text-3xl font-black tabular-nums text-fg">
            {counts.hidden}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-fg-soft">
            Ocultas
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/admin/rifas/nueva"
          className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark"
        >
          <IconPlus width={19} height={19} />
          Nueva rifa
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/admin/rifas"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 text-sm font-bold uppercase tracking-wide text-fg transition-colors hover:border-brand hover:text-brand"
          >
            <IconTicket width={17} height={17} />
            Ver rifas
          </Link>
          <Link
            href="/admin/config"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 text-sm font-bold uppercase tracking-wide text-fg transition-colors hover:border-brand hover:text-brand"
          >
            <IconSliders width={17} height={17} />
            Ajustes
          </Link>
        </div>
      </div>

      <section>
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-fg-soft">
          Últimas modificaciones
        </h2>
        <div className="mt-3 flex flex-col gap-2.5">
          {recent.length === 0 ? (
            <p className="rounded-2xl border border-line bg-card p-5 text-sm text-fg-soft">
              Aún no hay rifas. Crea la primera con el botón “Nueva rifa”.
            </p>
          ) : (
            recent.map((raffle) => {
              const meta = statusMeta(raffle.status);
              return (
                <Link
                  key={raffle.id}
                  href={`/admin/rifas/${raffle.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-brand"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-fg">
                      {raffle.title}
                    </p>
                    <p className="mt-0.5 text-xs text-fg-soft">
                      Editada el {dateFormatter.format(raffle.updatedAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${meta.badgeClass}`}
                  >
                    {meta.label}
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
