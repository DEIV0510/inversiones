import type { Metadata } from "next";
import { requirePanelAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import NumbersModule from "@/components/admin/NumbersModule";

export const metadata: Metadata = { title: "Números" };
export const dynamic = "force-dynamic";

export default async function AdminNumbersPage({
  searchParams,
}: {
  searchParams: Promise<{ raffleId?: string }>;
}) {
  const session = await requirePanelAuth("numbers.view");
  const { raffleId } = await searchParams;
  const canBlock = can(session.role, "numbers.block");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Números
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Consulta puntual, números tomados y bloqueos por rifa
        </p>
      </div>

      <NumbersModule initialRaffleId={raffleId ?? ""} canBlock={canBlock} />
    </div>
  );
}
