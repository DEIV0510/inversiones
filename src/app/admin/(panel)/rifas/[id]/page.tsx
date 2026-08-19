import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePanelAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseTicketPacks, sanearImageAspect } from "@/lib/public";
import { isWompiConfigured } from "@/lib/wompi";
import RaffleFormV2, {
  type RafflePrizeInitial,
  type RaffleTicketPackInitial,
} from "@/components/admin/RaffleFormV2";

export const metadata: Metadata = { title: "Editar rifa" };
export const dynamic = "force-dynamic";

export default async function EditarRifaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePanelAuth("raffles.manage");
  const { id } = await params;

  const raffle = await prisma.raffle.findUnique({ where: { id } });
  if (!raffle) notFound();
  const orderCount = await prisma.order.count({ where: { raffleId: id } });

  let gallery: string[] = [];
  try {
    const parsed = JSON.parse(raffle.galleryJson);
    if (Array.isArray(parsed)) gallery = parsed;
  } catch {
    // galería corrupta → vacía
  }

  // Paquetes: se guardan de dos formas (la vieja [1,2,5,10] y la nueva con
  // etiqueta y descuento) y las dos se leen en el MISMO sitio que la página
  // del sorteo, para que el dueño edite exactamente lo que ve el comprador.
  const ticketPacks: RaffleTicketPackInitial[] = parseTicketPacks(
    raffle.ticketPacksJson
  );

  let prizes: RafflePrizeInitial[] = [];
  try {
    const parsed = JSON.parse(raffle.prizesJson);
    if (Array.isArray(parsed)) {
      prizes = parsed.map((p) => {
        const row = (p ?? {}) as Record<string, unknown>;
        return {
          label: typeof row.label === "string" ? row.label : "",
          title: typeof row.title === "string" ? row.title : "",
          amount: typeof row.amount === "string" ? row.amount : "",
          note: typeof row.note === "string" ? row.note : "",
        };
      });
    }
  } catch {
    // premios corruptos → lista vacía
  }

  const prizedRows = await prisma.prizedNumber.findMany({
    where: { raffleId: id },
    orderBy: { number: "asc" },
  });
  const prizedNumbers = prizedRows.map((p) => ({
    number: p.number,
    prize: p.prize,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Editar rifa
        </h1>
        <p className="mt-1 truncate text-sm text-fg-soft">{raffle.title}</p>
      </div>
      {/* Solo viaja el sí o el no: las llaves de la pasarela se quedan en el
          servidor. Con esto el formulario puede frenar una rifa que se
          publicaría sin ninguna forma de cobrarle al comprador. */}
      <RaffleFormV2
        mode="edit"
        pasarelaLista={isWompiConfigured()}
        initial={{
          id: raffle.id,
          slug: raffle.slug,
          title: raffle.title,
          description: raffle.description,
          prize: raffle.prize,
          imageUrl: raffle.imageUrl,
          imageAspect: sanearImageAspect(raffle.imageAspect),
          gallery,
          pricePerNumber: raffle.pricePerNumber,
          totalNumbers: raffle.totalNumbers,
          digits: raffle.digits,
          selectionMode: raffle.selectionMode,
          whatsappCheckout: raffle.whatsappCheckout,
          showPrize: raffle.showPrize,
          showDrawDate: raffle.showDrawDate,
          ticketPacks,
          prizes,
          prizedNumbers,
          drawDateText: raffle.drawDateText,
          status: raffle.status,
          progressMode: raffle.progressMode,
          manualProgressPct: raffle.manualProgressPct,
          reservationMinutes: raffle.reservationMinutes,
          minNumbersPerOrder: raffle.minNumbersPerOrder,
          maxNumbersPerOrder: raffle.maxNumbersPerOrder,
          terms: raffle.terms,
          displayOrder: raffle.displayOrder,
          hasOrders: orderCount > 0,
        }}
      />
    </div>
  );
}
