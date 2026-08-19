import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isOrderExpired } from "@/lib/engine/orders";
import { formatNumbers } from "@/lib/numbers";
import { clientIp, isRateLimited, peekRateLimited } from "@/lib/rate-limit";
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
 *   - límite de intentos en dos ventanas (corta y de una hora), que solo
 *     cuenta las búsquedas de verdad (ver RAFAGA/GOTEO más abajo);
 *   - la respuesta de "no hay nada" es SIEMPRE idéntica, así que nunca revela
 *     si el dato existe, si estaba mal escrito o si simplemente no se pudo
 *     interpretar;
 *   - se devuelve lo mismo de antes (nombre y pedidos) y nunca el teléfono,
 *     el correo ni la cédula del comprador.
 */

/** Un solo mensaje para todos los casos sin resultado: no filtra nada. */
const MSG_SIN_RESULTADOS =
  "No encontramos boletas con ese dato. Revisa que esté bien escrito e inténtalo de nuevo.";

const MSG_DEMASIADOS = "Demasiados intentos. Espera unos minutos.";

/**
 * CUPO DE CONSULTAS. Antes eran 8 cada 10 minutos por IP y dejaba fuera a
 * compradores de verdad: en una casa, un cibercafé o una red móvil (CGNAT)
 * todos salen a internet con la MISMA IP, así que el cupo se reparte entre
 * gente que no tiene nada que ver entre sí.
 *
 * Cómo se eligieron los números: una persona real consulta unas 4 o 5 veces
 * seguidas (mira sus boletas, se equivoca de dato, vuelve a mirar tras pagar);
 * por una salida compartida pasan del orden de 8 a 10 personas a la vez. De
 * ahí RAFAGA = 40 cada 10 minutos. En una hora esa misma salida compartida da
 * para unas 120 consultas legítimas (GOTEO), que corta el goteo lento sin
 * molestar a nadie.
 *
 * La barrera sigue sirviendo contra quien quiera enumerar teléfonos: 120
 * consultas por hora y por IP no llegan a ninguna parte frente a los millones
 * de celulares posibles, y el cupo global endurece a quien insista.
 */
const RAFAGA = { max: 40, windowMs: 10 * 60_000, globalMax: 500 };
const GOTEO = { max: 120, windowMs: 60 * 60_000, globalMax: 1500 };

/**
 * Cupo aparte, deliberadamente enorme, para lo que ni siquiera llega a ser una
 * búsqueda (JSON roto, texto corto, dato ilegible). No gasta el cupo de
 * consultas —escribir mal el correo no es un ataque— pero evita que alguien
 * inunde el endpoint con basura. Ninguna persona real se acerca a este número.
 */
const RUIDO = { max: 300, windowMs: 10 * 60_000 };

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

  // Primero se MIRA el cupo sin gastarlo: si esta IP ya lo agotó buscando de
  // verdad, se corta aquí. Gastar cupo se hace más abajo, cuando ya sabemos
  // que lo que llegó es una búsqueda y no un dato mal escrito.
  if (
    peekRateLimited("lookup", ip, RAFAGA) ||
    peekRateLimited("lookup.hora", ip, GOTEO)
  ) {
    return NextResponse.json({ error: MSG_DEMASIADOS }, { status: 429 });
  }

  /** Intento que no llega a búsqueda: no resta cupo, solo cuenta como ruido. */
  function marcarRuido(): boolean {
    return isRateLimited("lookup.ruido", ip, RUIDO);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    if (marcarRuido()) {
      return NextResponse.json({ error: MSG_DEMASIADOS }, { status: 429 });
    }
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  }

  const parsed = lookupSchema.safeParse(body);
  if (!parsed.success) {
    // Escribir mal el correo (o quedarse corto) no gasta consultas.
    if (marcarRuido()) {
      return NextResponse.json({ error: MSG_DEMASIADOS }, { status: 429 });
    }
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 422 }
    );
  }

  const vias = interpretar(parsed.data.query);

  // Si no se pudo interpretar nada, la respuesta es la MISMA que la de "no
  // existe": el atacante no aprende qué formas de dato reconocemos. Tampoco
  // gasta cupo, porque no se consulta la base de datos.
  if (!vias.code && !vias.email && !vias.phone && !vias.idNumber) {
    if (marcarRuido()) {
      return NextResponse.json({ error: MSG_DEMASIADOS }, { status: 429 });
    }
    return NextResponse.json({ error: MSG_SIN_RESULTADOS }, { status: 404 });
  }

  // A partir de aquí SÍ hay búsqueda contra la base: ahora se gasta cupo. Se
  // evalúan las dos ventanas siempre (sin cortocircuito) para que un intento
  // bloqueado igual cuente en ambas.
  const excedeRafaga = isRateLimited("lookup", ip, RAFAGA);
  const excedeGoteo = isRateLimited("lookup.hora", ip, GOTEO);
  if (excedeRafaga || excedeGoteo) {
    return NextResponse.json({ error: MSG_DEMASIADOS }, { status: 429 });
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
