import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { invalidarEtiquetas, TAG_RIFAS, tagRifaId } from "@/lib/cache-tags";
import { MAX_NUMEROS_CUADRICULA } from "@/lib/cuadricula";
import { createManualOrder, OrderError } from "@/lib/engine/orders";

export const runtime = "nodejs";

const manualOrderSchema = z.object({
  raffleId: z.string({ error: "Sorteo no válido" }).trim().min(1).max(40),
  numbers: z
    .array(z.number().int().min(0).max(MAX_NUMEROS_CUADRICULA - 1), {
      error: "Escoge al menos un número",
    })
    .min(1, "Escoge al menos un número")
    .max(MAX_NUMEROS_CUADRICULA),
  name: z
    .string({ error: "Escribe el nombre de la persona" })
    .trim()
    .min(2, "Escribe el nombre de la persona")
    .max(120),
  phone: z.string().max(20).optional(),
  markPaid: z.boolean().default(false),
});

/**
 * Apartar o vender números A MANO desde el tablero del panel (rifas de
 * cuadrícula). Es la venta que el dueño cierra por su cuenta, por ejemplo por
 * WhatsApp, sin que la persona pase por la página.
 *
 * Mismo permiso que confirmar un pago (orders.confirm): quien puede marcar un
 * pedido como pagado puede crear uno ya pagado, y nadie más.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminApi("orders.confirm");
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  }
  const parsed = manualOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 422 }
    );
  }

  try {
    const { order, numbers, confirmado } = await createManualOrder(parsed.data);

    await logAudit({
      actorEmail: auth.email,
      actorRole: auth.role,
      action: confirmado ? "order.create_manual_paid" : "order.create_manual",
      entity: "Order",
      entityId: order.id,
      detail: {
        codigo: order.code,
        numeros: numbers,
        total: order.total,
        pidioPagado: parsed.data.markPaid,
        confirmado,
      },
    });

    // Una casilla que pasa a amarillo o a verde tiene que verse así en la
    // página pública y en el porcentaje de la portada.
    revalidatePath("/");
    revalidatePath("/sorteo/[slug]", "page");
    invalidarEtiquetas(TAG_RIFAS, tagRifaId(order.raffleId));

    return NextResponse.json(
      { ok: true, code: order.code, orderId: order.id, confirmado },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json(
        { error: err.message, conflicting: err.conflicting },
        { status: err.status }
      );
    }
    console.error("Error creando pedido manual:", err);
    return NextResponse.json(
      { error: "No fue posible apartar los números. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
