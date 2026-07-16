import type { MetadataRoute } from "next";
import type { Indicator } from "./types";
import { buildAbsoluteUrl } from "./siteConfig";

export const createSitemap = (
  indicators: Pick<Indicator, "slug" | "latest">[],
): MetadataRoute.Sitemap => {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: buildAbsoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: buildAbsoluteUrl("/updates"), changeFrequency: "weekly", priority: 0.6 },
    { url: buildAbsoluteUrl("/about"), changeFrequency: "yearly", priority: 0.5 },
    { url: buildAbsoluteUrl("/sources"), changeFrequency: "monthly", priority: 0.7 },
    { url: buildAbsoluteUrl("/contact"), changeFrequency: "yearly", priority: 0.4 },
    { url: buildAbsoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.3 },
    { url: buildAbsoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.3 },
    { url: buildAbsoluteUrl("/disclaimer"), changeFrequency: "yearly", priority: 0.4 },
    { url: buildAbsoluteUrl("/data-policy"), changeFrequency: "yearly", priority: 0.5 },
  ];
  const seenUrls = new Set(staticEntries.map(({ url }) => url));
  const indicatorEntries = indicators.flatMap((indicator) => {
    if (!indicator.slug) return [];
    const url = buildAbsoluteUrl(`/indicators/${encodeURIComponent(indicator.slug)}`);
    if (seenUrls.has(url)) return [];
    seenUrls.add(url);
    const publishedAt = new Date(indicator.latest.publishedAt);
    return [{
      url,
      ...(Number.isNaN(publishedAt.getTime()) ? {} : { lastModified: publishedAt }),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }];
  });

  return [...staticEntries, ...indicatorEntries];
};
