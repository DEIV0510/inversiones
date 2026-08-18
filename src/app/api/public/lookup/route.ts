import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isOrderExpired } from "@/lib/engine/orders";
import { formatNumbers } from "@/lib/numbers";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { lookupSchema } from "@/lib/validation";
import { normalizeWhatsApp } from "@/lib/whatsapp";

export const runtime = "nodejs";

/**
 * MIS BOLETAS con UN SOLO dato: el comprador escribe su celular, su correo,
 * su cédula o el código de compra y el servidor deduce qué le llegó.
 *
 * Antes la credencial era la PAREJA teléfono + código, que funcionaba como
 * contraseña. El dueño pidió expresamente la búsqueda con un solo dato (así
 * funcionan las plataformas de rifas), de modo que quien conozca un teléfono
 * puede ver esas boletas. Para acotar el riesgo:
 *   - límite de intentos endurecido y en dos ventanas (corta y de una hora);
 *   - la respuesta de "no hay nada" es SIEMPRE idéntica, así que nunca revela
 *     si el dato existe, si estaba mal escrito o si simplemente no se pudo
 *     interpretar;
 *   - se devuelve lo mismo de antes (nombre y pedidos) y nunca el teléfono,
 *     el correo ni la cédula del comprador.
 */

/** Un solo mensaje para todos los casos sin resultado: no filtra nada. */
const MSG_SIN_RESULTADOS =
  "No encontramos boletas con ese dato. Revisa que esté bien escrito e inténtalo de nuevo.";

/** Vías de búsqueda deducidas del texto; null = esa vía no aplica. */
type Vias = {
  code: string | null;
  email: string | null;
  phone: string | null;
  idNumber: string | null;
};

/**
 * Deduce qué escribió el comprador. Cuando el dato es ambiguo (por ejemplo
 * 8 dígitos, que tanto puede ser un código como una cédula corta) se activan
 * las dos vías y después los resultados se unen sin repetir.
 */
function interpretar(texto: string): Vias {
  const vias: Vias = { code: null, email: null, phone: null, idNumber: null };

  // Con arroba solo puede ser un correo. Se quitan los espacios que suelen
  // colarse al pegarlo ("juan @gmail.com") y se compara sin distinguir
  // mayúsculas, porque el correo se guarda tal cual lo escribió el comprador.
  if (texto.includes("@")) {
    const correo = texto.replace(/\s+/g, "").toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(correo)) vias.email = correo;
    return vias;
  }

  // Sin arroba: se quitan los separadores con que la gente escribe teléfonos
  // y cédulas ("300 123 4567", "12.345.678", "+57 300 123 4567") y se mira la
  // forma que queda.
  const limpio = texto.replace(/[\s.\-()+]/g, "");
  if (limpio === "") return vias;

  // Código de compra: 8 letras y números.
  if (/^[A-Za-z0-9]{8}$/.test(limpio)) vias.code = limpio.toUpperCase();

  if (/^\d+$/.test(limpio)) {
    // Teléfono: solo si de verdad parece un celular colombiano; si no,
    // normalizeWhatsApp devuelve null y esta vía se apaga sola.
    vias.phone = normalizeWhatsApp(limpio);
    // Cédula: cualquier cifra de largo razonable.
    if (/^\d{5,15}$/.test(limpio)) vias.idNumber = limpio;
  }

  return vias;
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  // Dos ventanas a la vez: la corta corta la ráfaga y la de una hora corta el
  // goteo. Se evalúan las dos siempre (sin cortocircuito) para que un intento
  // bloqueado igual cuente en ambas.
  const excedeRafaga = isRateLimited("lookup", ip, {
    max: 8,
    windowMs: 10 * 60_000,
    globalMax: 150,
  });
  const excedeGoteo = isRateLimited("lookup.hora", ip, {
    max: 25,
    windowMs: 60 * 60_000,
    globalMax: 600,
  });
  if (excedeRafaga || excedeGoteo) {
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

  const parsed = lookupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 422 }
    );
  }

  const vias = interpretar(parsed.data.query);

  // Si no se pudo interpretar nada, la respuesta es la MISMA que la de "no
  // existe": el atacante no aprende qué formas de dato reconocemos.
  if (!vias.code && !vias.email && !vias.phone && !vias.idNumber) {
    return NextResponse.json({ error: MSG_SIN_RESULTADOS }, { status: 404 });
  }

  // Cada vía activa solo devuelve identificadores internos, nunca datos
  // personales. El tope de 20 evita que un correo repetido dispare la consulta.
  const [porCodigo, porTelefono, porCorreo, porCedula] = await Promise.all([
    vias.code
      ? prisma.order.findUnique({
          where: { code: vias.code },
          select: { participantId: true },
        })
      : null,
    vias.phone
      ? prisma.participant.findUnique({
          where: { phone: vias.phone },
          select: { id: true },
        })
      : null,
    vias.email
      ? prisma.participant.findMany({
          where: { email: { equals: vias.email, mode: "insensitive" } },
          select: { id: true },
          take: 20,
        })
      : [],
    vias.idNumber
      ? prisma.participant.findMany({
          where: { idNumber: vias.idNumber },
          select: { id: true },
          take: 20,
        })
      : [],
  ]);

  // Unión sin repetidos: un mismo comprador puede aparecer por varias vías.
  const participantIds = new Set<string>();
  if (porCodigo) participantIds.add(porCodigo.participantId);
  if (porTelefono) participantIds.add(porTelefono.id);
  for (const p of porCorreo) participantIds.add(p.id);
  for (const p of porCedula) participantIds.add(p.id);

  if (participantIds.size === 0) {
    return NextResponse.json({ error: MSG_SIN_RESULTADOS }, { status: 404 });
  }

  // Todos sus pedidos, del más nuevo al más viejo. El tope de 50 es solo para
  // no devolver una página infinita a quien compra muchísimo.
  const orders = await prisma.order.findMany({
    where: { participantId: { in: [...participantIds] } },
    include: {
      raffle: { select: { title: true, digits: true, drawDateText: true } },
      participant: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Participante sin pedidos: se responde igual que si no existiera.
  if (orders.length === 0) {
    return NextResponse.json({ error: MSG_SIN_RESULTADOS }, { status: 404 });
  }

  return NextResponse.json({
    // Solo el nombre, como antes. El saludo usa el del pedido más reciente.
    participant: { name: orders[0].participant.name },
    orders: orders.map((o) => {
      const estado = isOrderExpired(o) ? "EXPIRED" : o.status;
      // Los números solo salen de aquí con el pago confirmado. En un pedido
      // pendiente se manda la cantidad (para pintar las fichas tapadas) pero
      // NINGÚN número: si no, bastaba con mirar la respuesta de esta consulta
      // para verlos sin haber pagado.
      return {
        code: o.code,
        raffleTitle: o.raffle.title,
        drawDateText: o.raffle.drawDateText,
        numbers:
          estado === "PAID"
            ? formatNumbers(JSON.parse(o.numbersJson), o.raffle.digits)
            : [],
        quantity: o.quantity,
        total: o.total,
        status: estado,
        createdAt: o.createdAt,
        paidAt: o.paidAt,
      };
    }),
  });
}
