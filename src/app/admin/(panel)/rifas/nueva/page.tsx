import type { Metadata } from "next";
import { requirePanelAuth } from "@/lib/auth";
import { hayPasarela } from "@/lib/pasarela";
import RaffleFormV2 from "@/components/admin/RaffleFormV2";

export const metadata: Metadata = { title: "Nueva rifa" };
export const dynamic = "force-dynamic";

export default async function NuevaRifaPage({
  searchParams,
}: {
  // ?tipo=cuadricula abre el formulario ya en la rifa de 2 o 3 cifras.
  searchParams: Promise<{ tipo?: string }>;
}) {
  await requirePanelAuth("raffles.manage");
  const { tipo } = await searchParams;
  const tipoInicial = tipo === "cuadricula" ? "cuadricula" : "grande";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Nueva rifa
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Elige el tipo de rifa y configúrala. La de 2 o 3 cifras enseña su
          tablero completo; la grande puede tener hasta millones de números
          sin cargar nada pesado.
        </p>
      </div>
      {/* Solo viaja el sí o el no (¿hay Wompi o Bold configurados?): las
          llaves de la pasarela se quedan en el servidor. Con esto el
          formulario sabe si puede ofrecer el interruptor de la pasarela y
          puede frenar una rifa que se publicaría sin ninguna forma de
          cobrarle al comprador. La key vuelve a montar el formulario si se
          llega con el otro ?tipo= sin salir de la página. */}
      <RaffleFormV2
        key={tipoInicial}
        mode="create"
        pasarelaLista={hayPasarela()}
        tipoInicial={tipoInicial}
      />
    </div>
  );
}
