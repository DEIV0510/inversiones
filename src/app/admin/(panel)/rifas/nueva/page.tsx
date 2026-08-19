import type { Metadata } from "next";
import { requirePanelAuth } from "@/lib/auth";
import { isWompiConfigured } from "@/lib/wompi";
import RaffleFormV2 from "@/components/admin/RaffleFormV2";

export const metadata: Metadata = { title: "Nueva rifa" };
export const dynamic = "force-dynamic";

export default async function NuevaRifaPage() {
  await requirePanelAuth("raffles.manage");
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Nueva rifa
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Configura el sorteo. El motor de números se encarga del resto: hasta
          millones de números sin cargar nada pesado.
        </p>
      </div>
      {/* Solo viaja el sí o el no: las llaves de la pasarela se quedan en el
          servidor. Con esto el formulario puede frenar una rifa que se
          publicaría sin ninguna forma de cobrarle al comprador. */}
      <RaffleFormV2 mode="create" pasarelaLista={isWompiConfigured()} />
    </div>
  );
}
