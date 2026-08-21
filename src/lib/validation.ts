import { z } from "zod";

const BLOB_URL_RE = /^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\//i;

const imagePath = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) =>
      v === "" ||
      v.startsWith("/uploads/") ||
      v.startsWith("/img/") ||
      BLOB_URL_RE.test(v),
    "Ruta de imagen no válida"
  );

// ============================================================
// RIFAS (admin)
// ============================================================

/**
 * Paquete de boletas tal como queda GUARDADO en ticketPacksJson.
 * q = cuántos números trae, label = etiqueta ("Más vendido"), off = descuento
 * en porcentaje entero. La etiqueta y el descuento solo se escriben cuando
 * existen, así que una rifa sin ellos guarda un JSON tan corto como antes.
 */
export type TicketPack = { q: number; label?: string; off?: number };

/**
 * Un paquete admite DOS formas de entrada y las dos se guardan igual:
 *   - la vieja, que siguen mandando las rifas ya creadas:  5
 *   - la nueva, con etiqueta y descuento:  { "q": 55, "label": "Más vendido", "off": 10 }
 * El número suelto se convierte antes de validar, así el comprobante de
 * errores es siempre el del objeto y los mensajes salen en español.
 */
const ticketPack = z
  .preprocess(
    (v) => (typeof v === "number" ? { q: v } : v),
    z.object({
      q: z
        .number({ error: "Indica cuántos números trae el paquete" })
        .int("La cantidad del paquete debe ser un número entero")
        .min(1, "Un paquete debe traer al menos 1 número")
        .max(5000, "Un paquete no puede pasar de 5000 números"),
      label: z
        .string()
        .trim()
        .max(24, "La etiqueta no puede pasar de 24 caracteres")
        .optional(),
      off: z
        .number({ error: "El descuento debe ser un número" })
        .int("El descuento debe ser un número entero")
        .min(1, "El descuento mínimo es del 1%")
        .max(90, "El descuento no puede pasar del 90%")
        .optional(),
    })
  )
  .transform((p): TicketPack => {
    // Etiqueta vacía y descuento ausente no se guardan: nada de `"label": ""`
    // dando vueltas por la base ni etiquetas invisibles en la tarjeta.
    const pack: TicketPack = { q: p.q };
    if (p.label) pack.label = p.label;
    if (p.off) pack.off = p.off;
    return pack;
  });

export const RAFFLE_STATUS_VALUES = [
  "DRAFT",
  "COMING_SOON",
  "ACTIVE",
  "SOLD_OUT",
  "FINISHED",
  "CANCELLED",
] as const;

// Campos de la rifa SIN comprobaciones cruzadas. Se guardan aparte porque el
// PATCH necesita .partial() y zod no deja partir un objeto que ya lleva
// refinamientos; la coherencia mínimo/máximo se añade justo debajo.
const raffleFields = z.object({
  title: z.string().trim().min(3, "El título es muy corto").max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{3,80}$/, "Slug no válido (minúsculas, números y guiones)"),
  description: z.string().trim().max(2000).default(""),
  prize: z.string().trim().min(2, "Indica el premio").max(160),
  imageUrl: imagePath.nullable().default(null),
  // Proporción con la que se pinta la foto del sorteo. Los flyers del dueño
  // son verticales y en un marco 4/3 se les corta media información (premios
  // anticipados, precio por ficha, fecha), así que la elige él por rifa.
  // Misma lista que IMAGE_ASPECTS de src/lib/public.ts; se repite aquí porque
  // ese módulo habla con Prisma y este esquema también se usa en el navegador.
  imageAspect: z
    .enum(["4/3", "1/1", "9/16"], { error: "Proporción de foto no válida" })
    .default("4/3"),
  gallery: z.array(imagePath).max(8).default([]),
  pricePerNumber: z
    .number()
    .int()
    .min(100, "El precio mínimo es $100")
    .max(100_000_000),
  totalNumbers: z
    .number()
    .int()
    .min(10, "Mínimo 10 números")
    .max(10_000_000, "Máximo 10 millones de números"),
  // Cifras del número (2 → 00, 6 → 000000). Lo elige el administrador.
  digits: z
    .number()
    .int()
    .min(2, "Mínimo 2 cifras")
    .max(7, "Máximo 7 cifras")
    .optional(),
  selectionMode: z.enum(["MANUAL", "RANDOM", "BOTH"]).default("BOTH"),
  whatsappCheckout: z.boolean().default(true),
  // Interruptor gemelo del de WhatsApp: si esta rifa ofrece el pago automático
  // por pasarela. Nace encendido porque una rifa nueva en una tienda con
  // pasarela debe poder cobrar sola. Si el entorno no tiene pasarela
  // configurada, este sí no ofrece ningún botón: quien lo decide es el
  // servidor (src/lib/pasarela.ts), nunca lo que mande el navegador.
  gatewayCheckout: z.boolean().default(true),
  // Interruptores de la ficha del sorteo: el premio y la fecha suelen ir ya
  // dichos en el titular, así que por defecto no se repiten en la tarjeta.
  // Apagarlos NO borra el dato: sigue guardado y se usa en otras pantallas.
  showPrize: z.boolean().default(false),
  showDrawDate: z.boolean().default(false),
  ticketPacks: z
    .array(ticketPack)
    .max(12, "Máximo 12 paquetes")
    .superRefine((packs, ctx) => {
      // Dos paquetes con la misma cantidad son un error de configuración: el
      // comprador vería dos tarjetas idénticas con precios distintos y el
      // servidor tendría que elegir por él cuál cobra.
      const vistas = new Set<number>();
      packs.forEach((pack, i) => {
        if (vistas.has(pack.q)) {
          ctx.addIssue({
            code: "custom",
            path: [i, "q"],
            message: `Ya hay un paquete de ${pack.q} números`,
          });
        }
        vistas.add(pack.q);
      });
    })
    .default([{ q: 1 }, { q: 2 }, { q: 5 }, { q: 10 }]),
  prizes: z
    .array(
      z.object({
        label: z.string().trim().max(60).default(""),
        title: z.string().trim().min(1, "Escribe el premio").max(120),
        amount: z.string().trim().max(60).default(""),
        note: z.string().trim().max(120).default(""),
      })
    )
    .max(12, "Máximo 12 premios")
    .default([]),
  prizedNumbers: z
    .array(
      z.object({
        number: z
          .number()
          .int()
          .min(0, "Un número premiado no puede ser negativo")
          .max(9_999_999, "Un número premiado no puede pasar de 7 cifras"),
        prize: z.string().trim().min(1, "Escribe el premio").max(120),
      })
    )
    .max(200, "Máximo 200 números premiados")
    .default([]),
  drawDateText: z.string().trim().max(120).default(""),
  drawsAt: z.string().datetime().nullable().optional(),
  status: z.enum(RAFFLE_STATUS_VALUES),
  progressMode: z.enum(["AUTO", "MANUAL"]).default("AUTO"),
  manualProgressPct: z
    .number()
    .int()
    .min(0, "El avance no puede ser menor que 0%")
    .max(100, "El avance no puede pasar de 100%")
    .default(0),
  reservationMinutes: z
    .number()
    .int()
    .min(3, "La reserva debe durar al menos 3 minutos")
    .max(1440, "La reserva no puede pasar de 1440 minutos (24 horas)")
    .default(10),
  // Compra mínima por pedido: condición de venta que fija el dueño del sorteo
  // ("mínimo 25 números"). Por defecto 1, que equivale a no exigir mínimo.
  minNumbersPerOrder: z
    .number()
    .int()
    .min(1, "La compra mínima es de al menos 1 número")
    .max(5000, "La compra mínima no puede pasar de 5000 números")
    .default(1),
  maxNumbersPerOrder: z
    .number()
    .int()
    .min(1, "El máximo por pedido es de al menos 1 número")
    .max(5000, "El máximo por pedido no puede pasar de 5000 números")
    .default(20),
  terms: z.string().trim().max(5000).default(""),
  displayOrder: z
    .number()
    .int()
    .min(0, "El orden no puede ser negativo")
    .max(9999, "El orden no puede pasar de 9999")
    .default(0),
});

/** Un solo mensaje para que el panel diga siempre lo mismo. */
const MSG_MINIMO_MAYOR_QUE_MAXIMO =
  "La compra mínima no puede ser mayor que el máximo por pedido";

export const raffleSchema = raffleFields.superRefine((v, ctx) => {
  if (v.minNumbersPerOrder > v.maxNumbersPerOrder) {
    ctx.addIssue({
      code: "custom",
      path: ["minNumbersPerOrder"],
      message: MSG_MINIMO_MAYOR_QUE_MAXIMO,
    });
  }
});

/**
 * Los mismos campos, pero SIN valores por defecto y todos opcionales: es lo
 * que necesita un PATCH de verdad.
 *
 * `.partial()` a secas NO sirve aquí. Hace opcional cada campo, sí, pero deja
 * intacto su `.default(...)`, y un `.default()` se dispara justo cuando el
 * campo NO viene. Resultado: un PATCH de `{status}` salía del validador con
 * `whatsappCheckout: true`, `gatewayCheckout: true`, `gallery: []`,
 * `ticketPacks: [los de fábrica]`, `prizes: []`… y todo eso se escribía en la
 * base pisando lo que el dueño tenía guardado. Dos consecuencias reales:
 *
 *  1. Publicar una rifa con un PATCH de solo `{status:"ACTIVE"}` volvía a
 *     encender los dos interruptores de cobro, así que el 422 que protege de
 *     dejar una rifa vendiendo sin caja no llegaba a saltar nunca.
 *  2. Cualquier cambio parcial le borraba al dueño la galería, los paquetes,
 *     los premios y sus decisiones de cobro sin avisar.
 *
 * Quitando el `.default` antes de hacer opcional el campo, lo que no viene
 * llega como `undefined` — que es exactamente lo que el route handler espera
 * para escribir solo lo enviado y leer el resto de lo ya guardado.
 */
type SinValorPorDefecto<T extends z.ZodRawShape> = {
  [K in keyof T]: z.ZodOptional<T[K] extends z.ZodDefault<infer Interno> ? Interno : T[K]>;
};

function quitarValoresPorDefecto<T extends z.ZodRawShape>(forma: T): SinValorPorDefecto<T> {
  const salida: Record<string, z.ZodType> = {};
  for (const [clave, campo] of Object.entries(forma)) {
    // `ZodRawShape` está tipado con la interfaz mínima de zod, que no declara
    // `.optional()`; el tipo preciso lo pone `SinValorPorDefecto` al salir.
    const original = campo as z.ZodType;
    // `.unwrap()` devuelve el esquema de dentro con sus validaciones intactas
    // (formato, mínimos, refinamientos): solo se pierde el valor de relleno.
    const base =
      original instanceof z.ZodDefault ? (original.unwrap() as z.ZodType) : original;
    salida[clave] = base.optional();
  }
  return salida as SinValorPorDefecto<T>;
}

export const rafflePatchSchema = z
  .object(quitarValoresPorDefecto(raffleFields.shape))
  .superRefine((v, ctx) => {
    // En un PATCH puede llegar solo una de las dos cifras: la coherencia se
    // comprueba únicamente cuando vienen ambas (si falta una, el route handler
    // la toma de lo guardado y ahí ya estaba validada).
    if (
      v.minNumbersPerOrder != null &&
      v.maxNumbersPerOrder != null &&
      v.minNumbersPerOrder > v.maxNumbersPerOrder
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["minNumbersPerOrder"],
        message: MSG_MINIMO_MAYOR_QUE_MAXIMO,
      });
    }
  });

// ============================================================
// ÓRDENES (público)
// ============================================================

export const createOrderSchema = z
  .object({
    // El `error` de cada campo cubre también el caso "no vino en el cuerpo".
    // Sin él, un pedido sin el dato responde con el texto por defecto de Zod
    // ("expected string, received undefined"), en inglés y sin sentido para
    // un comprador; y esta respuesta se le enseña tal cual en el formulario.
    raffleSlug: z.string({ error: "Sorteo no válido" }).trim().min(3).max(80),
    name: z
      .string({ error: "Escribe tu nombre completo" })
      .trim()
      .min(2, "Escribe tu nombre completo")
      .max(120),
    phone: z
      .string({ error: "Escribe tu WhatsApp" })
      .trim()
      .min(10, "Escribe tu WhatsApp")
      .max(20),
    email: z
      .union([z.literal(""), z.string().trim().email("Correo no válido").max(200)])
      .optional(),
    // Cédula OBLIGATORIA (lo pidió el dueño): cuando salga un ganador quiere
    // poder identificarlo con nombre + cédula + celular, y así el comprador
    // encuentra sus boletas con ese solo dato aunque pierda todo lo demás.
    // Se aceptan "12.345.678" o "12 345 678" porque así la escribe la gente;
    // los separadores se limpian aquí y a la base solo llegan dígitos.
    idNumber: z
      .string({ error: "Escribe tu cédula (entre 5 y 15 dígitos)" })
      .trim()
      .max(30, "La cédula es demasiado larga")
      .transform((v) => v.replace(/[\s.]/g, ""))
      .refine(
        (v) => /^\d{5,15}$/.test(v),
        "Escribe tu cédula (entre 5 y 15 dígitos)"
      ),
    // El tope real lo impone maxNumbersPerOrder de cada rifa; aquí solo
    // ponemos el techo absoluto para no aceptar cargas absurdas.
    numbers: z.array(z.number().int().min(0).max(9_999_999)).max(5000).optional(),
    randomCount: z.number().int().min(1).max(5000).optional(),
  })
  .refine(
    (v) => (v.numbers && v.numbers.length > 0) || (v.randomCount ?? 0) > 0,
    { message: "Elige números o indica cuántos aleatorios quieres" }
  );

/**
 * "Mis boletas" con UN SOLO dato: el comprador escribe lo que tenga a mano
 * (celular, correo, cédula o código de compra) y el servidor deduce qué es.
 * Aquí solo se comprueba el largo; interpretar el texto es tarea del endpoint,
 * que además responde igual cuando no encuentra nada.
 *
 * El mínimo de 5 es el dato más corto que puede existir (una cédula de 5
 * dígitos); el máximo de 120 cubre el correo más largo que aceptamos.
 */
export const lookupSchema = z.object({
  query: z
    .string()
    .trim()
    .min(5, "Escribe al menos 5 caracteres")
    .max(120, "El dato es demasiado largo"),
});

// ============================================================
// GANADORES (admin)
// ============================================================

export const winnerSchema = z.object({
  raffleId: z.string().trim().max(40).nullable().default(null),
  raffleTitle: z.string().trim().min(2).max(160),
  numberInput: z.string().trim().max(8).default(""),
  participantName: z.string().trim().min(2, "Indica el nombre").max(120),
  prize: z.string().trim().min(2, "Indica el premio").max(160),
  drawnAtText: z.string().trim().max(120).default(""),
  photoUrl: imagePath.nullable().default(null),
  isDemo: z.boolean().default(false),
  isPublished: z.boolean().default(false),
  displayOrder: z.number().int().min(0).max(9999).default(0),
});

export const winnerPatchSchema = winnerSchema.partial();

// ============================================================
// USUARIOS ADMIN
// ============================================================

export const adminUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo no válido").max(200),
  name: z.string().trim().min(2).max(120),
  password: z
    .string()
    .min(10, "La contraseña debe tener mínimo 10 caracteres")
    .max(200),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "SOPORTE", "FINANZAS"]),
  isActive: z.boolean().default(true),
});

export const adminUserPatchSchema = adminUserSchema
  .partial()
  .extend({ password: z.string().min(10).max(200).optional() });

// ============================================================
// CONFIGURACIÓN
// ============================================================

const socialUrl = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .url("La URL no es válida")
    .max(300)
    .refine((v) => /^https?:\/\//i.test(v), "La URL debe empezar por https://"),
]);

export const settingsSchema = z.object({
  company_name: z
    .string()
    .trim()
    .min(2, "El nombre de la empresa no puede quedar vacío")
    .max(120)
    .optional(),
  whatsapp_number: z
    .string()
    .trim()
    .min(7, "Ingresa el número de WhatsApp")
    .max(20)
    .optional(),
  whatsapp_display: z
    .string()
    .trim()
    .min(7, "El WhatsApp visible no puede quedar vacío")
    .max(30)
    .optional(),
  location: z
    .string()
    .trim()
    .min(2, "La ubicación no puede quedar vacía")
    .max(160)
    .optional(),
  facebook_url: socialUrl.optional(),
  instagram_url: socialUrl.optional(),
  tiktok_url: socialUrl.optional(),
  demo_mode: z.enum(["0", "1"]).optional(),
  /** "1" envía al comprador sus números por correo al confirmarse el pago. */
  email_enabled: z.enum(["0", "1"]).optional(),
  /** Dirección desde la que salen los correos; vacío usa la del entorno. */
  email_from: z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .toLowerCase()
        .email("El correo del remitente no es válido")
        .max(200),
    ])
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo no válido").max(200),
  password: z.string().min(1, "Ingresa la contraseña").max(200),
});
