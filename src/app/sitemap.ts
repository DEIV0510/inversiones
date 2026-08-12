import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:5236";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/terminos`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/privacidad`, changeFrequency: "monthly", priority: 0.4 },
  ];
}
