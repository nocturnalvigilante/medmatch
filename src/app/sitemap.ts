import type { MetadataRoute } from "next";
import { BRANDS } from "@/lib/brands";
import { slugOf } from "@/lib/summary";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/medicines`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/before-you-fly`, changeFrequency: "monthly", priority: 0.8 },
    ...BRANDS.map((b) => ({ url: `${SITE_URL}/medicine/${slugOf(b.brand)}`, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
