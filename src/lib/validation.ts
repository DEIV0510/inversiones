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
  // Interruptores de la ficha del sorteo: el premio y la fecha suelen ir ya
  // dichos en el titular, así que por defecto no se repiten en la tarjeta.
  // Apagarlos NO borra el dato: sigue guardado y se usa en otras pantallas.
  showPrize: z.boolean().default(false),
  showDrawDate: z.boolean().default(false),
  ticketPacks: z
    .array(
      z
        .number()
        .int()
        .min(1, "Un paquete debe traer al menos 1 número")
        .max(5000, "Un paquete no puede pasar de 5000 números")
    )
    .max(12, "Máximo 12 paquetes")
    .default([1, 2, 5, 10]),
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

export const rafflePatchSchema = raffleFields.partial().superRefine((v, ctx) => {
  // El PATCH es parcial, pero las dos cifras llevan valor por defecto, así que
  // en la práctica siempre llegan (1 y 20 si el panel no las manda). La
  // comprobación de nulos es solo por si eso dejara de ser así.
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
    raffleSlug: z.string().trim().min(3).max(80),
    name: z.string().trim().min(2, "Escribe tu nombre completo").max(120),
    phone: z.string().trim().min(10, "Escribe tu WhatsApp").max(20),
    email: z
      .union([z.literal(""), z.string().trim().email("Correo no válido").max(200)])
      .optional(),
    // Cédula opcional: sirve para que después el comprador encuentre sus
    // boletas con ese solo dato. Se aceptan "12.345.678" o "12 345 678"
    // porque así la escribe la gente; los separadores se limpian aquí y a la
    // base solo llegan dígitos.
    idNumber: z
      .string()
      .trim()
      .max(30, "La cédula es demasiado larga")
      .transform((v) => v.replace(/[\s.]/g, ""))
      .refine(
        (v) => v === "" || /^\d{5,15}$/.test(v),
        "La cédula debe tener entre 5 y 15 dígitos"
      )
      .optional(),
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
