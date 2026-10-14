import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { invalidarEtiquetas, TAG_RIFAS, tagRifaId } from "@/lib/cache-tags";
import { MAX_NUMEROS_CUADRICULA } from "@/lib/cuadricula";
import {
  moveOrderNumbers,
  OrderError,
  releaseOrderNumbers,
} from "@/lib/engine/orders";
import { can } from "@/lib/rbac";

export const runtime = "nodejs";

const numeros = z
  .array(z.number().int().min(0).max(MAX_NUMEROS_CUADRICULA - 1), {
    error: "Escoge al menos un número",
  })
  .min(1, "Escoge al menos un número")
  .max(MAX_NUMEROS_CUADRICULA);

const schema = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("liberar"), numbers: numeros }),
  z.object({
    accion: z.literal("pasar"),
    numbers: numeros,
    name: z
      .string({ error: "Escribe el nombre de la persona" })
      .trim()
      .min(2, "Escribe el nombre de la persona")
      .max(120),
    phone: z.string().max(20).optional(),
    markPaid: z.boolean().default(false),
  }),
]);

/**
 * Números SUELTOS de un pedido, desde el tablero del dueño (rifas de
 * cuadrícula):
 *   · "liberar" → suelta solo esos números; el resto del pedido sigue igual
 *     y su total se recalcula. Permiso de anular pedidos (orders.cancel).
 *   · "pasar"   → los suelta y los aparta a nombre de otra persona en el
 *     mismo movimiento. Necesita los dos permisos: soltar (orders.cancel) y
 *     apartar o vender a mano (orders.confirm).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi("orders.cancel");
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 422 }
    );
  }
  const datos = parsed.data;
  if (datos.accion === "pasar" && !can(auth.role, "orders.confirm")) {
    return NextResponse.json(
      { error: "No tienes permiso para esta acción" },
      { status: 403 }
    );
  }

  const { id } = await params;
  try {
    let raffleId: string;
    let respuesta: Record<string, unknown>;

    if (datos.accion === "liberar") {
      const r = await releaseOrderNumbers(id, datos.numbers);
      raffleId = r.order.raffleId;
      await logAudit({
        actorEmail: auth.email,
        actorRole: auth.role,
        action: "order.release_numbers",
        entity: "Order",
        entityId: id,
        detail: {
          codigo: r.order.code,
          sueltos: r.sueltos,
          quedan: r.quedan,
          totalNuevo: r.order.total,
          eraPagado: r.eraPagado,
          anulado: r.quedan.length === 0,
        },
      });
      respuesta = {
        ok: true,
        sueltos: r.sueltos,
        quedan: r.quedan,
        total: r.order.total,
        anulado: r.quedan.length === 0,
      };
    } else {
      const r = await moveOrderNumbers({ orderId: id, ...datos });
      raffleId = r.destino.raffleId;
      await logAudit({
        actorEmail: auth.email,
        actorRole: auth.role,
        action: "order.move_numbers",
        entity: "Order",
        entityId: id,
        detail: {
          desde: r.origen.code,
          hacia: r.destino.code,
          numeros: r.numeros,
          aNombreDe: datos.name,
          pidioPagado: datos.markPaid,
          confirmado: r.confirmado,
        },
      });
      respuesta = {
        ok: true,
        numeros: r.numeros,
        code: r.destino.code,
        confirmado: r.confirmado,
      };
    }

    // Una casilla que cambia de dueño o queda libre tiene que verse así en la
    // página pública y en el porcentaje de la portada.
    revalidatePath("/");
    revalidatePath("/sorteo/[slug]", "page");
    invalidarEtiquetas(TAG_RIFAS, tagRifaId(raffleId));

    return NextResponse.json(respuesta);
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error cambiando números de un pedido:", err);
    return NextResponse.json(
      { error: "No fue posible hacer el cambio. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
