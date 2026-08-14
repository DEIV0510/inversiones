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

export const raffleSchema = z.object({
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
  ticketPacks: z
    .array(z.number().int().min(1).max(500))
    .max(6, "Máximo 6 paquetes")
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
        number: z.number().int().min(0).max(9_999_999),
        prize: z.string().trim().min(1, "Escribe el premio").max(120),
      })
    )
    .max(50, "Máximo 50 números premiados")
    .default([]),
  drawDateText: z.string().trim().max(120).default(""),
  drawsAt: z.string().datetime().nullable().optional(),
  status: z.enum(RAFFLE_STATUS_VALUES),
  progressMode: z.enum(["AUTO", "MANUAL"]).default("AUTO"),
  manualProgressPct: z.number().int().min(0).max(100).default(0),
  reservationMinutes: z.number().int().min(3).max(1440).default(10),
  maxNumbersPerOrder: z.number().int().min(1).max(500).default(20),
  terms: z.string().trim().max(5000).default(""),
  displayOrder: z.number().int().min(0).max(9999).default(0),
});

export const rafflePatchSchema = raffleSchema.partial();

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
    numbers: z.array(z.number().int().min(0).max(9_999_999)).max(500).optional(),
    randomCount: z.number().int().min(1).max(500).optional(),
  })
  .refine(
    (v) => (v.numbers && v.numbers.length > 0) || (v.randomCount ?? 0) > 0,
    { message: "Elige números o indica cuántos aleatorios quieres" }
  );

export const lookupSchema = z.object({
  phone: z.string().trim().min(10).max(20),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{8}$/, "El código tiene 8 letras y números"),
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
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo no válido").max(200),
  password: z.string().min(1, "Ingresa la contraseña").max(200),
});
