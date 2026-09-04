import { unstable_cache } from "next/cache";
import { prisma } from "./db";
import { TAG_AJUSTES } from "./cache-tags";

export type SiteSettings = {
  company_name: string;
  whatsapp_number: string;
  whatsapp_display: string;
  location: string;
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
  /** "1" muestra el aviso de sitio en demostración. */
  demo_mode: string;
  /**
   * Píxel de Meta (Facebook/Instagram). Solo dígitos. Vacío = apagado, y
   * entonces no se carga ni una petición a Meta.
   */
  meta_pixel_id: string;
};

export const SETTING_KEYS: (keyof SiteSettings)[] = [
  "company_name",
  "whatsapp_number",
  "whatsapp_display",
  "location",
  "facebook_url",
  "instagram_url",
  "tiktok_url",
  "demo_mode",
  "meta_pixel_id",
];

const FALLBACK: SiteSettings = {
  company_name: "INVERSIONES D Y S",
  whatsapp_number: "573106930187",
  whatsapp_display: "310 693 0187",
  location: "Sincelejo, Sucre, Colombia",
  facebook_url: "",
  instagram_url: "",
  tiktok_url: "",
  demo_mode: "0",
  meta_pixel_id: "",
};

/** Lectura real de la configuración (sin caché). */
async function leerAjustes(): Promise<SiteSettings> {
  const rows = await prisma.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const result = { ...FALLBACK };
  for (const key of SETTING_KEYS) {
    if (typeof map[key] === "string" && map[key].trim() !== "") {
      result[key] = map[key].trim();
    }
  }
  return result;
}

/**
 * Configuración del sitio, cacheada.
 *
 * La lee la plantilla raíz, así que se consultaba en CADA página que se pinta
 * en el servidor —incluida la del sorteo— contra una base remota que se
 * suspende sola. Son ocho textos que el dueño cambia como mucho una vez al
 * mes: es la lectura que más se repetía y la que menos cambia.
 *
 * Todo lo que devuelve son cadenas de texto, así que pasar por la caché (que
 * guarda JSON) no altera ni un valor. El PATCH de /api/admin/settings invalida
 * la etiqueta al guardar, de modo que el pie de página cambia en el acto.
 */
export const getSettings = unstable_cache(leerAjustes, ["ajustes-sitio"], {
  tags: [TAG_AJUSTES],
  revalidate: 60,
});
