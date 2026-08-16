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

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: CABECERAS_SEGURIDAD }];
  },
};

export default nextConfig;
