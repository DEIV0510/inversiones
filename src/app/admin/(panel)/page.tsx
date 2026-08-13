import { requirePanelAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const session = await requirePanelAuth("dashboard.view");
  const activeCount = await prisma.raffle.count({ where: { status: "ACTIVE" } });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Hola, {session.name}
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Panel v2 en construcción (Fase 3). Rifas activas: {activeCount}.
        </p>
      </div>
    </div>
  );
}
