import type { MetadataRoute } from "next";
import { getIndicators } from "@/lib/api";
import { createSitemap } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const indicators = await getIndicators();
  return createSitemap(indicators);
}
