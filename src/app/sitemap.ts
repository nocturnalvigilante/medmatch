import type { MetadataRoute } from "next";
import { BRANDS, slugOf } from "@/lib/brands";
import { topMedicines } from "@/lib/india";
import { SITE_URL } from "@/lib/site";

// Hand-checked brands plus the most popular Indian medicines per letter (~4,000 pages). Every other medicine still has a page.
export default function sitemap(): MetadataRoute.Sitemap {
  const slugs = new Set([...BRANDS.map((b) => slugOf(b.brand)), ...topMedicines(110).map((m) => m.slug)]);
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/medicines`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/before-you-fly`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/accuracy`, changeFrequency: "weekly", priority: 0.5 },
    ...[...slugs].map((s) => ({ url: `${SITE_URL}/medicine/${s}`, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
