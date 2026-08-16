import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad para TODAS las rutas.
 *
 * La más importante es la de enmarcado: sin ella, cualquier web puede meter
 * el panel dentro de un iframe invisible y hacer que el administrador, sin
 * darse cuenta, pulse "confirmar pago" o "eliminar rifa" (clickjacking).
 * Se declara dos veces a propósito: `frame-ancestors` es lo que respetan los
 * navegadores actuales y `X-Frame-Options` cubre a los antiguos.
 */
const CABECERAS_SEGURIDAD = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Impide que el navegador "adivine" el tipo de un archivo servido (una
  // imagen subida no puede acabar interpretándose como HTML o script).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Al salir del sitio no se filtra la ruta: el código de un pedido va en la
  // URL de /pedido/[code] y no debe viajar en el Referer a terceros.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // El sitio no usa cámara, micrófono ni geolocalización: se apagan.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

/**
 * Optimización de imágenes.
 *
 * Las fotos de los sorteos se suben a Vercel Blob ya reducidas a 1400 px de
 * lado mayor, pero se servían tal cual: WebP de 933×1400 y 244 KB para una
 * tarjeta que en el móvil mide unos 360 px. Al pasar por /_next/image, Next
 * las reescala al ancho que de verdad se pinta y las reencoda.
 *
 * El subdominio del almacén (hoy `urzcbx8e9b0webxj`) cambia si el Blob se
 * vuelve a crear, así que se autoriza cualquier subdominio en lugar de
 * escribir el identificador a pelo. Protocolo, puerto, ruta y cadena de
 * consulta se declaran a propósito: si se omiten, Next da por bueno un `**`
 * y aceptaría optimizar URLs que no son nuestras.
 */
const IMAGENES: NextConfig["images"] = {
  // AVIF primero (pesa menos) y WebP para los navegadores que no lo entienden.
  formats: ["image/avif", "image/webp"],
  remotePatterns: [
    {
      protocol: "https",
      hostname: "**.public.blob.vercel-storage.com",
      port: "",
      pathname: "/**",
      search: "",
    },
  ],
};

const nextConfig: NextConfig = {
  images: IMAGENES,
  async headers() {
    return [{ source: "/:path*", headers: CABECERAS_SEGURIDAD }];
  },
};

export default nextConfig;
