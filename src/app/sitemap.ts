import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:5236";

/**
 * Solo las páginas públicas ESTABLES. Las de cada sorteo no entran: nacen y
 * mueren con la rifa. /pedido/[code] tampoco: lleva la credencial del
 * comprador y ya se marca noindex en su propia metadata.
 *
 * "Mis boletas" y "Consultar número ganador" sí van: son dos herramientas
 * públicas enlazadas desde la cabecera y el pie de todo el sitio, y hasta
 * ahora el buscador no sabía que existían.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/boletas`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${siteUrl}/ganador`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${siteUrl}/terminos`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/privacidad`, changeFrequency: "monthly", priority: 0.4 },
  ];
}
