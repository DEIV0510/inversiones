import { NextRequest, NextResponse } from "next/server";
import { createOrder, OrderError } from "@/lib/engine/orders";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { createOrderSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (
    isRateLimited("orders.create", ip, {
      max: 10,
      windowMs: 10 * 60_000,
      globalMax: 300,
    })
  ) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 422 }
    );
  }

  try {
    // Los números que devuelve createOrder se quedan en el servidor: el
    // pedido nace PENDIENTE y hasta que el pago no esté confirmado no salen
    // de aquí (antes viajaban en esta respuesta y se leían con las
    // herramientas del navegador sin haber pagado).
    const { order } = await createOrder({
      raffleSlug: parsed.data.raffleSlug,
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email || undefined,
      // Cédula: campo opcional del modal de compra. Ya viene validada y sin
      // separadores; una cédula vacía se manda como "no hay dato".
      idNumber: parsed.data.idNumber || undefined,
      numbers: parsed.data.numbers,
      randomCount: parsed.data.randomCount,
    });

    return NextResponse.json(
      {
        code: order.code,
        reservedUntil: order.reservedUntil,
        total: order.total,
        quantity: order.quantity,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json(
        { error: err.message, conflicting: err.conflicting },
        { status: err.status }
      );
    }
    console.error("Error creando orden:", err);
    return NextResponse.json(
      { error: "No fue posible crear tu pedido. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
